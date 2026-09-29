import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeIban(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iban = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!iban) return null;
  if (iban.startsWith("IT") && iban.length === 27) return iban;
  return null;
}

const EXCEL_TO_DB: Record<string, string> = {
  "Generali Italia S.p.a.": "GENERALI ITALIA",
  "Generali Italia Spa": "GENERALI ITALIA",
  "Generali Div. Cattolica": "Generali Div. Cattolica",
  "Allianz Assicurazioni": "ALLIANZ",
  "Allianz Viva Spa": "Allianz Viva Spa",
  "Unipol Assicurazioni S.p.a.": "Unipol Assicurazioni S.p.a.",
  "Itas Mutua": "Itas Mutua",
  "Reale Mutua Assicurazioni": "REALE MUTUA",
  "Societa' Reale Mutua Assicurazioni": "Societa' Reale Mutua di Assicurazioni",
  "Italiana Assicurazioni": "Italiana Assicurazioni",
  Plurimandatario: "Da definire",
  "Vittoria Ass.ni": "Vittoria Ass.ni",
  "Sara Ass.ni": "Sara Ass.ni",
  "Axa Assicurazioni": "AXA",
  "Axa Assistance": "Axa Assistance",
  "Zurich Insurance Company Ltd": "Zurich Insurance Company Ltd",
  "Hdi Assicurazioni Spa": "Hdi Assicurazioni Spa",
  "Hdi Global Se": "Hdi Global Se",
  "Helvetia Assicurazioni": "HELVETIA",
  "Coface Assicurazioni": "COFACE",
  "Sace Bt Spa": "Sace Bt Spa",
  "Lloyd Italico": "Lloyd Italico",
  "Liguria Assicurazioni": "Liguria Assicurazioni",
  "Lloyd Adriatico": "Lloyd Adriatico",
  "D.a.s": "DAS",
  "D.a.s.": "DAS",
  "Filo Diretto": "Filo Diretto",
  "Cattolica Assicurazioni": "CATTOLICA",
  "Societa' Cattolica Di Assicurazione": "Societa' Cattolica Di Assicurazione",
  "Arag Assicurazioni": "ARAG",
  "Giuliana Ass.ni": "Giuliana Ass.ni",
  "Chubb Insurance": "CHUBB",
  Viscontea: "Viscontea",
  "Europ Assistance Italia Spa": "EUROP ASSISTANCE ITALIA",
  "British Marine": "British Marine",
  Roland: "ROLAND",
  "Milano Divisione Nuova Maa Assicurazioni": "Milano Divisione Nuova Maa Assicurazioni",
  "Amissima Assicurazioni": "AMISSIMA",
  "Nuova Tirrena Ass.ni": "Nuova Tirrena Ass.ni",
  "Faro Ass.ni": "Faro Ass.ni",
  Genertel: "Genertel",
  "Convenzione Fimmg": "Convenzione Fimmg",
  "Balcia Insurance Se": "Balcia Insurance Se",
  "Amtrust Assicurazioni Spa": "Amtrust Assicurazioni Spa",
  Aig: "AIG",
  "Poste Vita Spa": "Poste Vita Spa",
  "Great Lakes Insurance Re": "Great Lakes Insurance Re",
  Assimoco: "ASSIMOCO",
  "Assicuratrice Milanese": "ASSICURATRICE MILANESE",
  "Liberty Mutual Insurance Europe S.e.": "Liberty Mutual Insurance Europe S.e.",
  "Argoglobal Assicurazioni Spa": "Argoglobal Assicurazioni Spa",
  "Bene Assicurazioni": "BENE",
  "Revo Insurance S.p.a.": "REVO",
  "Uca Assicurazioni S.p.a.": "Uca Assicurazioni S.p.a.",
  "Groupama Assicurazioni Spa": "Groupama Assicurazioni Spa",
  "Tutela Legale Spa": "Tutela Legale Spa",
  "Qbe Europe Sa/nv": "Qbe Europe Sa/nv",
  "S2c Spa": "S2C",
  "Lloyd's": "Lloyd's",
};

function normKey(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

type GruppoRow = { id: string; descrizione: string };

function resolveGruppoId(
  excelName: string,
  byDescrizione: Record<string, string>,
  byNorm: Record<string, GruppoRow>,
  rows: GruppoRow[],
): { id: string | null; label: string | null; motivo: string | null } {
  const raw = String(excelName || "").trim();
  if (!raw || normKey(raw) === "plurimandatario") {
    const id = byDescrizione["Da definire"] || null;
    return { id, label: id ? "Da definire" : null, motivo: id ? null : "Gruppo 'Da definire' assente in DB" };
  }

  if (EXCEL_TO_DB[raw]) {
    const target = EXCEL_TO_DB[raw];
    const id = byDescrizione[target];
    if (id) return { id, label: target, motivo: null };
  }

  if (byDescrizione[raw]) return { id: byDescrizione[raw], label: raw, motivo: null };

  const nk = normKey(raw);
  if (byNorm[nk]) return { id: byNorm[nk].id, label: byNorm[nk].descrizione, motivo: null };

  for (const g of rows) {
    const gn = normKey(g.descrizione);
    if (gn.includes(nk) || nk.includes(gn)) {
      return { id: g.id, label: g.descrizione, motivo: null };
    }
  }

  return { id: null, label: null, motivo: `Gruppo Excel non mappato: "${raw}"` };
}

async function loadGruppiMap(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("gruppi_compagnia")
    .select("id, descrizione");
  if (error) throw new Error(`Fetch gruppi fallito: ${error.message}`);

  const byDescrizione: Record<string, string> = {};
  const byNorm: Record<string, GruppoRow> = {};
  const rows = (data || []) as GruppoRow[];
  for (const g of rows) {
    byDescrizione[g.descrizione] = g.id;
    byNorm[normKey(g.descrizione)] = g;
  }
  return { rows, byDescrizione, byNorm };
}

function mapCompagniaRecord(r: any) {
  const nomeBase = (r.nome || "").trim().replace(/^\*/, "");
  const nomeSegue = (r.nome_segue || "").trim();
  const nome = nomeSegue || nomeBase || r.codice;

  return {
    codice: r.codice,
    nome,
    nome_segue: nomeSegue || null,
    nome_sede: nomeSegue || null,
    tipo: "plurimandataria",
    gruppo_compagnia_id: null,
    indirizzo: r.indirizzo || null,
    cap: r.cap || null,
    comune: r.comune || null,
    provincia: r.prov || null,
    telefono: r.tel || null,
    fax: r.fax || null,
    codice_fiscale: r.cf || null,
    partita_iva: r.piva || null,
    mail: r.mail || null,
    pec: r.pec || null,
    mail_ec: r.mail_ec || null,
    mail_avvisi: r.mail_avvisi || null,
    email_estratto_conto: r.mail_ec || null,
    email_messe_a_cassa: r.mail_avvisi || null,
    percentuale_ra: r.percentuale_ra ?? 4.6,
    gruppo_statistico: r.gruppo_statistico || null,
    intestato_a: r.intestato_a || null,
    attiva: r.attiva !== false,
    stato: r.stato || "attivo",
    nazione: "Italia",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, records, options } = body;

    if (action === "import_batch") {
      if (!records || !Array.isArray(records)) throw new Error("Missing records array");
      const skipExisting = options?.skip_existing !== false;
      const gruppi = await loadGruppiMap(supabase);

      const codici = records.map((r: any) => r.codice).filter(Boolean);
      const existingMap: Record<string, string> = {};
      if (codici.length > 0) {
        const { data: existing } = await supabase
          .from("compagnie")
          .select("id, codice")
          .in("codice", codici);
        for (const row of existing || []) {
          if (row.codice) existingMap[row.codice] = row.id;
        }
      }

      const imported: any[] = [];
      const skipped: any[] = [];
      const failed: any[] = [];
      const rapporti_created: any[] = [];
      const rapporti_failed: any[] = [];
      const non_congiunte: any[] = [];
      const iban_linked: any[] = [];
      const iban_skipped: any[] = [];

      for (const r of records) {
        const codice = r.codice || "";
        if (!codice) {
          failed.push({ ...r, motivo: "Codice mancante" });
          continue;
        }

        let compagniaId = existingMap[codice];
        let wasSkipped = false;

        if (compagniaId && skipExisting) {
          wasSkipped = true;
          skipped.push({
            codice,
            nome: r.nome,
            compagnia_id: compagniaId,
            motivo: "Codice già presente",
          });
        } else if (!compagniaId) {
          const record = mapCompagniaRecord(r);
          const { data, error } = await supabase
            .from("compagnie")
            .insert(record)
            .select("id, codice, nome")
            .single();

          if (error) {
            failed.push({ codice, nome: r.nome, motivo: error.message });
            continue;
          }
          compagniaId = data.id;
          existingMap[codice] = compagniaId;
          imported.push({
            codice: data.codice,
            id: data.id,
            nome: data.nome,
            gruppo_label: r.gruppo_compagnia_label || null,
          });
        }

        const gruppoResolved = r.gruppo_compagnia_id
          ? { id: r.gruppo_compagnia_id, label: r.gruppo_compagnia_label || null, motivo: null }
          : resolveGruppoId(
            r.gruppo_compagnia_excel || r.gruppo_compagnia_label || "",
            gruppi.byDescrizione,
            gruppi.byNorm,
            gruppi.rows,
          );
        const gruppoId = gruppoResolved.id;
        if (!gruppoId) {
          non_congiunte.push({
            codice,
            nome: r.nome,
            nome_segue: r.nome_segue || "",
            gruppo_excel: r.gruppo_compagnia_excel || r.gruppo_compagnia_label || "",
            motivo: gruppoResolved.motivo || r.gruppo_motivo || "Gruppo compagnia assicuratrice non risolto",
            compagnia_id: compagniaId,
            fase: wasSkipped ? "saltata" : "importata",
          });
        } else {
          const { data: existingRapporto } = await supabase
            .from("compagnia_rapporti")
            .select("id")
            .eq("compagnia_id", compagniaId)
            .eq("gruppo_compagnia_id", gruppoId)
            .maybeSingle();

          if (!existingRapporto) {
            const iban = normalizeIban(r.iban);
            const rapportPayload: Record<string, unknown> = {
              compagnia_id: compagniaId,
              gruppo_compagnia_id: gruppoId,
              nome_rapporto: `${gruppoResolved.label || "Rapporto"} — ${r.nome_segue || r.nome || codice}`,
              tipo_rapporto: "Mandato diretto",
              codice_rapporto: codice,
              attivo: r.attiva !== false,
              percentuale_ra: r.percentuale_ra ?? 4.6,
              iban_dedicato: iban,
              email_estratto_conto: r.mail_ec || null,
              email_messe_a_cassa: r.mail_avvisi || null,
            };

            const { data: rapporto, error: rapErr } = await supabase
              .from("compagnia_rapporti")
              .insert(rapportPayload)
              .select("id")
              .single();

            if (rapErr) {
              rapporti_failed.push({
                codice,
                nome: r.nome,
                gruppo: gruppoResolved.label,
                motivo: rapErr.message,
                compagnia_id: compagniaId,
              });
              non_congiunte.push({
                codice,
                nome: r.nome,
                nome_segue: r.nome_segue || "",
                gruppo_excel: r.gruppo_compagnia_label || "",
                motivo: `Rapporto non creato: ${rapErr.message}`,
                compagnia_id: compagniaId,
                fase: wasSkipped ? "saltata" : "importata",
              });
            } else {
              rapporti_created.push({
                codice,
                rapporto_id: rapporto?.id,
                gruppo: gruppoResolved.label,
              });
            }
          }
        }

        const iban = normalizeIban(r.iban);
        if (iban && compagniaId) {
          const { data: compRow } = await supabase
            .from("compagnie")
            .select("conto_bancario_id")
            .eq("id", compagniaId)
            .single();

          if (!compRow?.conto_bancario_id) {
            const intestatario = (r.intestato_a || r.nome_segue || r.nome || codice).trim();
            const { data: conto, error: contoErr } = await supabase
              .from("conti_bancari")
              .insert({
                tipo: "agenzia",
                compagnia_id: compagniaId,
                etichetta: `Conto ${codice}`,
                banca: "Banca da definire",
                iban,
                intestato_a: intestatario,
                is_default: true,
                attivo: true,
              })
              .select("id")
              .single();

            if (contoErr) {
              iban_skipped.push({ codice, iban, motivo: contoErr.message });
            } else if (conto) {
              await supabase
                .from("compagnie")
                .update({ conto_bancario_id: conto.id, iban, intestato_a: intestatario })
                .eq("id", compagniaId);
              iban_linked.push({ codice, iban, conto_id: conto.id });
            }
          }
        } else if (r.iban_raw) {
          iban_skipped.push({
            codice,
            iban: r.iban_raw,
            motivo: "IBAN non valido o formato legacy",
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imported,
          skipped,
          failed,
          rapporti_created,
          rapporti_failed,
          non_congiunte,
          iban_linked,
          iban_skipped,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(
      "Azione non supportata. Usare action=import_batch (import incrementale).",
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
