// Provisioning demo ospedale pubblico + upload PDF placeholder
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENTE_ID = "c9f5a3b1-7e4d-5f8a-0c2b-3d4e5f6a7b81";
const DEMO_EMAIL = "protocollo@medical.it";
const DEMO_PASSWORD = "Leone123!";
const DEMO_RAGIONE = "Azienda Ospedaliera Universitaria Demo";

/** PDF minimale valido (placeholder demo). */
function minimalPdfBytes(title: string): Uint8Array {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 72 720 Td (${title.replace(/[()\\]/g, " ")}) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
  return new TextEncoder().encode(body);
}

const POLIZZE_PDF = [
  { numero: "DEMO-OS-2026-010", filename: "All_Risks_Ospedale.pdf", title: "All Risks Ospedale Demo" },
  { numero: "DEMO-OS-2026-011", filename: "Tutela_Legale_Sanita.pdf", title: "Tutela Legale Sanita Demo" },
  { numero: "DEMO-OS-2026-012", filename: "Cyber_Risk_Sanita.pdf", title: "Cyber Risk Sanita Demo" },
  { numero: "DEMO-OS-2026-013", filename: "RCT-O_Ente_Sanitario.pdf", title: "RCT-O Ente Sanitario Demo" },
  { numero: "DEMO-OS-2026-014", filename: "RCA_Ambulanze.pdf", title: "RCA Ambulanze Demo" },
];

const CLIENTE_DOCS = [
  { path: "polizza_rc_medica.pdf", name: "Polizza_RC_Medica_2025.pdf", title: "RC Medica Demo" },
  { path: "polizza_allrisks.pdf", name: "Polizza_All_Risks_Ospedale_2025.pdf", title: "All Risks Demo" },
  { path: "quietanza_inf.pdf", name: "Quietanza_Infortuni_Q1_2025.pdf", title: "Quietanza Infortuni Demo" },
  { path: "denuncia_sin001.pdf", name: "Denuncia_SIN-OS-2025-001.pdf", title: "Denuncia Sinistro Demo" },
  { path: "perizia_sin003.pdf", name: "Perizia_SIN-OS-2025-003.pdf", title: "Perizia Sinistro Demo" },
  { path: "privacy_gdpr.pdf", name: "Modulo_Privacy_Sanita_GDPR.pdf", title: "Privacy Sanita Demo" },
  { path: "accreditamento.pdf", name: "Accreditamento_Regione_Lombardia.pdf", title: "Accreditamento Demo" },
  { path: "circolare_2026.pdf", name: "Lettera_Circolare_Premi_2026.pdf", title: "Circolare Premi Demo" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const results: Record<string, unknown> = { steps: [] as unknown[] };

    // --- 1) Auth user + profile + user_roles + link clienti ---
    const { data: cliente, error: cliErr } = await supabase
      .from("clienti")
      .select("id, email, ragione_sociale, user_id")
      .eq("id", CLIENTE_ID)
      .maybeSingle();
    if (cliErr || !cliente) {
      throw new Error(cliErr?.message || "Cliente demo ospedale non trovato — eseguire prima la migration");
    }

    let userId = cliente.user_id as string | null;

    if (!userId) {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: DEMO_RAGIONE, cognome: "" },
      });

      if (authErr) {
        if (authErr.message?.includes("already been registered")) {
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
          if (!existing) throw authErr;
          userId = existing.id;
          await supabase.auth.admin.updateUserById(userId, {
            password: DEMO_PASSWORD,
            email_confirm: true,
          });
        } else {
          throw authErr;
        }
      } else {
        userId = authData.user.id;
      }

      await supabase.from("profiles").upsert({
        id: userId,
        nome: DEMO_RAGIONE,
        cognome: "",
        email: DEMO_EMAIL,
        ruolo: "cliente",
        attivo: true,
      }, { onConflict: "id" });

      await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "cliente",
      }, { onConflict: "user_id,role" });

      await supabase.from("clienti").update({
        user_id: userId,
        area_riservata_tipo: "completa",
      }).eq("id", CLIENTE_ID);

      (results.steps as unknown[]).push({ auth: "created", user_id: userId });
    } else {
      await supabase.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      await supabase.from("profiles").upsert({
        id: userId,
        nome: DEMO_RAGIONE,
        cognome: "",
        email: DEMO_EMAIL,
        ruolo: "cliente",
        attivo: true,
      }, { onConflict: "id" });
      await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "cliente",
      }, { onConflict: "user_id,role" });
      (results.steps as unknown[]).push({ auth: "existing", user_id: userId });
    }

    // --- 2) PDF polizze titoli (documenti_titoli) ---
    const pdfResults: unknown[] = [];
    for (const p of POLIZZE_PDF) {
      const { data: titolo } = await supabase
        .from("titoli")
        .select("id")
        .eq("cliente_anagrafica_id", CLIENTE_ID)
        .eq("numero_titolo", p.numero)
        .maybeSingle();
      if (!titolo?.id) {
        pdfResults.push({ numero: p.numero, skip: "titolo non trovato" });
        continue;
      }

      const { data: existingDoc } = await supabase
        .from("documenti")
        .select("id")
        .eq("entita_tipo", "titolo")
        .eq("entita_id", titolo.id)
        .eq("nome_file", p.filename)
        .maybeSingle();
      if (existingDoc?.id) {
        pdfResults.push({ numero: p.numero, skip: "doc già presente" });
        continue;
      }

      const bytes = minimalPdfBytes(p.title);
      const path = `${titolo.id}/${p.filename}`;
      const { error: upErr } = await supabase.storage
        .from("documenti_titoli")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        pdfResults.push({ numero: p.numero, upload_error: upErr.message });
        continue;
      }

      const { error: dErr } = await supabase.from("documenti").insert({
        entita_tipo: "titolo",
        entita_id: titolo.id,
        bucket_name: "documenti_titoli",
        path_storage: path,
        nome_file: p.filename,
        categoria: "polizza_originale",
        visibile_al_cliente: true,
      });
      pdfResults.push({ numero: p.numero, titolo_id: titolo.id, doc_inserted: !dErr, doc_error: dErr?.message });
    }

    // --- 3) PDF documenti cliente (documenti_clienti) ---
    const clienteDocResults: unknown[] = [];
    for (const d of CLIENTE_DOCS) {
      const storagePath = `${CLIENTE_ID}/demo-ospedale/${d.path}`;
      const bytes = minimalPdfBytes(d.title);
      const { error: upErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
      clienteDocResults.push({
        file: d.name,
        uploaded: !upErr,
        error: upErr?.message,
      });
    }

    results.pdf_polizze = pdfResults;
    results.pdf_cliente = clienteDocResults;
    results.ok = true;
    results.email = DEMO_EMAIL;
    results.cliente_id = CLIENTE_ID;

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
