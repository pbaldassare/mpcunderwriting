import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const attachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
});

const stringOrArray = z.union([z.string().min(1), z.array(z.string().min(1))]);

const emailPayloadSchema = z.object({
  to: stringOrArray,
  subject: z.string().min(1),
  html: z.string().min(1),
  from: z.string().min(1).optional(),
  reply_to: z.string().min(1).optional(),
  cc: stringOrArray.optional(),
  bcc: stringOrArray.optional(),
  attachments: z.array(attachmentSchema).optional(),
  apply_branding: z.boolean().optional(),
  template_id: z.string().optional(),
  ufficio_id: z.string().uuid().optional().nullable(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(opts: {
  bodyHtml: string;
  subject: string;
  logoUrl?: string | null;
  colorePrimario: string;
  intestazione: string;
  firma: string;
}): string {
  const { bodyHtml, subject, logoUrl, colorePrimario, intestazione, firma } = opts;
  // Convert plain-text bodies (no HTML tags) to <p>-paragraphs
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(bodyHtml);
  const renderedBody = looksLikeHtml
    ? bodyHtml
    : bodyHtml.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr>
          <td style="background:${colorePrimario};padding:20px 24px;text-align:left;">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:48px;display:block;" />` : `<div style="color:#fff;font-size:18px;font-weight:600;">MPC Underwriting</div>`}
          </td>
        </tr>
        ${intestazione ? `<tr><td style="padding:16px 24px 0 24px;font-size:13px;color:#6b7280;">${intestazione}</td></tr>` : ""}
        <tr>
          <td style="padding:24px;font-size:15px;line-height:1.6;">
            ${renderedBody}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px 24px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">
            ${firma}
          </td>
        </tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin:12px 0 0 0;">Questa email è stata generata automaticamente. Non rispondere a questo indirizzo.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

async function resolveResendApiKey(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await admin.rpc("resend_config");
      const vaultKey = data && typeof data === "object" ? (data as { api_key?: string | null }).api_key : null;
      if (typeof vaultKey === "string" && vaultKey.trim()) return vaultKey.trim();
    } catch (e) {
      console.warn("[send-email] vault RESEND_API_KEY non disponibile:", e);
    }
  }
  return Deno.env.get("RESEND_API_KEY") || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = await resolveResendApiKey();
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = emailPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, html, from, reply_to, cc, bcc, attachments, apply_branding, template_id, ufficio_id } = parsed.data;

    // Sandbox mode: con onboarding@resend.dev Resend permette invii SOLO al proprietario account.
    // Se il from è il sender di sandbox, dirottiamo TUTTI i destinatari verso SANDBOX_TO
    // e mettiamo gli originali come reply_to per riferimento.
    // Owner dell'account Resend: solo questo indirizzo è accettato finché il dominio non è verificato.
    const SANDBOX_OWNER = Deno.env.get("RESEND_SANDBOX_TO") || "noreply@cbnet.it";
    let finalHtml = html;
    let finalFrom = from || "";
    let finalTo: string | string[] = to;
    let finalReplyTo = reply_to;
    let finalSubject = subject;
    let sandboxRedirect = false;

    // STEP 1: Risolvi PRIMA il branding (incluso mittente_default) così finalFrom è quello reale
    if (apply_branding) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, serviceKey);
        let resolvedUfficio = ufficio_id ?? null;
        if (!resolvedUfficio && template_id) {
          const { data: tpl } = await admin
            .from("template_email")
            .select("ufficio_id")
            .eq("id", template_id)
            .maybeSingle();
          resolvedUfficio = tpl?.ufficio_id ?? null;
        }
        let branding: {
          logo_url: string | null;
          colore_primario: string | null;
          firma_html: string | null;
          intestazione_html: string | null;
          mittente_default: string | null;
        } | null = null;
        if (resolvedUfficio) {
          const { data } = await admin
            .from("email_branding")
            .select("logo_url, colore_primario, firma_html, intestazione_html, mittente_default")
            .eq("ufficio_id", resolvedUfficio)
            .maybeSingle();
          branding = data;
        }
        if (!branding) {
          const { data } = await admin
            .from("email_branding")
            .select("logo_url, colore_primario, firma_html, intestazione_html, mittente_default")
            .is("ufficio_id", null)
            .maybeSingle();
          branding = data;
        }
        if (!branding) {
          const { data } = await admin
            .from("email_branding")
            .select("logo_url, colore_primario, firma_html, intestazione_html, mittente_default")
            .limit(1)
            .maybeSingle();
          branding = data;
        }

        finalHtml = wrapHtml({
          bodyHtml: html,
          subject,
          logoUrl: branding?.logo_url || null,
          colorePrimario: branding?.colore_primario || "#0e7490",
          intestazione: branding?.intestazione_html || "",
          firma: branding?.firma_html || "<p>Cordiali saluti,<br/><strong>MPC Underwriting</strong></p>",
        });
        if (!finalFrom && branding?.mittente_default) {
          finalFrom = branding.mittente_default;
        }
      } catch (e) {
        console.warn("Branding load failed, sending raw html:", e);
      }
    }

    // STEP 2: Fallback al sender sandbox se ancora niente from
    if (!finalFrom) {
      finalFrom = "MPC Underwriting <noreply@mpcunderwriting.it>";
    }

    // STEP 3: Sandbox check sul finalFrom DEFINITIVO (dopo branding)
    const isSandbox = /onboarding@resend\.dev/i.test(finalFrom);
    if (isSandbox) {
      const originalRecipients = Array.isArray(to) ? to.join(", ") : to;
      const ownerLower = SANDBOX_OWNER.toLowerCase();
      const allOwner = (Array.isArray(to) ? to : [to]).every((r) => r.toLowerCase() === ownerLower);
      if (!allOwner) {
        sandboxRedirect = true;
        finalTo = SANDBOX_OWNER;
        finalReplyTo = reply_to || (Array.isArray(to) ? to[0] : to);
        finalSubject = `[TEST → ${originalRecipients}] ${subject}`;
      }
    }

    console.log("[send-email] Final resolved:", {
      from: finalFrom,
      to: finalTo,
      isSandbox,
      sandbox_redirect: sandboxRedirect,
    });

    const payload: Record<string, unknown> = {
      from: finalFrom,
      to: Array.isArray(finalTo) ? finalTo : [finalTo],
      subject: finalSubject,
      html: finalHtml,
    };
    if (finalReplyTo) payload.reply_to = finalReplyTo;
    if (cc && !sandboxRedirect) payload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc && !sandboxRedirect) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
    if (attachments && attachments.length > 0) payload.attachments = attachments;

    console.log("[send-email] Sending via Resend:", {
      from: finalFrom,
      to: finalTo,
      subject: finalSubject,
      sandbox_redirect: sandboxRedirect,
    });

    let res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    let data = await res.json();
    let domainNotVerified = false;
    let autoFallbackUsed = false;

    // Auto-fallback if from-domain isn't verified on Resend
    if (!res.ok && (res.status === 403 || res.status === 422)) {
      const errMsg = JSON.stringify(data || {}).toLowerCase();
      const looksLikeDomainError =
        errMsg.includes("domain") &&
        (errMsg.includes("not verified") || errMsg.includes("not found") || errMsg.includes("validation"));

      if (looksLikeDomainError && !isSandbox) {
        domainNotVerified = true;
        autoFallbackUsed = true;
        console.warn("[send-email] Domain not verified on Resend, falling back to sandbox sender. Original error:", data);

        const originalRecipients = Array.isArray(to) ? to.join(", ") : to;
        const fallbackPayload = {
          ...payload,
          from: "MPCUnderwriting <onboarding@resend.dev>",
          to: [SANDBOX_OWNER],
          subject: `[FALLBACK → ${originalRecipients}] ${finalSubject}`,
          reply_to: finalReplyTo || (Array.isArray(to) ? to[0] : to),
        };
        delete (fallbackPayload as any).cc;
        delete (fallbackPayload as any).bcc;

        res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(fallbackPayload),
        });
        data = await res.json();
      }
    }

    if (!res.ok) {
      console.error("[send-email] Resend error:", res.status, data);
      return new Response(
        JSON.stringify({
          error: "Invio email fallito",
          details: data,
          sandbox_redirect: sandboxRedirect,
          domain_not_verified: domainNotVerified,
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[send-email] Resend accepted message id:", data.id);

    // Poll real delivery status (Resend records the bounce/delivered state shortly after)
    let deliveryStatus: string | null = null;
    let deliveryDetails: any = null;
    if (data?.id) {
      // Wait ~3s for status to settle, then GET
      await new Promise((r) => setTimeout(r, 3500));
      try {
        const statusRes = await fetch(`https://api.resend.com/emails/${data.id}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        if (statusRes.ok) {
          deliveryDetails = await statusRes.json();
          deliveryStatus = deliveryDetails?.last_event || deliveryDetails?.status || null;
          console.log("[send-email] Delivery status for", data.id, "→", deliveryStatus, deliveryDetails);
        } else {
          console.warn("[send-email] Could not fetch delivery status:", statusRes.status);
        }
      } catch (e) {
        console.warn("[send-email] Status polling failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        sandbox_redirect: sandboxRedirect,
        auto_fallback_used: autoFallbackUsed,
        domain_not_verified: domainNotVerified,
        redirected_to: sandboxRedirect || autoFallbackUsed ? SANDBOX_OWNER : null,
        delivery_status: deliveryStatus,
        delivery_details: deliveryDetails,
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Errore interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
