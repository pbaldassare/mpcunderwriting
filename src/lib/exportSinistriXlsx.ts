import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { excludeArchiviati, labelStatoSinistro } from "@/lib/sinistriStati";

const fmtDate = (v: any) => (v ? format(new Date(v), "dd/MM/yyyy") : "");

export async function exportSinistriXlsx(sinistri: any[]) {
  sinistri = excludeArchiviati(sinistri);
  if (!sinistri.length) return;

  // Fetch full policy data for linked titoli
  const titoloIds = Array.from(new Set(sinistri.map((s) => s.titolo_id).filter(Boolean)));
  let polizzeById: Record<string, any> = {};
  if (titoloIds.length) {
    const { data } = await supabase
      .from("titoli")
      .select("*, compagnie(nome, codice), rami(codice, descrizione)")
      .in("id", titoloIds);
    polizzeById = Object.fromEntries((data || []).map((p: any) => [p.id, p]));
  }

  // Sheet 1: Sinistri + main policy fields
  const sinistriRows = sinistri.map((s) => {
    const p = s.titolo_id ? polizzeById[s.titolo_id] : null;
    return {
      "N° Sinistro": s.numero_sinistro || "",
      "N° Sinistro Compagnia": s.numero_sinistro_compagnia || "",
      Stato: labelStatoSinistro(s.stato),
      "Ramo Sinistro": s.ramo_sinistro || "",
      "Data Evento": fmtDate(s.data_evento),
      "Data Denuncia": fmtDate(s.data_denuncia),
      "Data Apertura": fmtDate(s.data_apertura),
      "Data Chiusura": fmtDate(s.data_chiusura),
      Indirizzo: s.indirizzo_sinistro || "",
      CAP: s.cap_sinistro || "",
      Città: s.citta_sinistro || "",
      Provincia: s.provincia_sinistro || "",
      Luogo: s.luogo_sinistro || "",
      Reparto: s.reparto || "",
      Dinamica: s.dinamica || "",
      Controparte: s.controparte || "",
      "Targa Veicolo": s.targa_veicolo || "",
      "Medico Legale": s.medico_legale || "",
      Perito: s.anagrafiche_professionali
        ? `${s.anagrafiche_professionali.cognome || ""} ${s.anagrafiche_professionali.nome || ""}`.trim() ||
          s.anagrafiche_professionali.ragione_sociale || ""
        : "",
      "Importo Riserva": s.importo_riserva ?? "",
      "Importo Liquidato": s.importo_liquidato ?? "",
      Franchigia: s.franchigia ?? "",
      "Costo Preventivato": s.costo_preventivato ?? "",
      "Costo Effettivo": s.costo_effettivo ?? "",
      "Note Perito": s.note_perito || "",
      // Polizza essenziale
      "Polizza N°": p?.numero_titolo || s.titoli?.numero_titolo || "",
      "Polizza Compagnia": p?.compagnie?.nome || s.compagnie?.nome || "",
      "Polizza Ramo": p?.rami ? `${p.rami.codice} - ${p.rami.descrizione}` : "",
      "Polizza Prodotto": p?.prodotto_nome || "",
      "Polizza Decorrenza": fmtDate(p?.decorrenza),
      "Polizza Scadenza": fmtDate(p?.scadenza),
      "Polizza Premio Lordo": p?.premio_lordo ?? "",
      "Polizza Stato": p?.stato || "",
    };
  });

  // Sheet 2: Polizze complete (all fields)
  const polizze = Object.values(polizzeById);
  const polizzeRows = polizze.map((p: any) => {
    const row: Record<string, any> = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        row[k] = "";
      } else if (typeof v === "object") {
        if (k === "compagnie") row["compagnia_nome"] = (v as any).nome || "";
        else if (k === "rami") row["ramo"] = `${(v as any).codice || ""} - ${(v as any).descrizione || ""}`;
        else row[k] = JSON.stringify(v);
      } else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        row[k] = fmtDate(v);
      } else {
        row[k] = v;
      }
    });
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(sinistriRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Sinistri");
  if (polizzeRows.length) {
    const ws2 = XLSX.utils.json_to_sheet(polizzeRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Polizze");
  }

  const filename = `sinistri_export_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
