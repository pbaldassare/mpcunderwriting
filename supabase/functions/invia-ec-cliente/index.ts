import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOC_BUCKET = "documenti_generali";
const DOC_CATEGORIA = "ec_cliente_email";

const payloadSchema = z.object({
  cliente_id: z.string().uuid(),
  titolo_ids: z.array(z.string().uuid()).min(1),
  recipient: z.string().email().optional(),
  subject: z.string().min(1),
  html: z.string().min(1),
  pdf_base64: z.string().min(1),
  file_name: z.string().min(1),
  totale: z.number().optional(),
  cc_specialist: z.string().email().optional(),
});

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "payload non valido", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parsed.data;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    const { data: cliente, error: cErr } = await supabase
      .from("clienti")
      .select("id, email, pec, referente_email, ragione_sociale, cognome, nome")
      .eq("id", body.cliente_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cliente) {
      return new Response(JSON.stringify({ error: "cliente non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = body.recipient
      || (cliente.email as string | null)
      || (cliente.pec as string | null)
      || (cliente.referente_email as string | null);
    if (!recipient) {
      return new Response(JSON.stringify({ error: "email cliente mancante in anagrafica" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ccSpecialist = body.cc_specialist?.trim() || null;
    if (!ccSpecialist) {
      const { data: assegn } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id")
        .eq("cliente_id", body.cliente_id)
        .eq("ruolo", "Backoffice")
        .maybeSingle();
      if (assegn?.profilo_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", assegn.profilo_id)
          .maybeSingle();
        ccSpecialist = (prof?.email as string | null)?.trim() || null;
      }
    }

    const pdfBytes = decodeBase64(body.pdf_base64);
    const sentAt = new Date();

    const { data: sendRes, error: sendErr } = await supabase.functions.invoke("send-email", {
      body: {
        to: recipient,
        subject: body.subject,
        html: body.html,
        apply_branding: true,
        ...(ccSpecialist ? { cc: ccSpecialist } : {}),
        attachments: [{
          filename: body.file_name,
          content: body.pdf_base64,
        }],
      },
    });

    const sendId = (sendRes as { id?: string })?.id ?? null;

    if (sendErr) {
      await supabase.from("log_attivita").insert({
        azione: "ec_cliente_errore",
        entita_tipo: "cliente",
        entita_id: body.cliente_id,
        severity: "warning",
        user_id: userId,
        dettagli_json: {
          destinatario: recipient,
          oggetto: body.subject,
          errore: (sendErr as { message?: string })?.message ?? String(sendErr),
          titolo_ids: body.titolo_ids,
        },
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: (sendErr as { message?: string })?.message ?? "send-email failed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const path = `${body.cliente_id}/ec_cliente_email/${Date.now()}_${body.file_name}`;
    let documentoId: string | null = null;
    let archiveError: string | null = null;

    try {
      const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: doc, error: insErr } = await supabase
        .from("documenti")
        .insert({
          nome_file: body.file_name,
          path_storage: path,
          bucket_name: DOC_BUCKET,
          entita_tipo: "cliente",
          entita_id: body.cliente_id,
          categoria: DOC_CATEGORIA,
          visibile_al_cliente: true,
          caricato_da: userId,
          caricato_da_cliente: false,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      documentoId = doc?.id ?? null;
    } catch (archErr) {
      archiveError = (archErr as Error)?.message ?? String(archErr);
      console.error("archive EC cliente failed:", archErr);
    }

    const logPayload = {
      destinatario: recipient,
      cc_specialist: ccSpecialist,
      oggetto: body.subject,
      send_id: sendId,
      titolo_ids: body.titolo_ids,
      totale: body.totale ?? null,
      path_storage: documentoId ? path : null,
      documenti_ids: documentoId ? [documentoId] : [],
      archive_error: archiveError,
      inviato_il: sentAt.toISOString(),
    };

    await supabase.from("log_attivita").insert({
      azione: "ec_cliente_inviato",
      entita_tipo: "cliente",
      entita_id: body.cliente_id,
      severity: archiveError ? "warning" : "info",
      user_id: userId,
      dettagli_json: logPayload,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        recipient,
        cc_specialist: ccSpecialist,
        send_id: sendId,
        documento_id: documentoId,
        archive_error: archiveError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("invia-ec-cliente error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error)?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
