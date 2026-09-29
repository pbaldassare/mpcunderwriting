// One-shot seed: 5 polizze demo per Comune di Varese con allegati PDF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENTE_ID = "94dc5a3c-1682-4aea-a9e2-190bf8bf34b1";
const UFFICIO_ID = "327e92f7-64f0-48b9-9e48-73611d8cb406";

type Polizza = {
  key: string;
  filename: string;
  numero: string;
  compagnia_id: string;
  ramo_id: string;
  prodotto_nome: string;
  descrizione: string;
  decorrenza: string;
  scadenza: string;
  premio_netto: number;
  tasse: number;
  premio_lordo: number;
  cig?: string | null;
  tacito_rinnovo: boolean;
  targa?: string | null;
};

const POLIZZE: Polizza[] = [
  {
    key: "all_risk",
    filename: "All_Risk_compressed.pdf",
    numero: "DEMO-VA-2026-010",
    compagnia_id: "ad73d682-1f88-4dcb-8ef7-615c014a95b4", // AXA XL
    ramo_id: "fd34f9a2-3665-4e5d-be22-f25d6721c6c4", // AR ALL RISKS
    prodotto_nome: "All Risks Property",
    descrizione: "All Risks Patrimonio Comunale - Polizza K24IT018712",
    decorrenza: "2024-09-30",
    scadenza: "2026-09-30",
    premio_netto: 21556.97,
    tasse: 4796.42,
    premio_lordo: 26353.39,
    cig: "B33772177C",
    tacito_rinnovo: false,
  },
  {
    key: "tutela",
    filename: "Tutela_Legale.pdf",
    numero: "DEMO-VA-2026-011",
    compagnia_id: "fe6254b6-786f-43f6-9919-d357ad1a7a5f", // Net Insurance
    ramo_id: "993a51c3-ac45-4531-a80a-917b2dcc0d9d", // SL Tutela
    prodotto_nome: "Tutela Legale Enti Pubblici",
    descrizione: "Tutela Legale Enti Pubblici - Polizza G00232119",
    decorrenza: "2023-09-30",
    scadenza: "2026-09-30",
    premio_netto: 3468.48,
    tasse: 731.52,
    premio_lordo: 4200.0,
    tacito_rinnovo: true,
  },
  {
    key: "cyber",
    filename: "Polizza_Cyber_Risk.pdf",
    numero: "DEMO-VA-2026-012",
    compagnia_id: "c890bcea-4543-4cc8-ac8f-20737544608f", // Unipol Pordenone
    ramo_id: "f479640c-7722-4700-8914-236fcb1ec9bb", // CY Cyber
    prodotto_nome: "Cyber Risk Pubblica Amministrazione",
    descrizione: "Cyber Risk PA - Polizza 196204037",
    decorrenza: "2023-09-30",
    scadenza: "2026-09-30",
    premio_netto: 4112.41,
    tasse: 887.59,
    premio_lordo: 5000.0,
    tacito_rinnovo: true,
  },
  {
    key: "rcto",
    filename: "RCT-O_2023-2026.pdf",
    numero: "DEMO-VA-2026-013",
    compagnia_id: "7030018a-a365-4ef3-bf0e-cd85ac5ec8e4", // Nobis
    ramo_id: "d9b03bc6-c566-4659-b28b-0e9c0ac56588", // PB RCT
    prodotto_nome: "RC Generale Enti Pubblici (RCT/O)",
    descrizione: "Responsabilita' Civile Generale Enti Pubblici - Polizza 203351663",
    decorrenza: "2023-09-30",
    scadenza: "2026-09-30",
    premio_netto: 13070.28,
    tasse: 2908.14,
    premio_lordo: 15978.42,
    cig: "9875689C5D",
    tacito_rinnovo: true,
  },
  {
    key: "natanti",
    filename: "RC_Natanti.pdf",
    numero: "DEMO-VA-2026-014",
    compagnia_id: "c890bcea-4543-4cc8-ac8f-20737544608f", // Unipol Pordenone
    ramo_id: "f7e27e49-8bb4-48b2-abe0-a2375d2fd13f", // QN R.C. NATANTI
    prodotto_nome: "RC Natanti - Cumulativa Veicoli/Natanti",
    descrizione: "RC Natanti cumulativa - Polizza 1/39433/230/118821519",
    decorrenza: "2023-09-30",
    scadenza: "2026-09-30",
    premio_netto: 47.05,
    tasse: 8.95,
    premio_lordo: 56.0,
    cig: "98757037EC",
    tacito_rinnovo: false,
    targa: "NATANTE",
  },
];

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { pdfs } = await req.json() as { pdfs: Record<string, string> };
    if (!pdfs) throw new Error("pdfs payload mancante");

    const results: any[] = [];

    for (const p of POLIZZE) {
      // 1. Insert titolo
      const { data: titolo, error: tErr } = await supabase
        .from("titoli")
        .insert({
          cliente_anagrafica_id: CLIENTE_ID,
          ufficio_id: UFFICIO_ID,
          compagnia_id: p.compagnia_id,
          ramo_id: p.ramo_id,
          numero_titolo: p.numero,
          prodotto_nome: p.prodotto_nome,
          descrizione_polizza: p.descrizione,
          durata_da: p.decorrenza,
          durata_a: p.scadenza,
          garanzia_da: p.decorrenza,
          garanzia_a: p.scadenza,
          data_scadenza: p.scadenza,
          premio_netto: p.premio_netto,
          tasse: p.tasse,
          premio_lordo: p.premio_lordo,
          periodicita: "annuale",
          tacito_rinnovo: p.tacito_rinnovo,
          cig_rif: p.cig ?? null,
          targa_telaio: p.targa ?? null,
          stato: "attivo",
          rate: 1,
          riga: 1,
          note: "[DEMO] Caricata da PDF esempio per Comune di Varese",
        })
        .select("id")
        .single();

      if (tErr) {
        results.push({ key: p.key, error: tErr.message });
        continue;
      }

      // 2. Upload PDF
      const b64 = pdfs[p.key];
      if (!b64) {
        results.push({ key: p.key, titolo_id: titolo.id, warn: "no pdf payload" });
        continue;
      }
      const bytes = b64ToBytes(b64);
      const path = `${titolo.id}/${p.filename}`;
      const { error: uErr } = await supabase.storage
        .from("documenti_titoli")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (uErr) {
        results.push({ key: p.key, titolo_id: titolo.id, upload_error: uErr.message });
        continue;
      }

      // 3. Insert documento
      const { error: dErr } = await supabase.from("documenti").insert({
        entita_tipo: "titolo",
        entita_id: titolo.id,
        bucket_name: "documenti_titoli",
        path_storage: path,
        nome_file: p.filename,
        categoria: "polizza_originale",
        visibile_al_cliente: true,
      });

      results.push({
        key: p.key,
        titolo_id: titolo.id,
        numero: p.numero,
        doc_inserted: !dErr,
        doc_error: dErr?.message,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
