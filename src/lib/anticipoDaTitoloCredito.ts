import type { SupabaseClient } from "@supabase/supabase-js";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Credito cliente da titolo con premio negativo (appendice a credito, ecc.). */
export function creditoDaPremioLordo(premioLordo: number | null | undefined): number {
  const n = Number(premioLordo) || 0;
  return n < -0.009 ? round2(Math.abs(n)) : 0;
}

export function isTitoloACredito(t: {
  premio_lordo?: number | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
}): boolean {
  return creditoDaPremioLordo(t.premio_lordo) > 0;
}

/** Risolve l'id causale ACC_CRED (fallback ECCED / ACC_STOR). */
async function resolveCausaleAccontoCredito(supabase: SupabaseClient): Promise<string | null> {
  for (const codice of ["ACC_CRED", "ECCED", "ACC_STOR"]) {
    const { data } = await (supabase.from("causali_contabili") as any)
      .select("id")
      .eq("tipo_tabella", "compensazione_messa_cassa")
      .eq("codice", codice)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

/**
 * Dopo messa a cassa completa di un titolo a credito, crea (idempotente)
 * un acconto cliente riutilizzabile / rimborsabile, sempre con causale contabile.
 */
export async function creaAnticipoDaTitoloACredito(
  supabase: SupabaseClient,
  opts: {
    titoloId: string;
    clienteId: string;
    premioLordo: number;
    numeroTitolo?: string | null;
    dataAnticipo: string;
    userId?: string | null;
    causaleId?: string | null;
  },
): Promise<{ ok: boolean; anticipoId?: string; importo?: number; skipped?: boolean; error?: string }> {
  const importo = creditoDaPremioLordo(opts.premioLordo);
  if (importo <= 0) return { ok: true, skipped: true };
  if (!opts.clienteId) return { ok: false, error: "Cliente mancante per acconto da titolo a credito" };

  const { data: existing } = await (supabase.from("cliente_anticipi") as any)
    .select("id, importo")
    .eq("titolo_origine_id", opts.titoloId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, anticipoId: existing.id, importo: Number(existing.importo) || importo, skipped: true };
  }

  const causaleId = opts.causaleId || (await resolveCausaleAccontoCredito(supabase));
  if (!causaleId) return { ok: false, error: "Causale contabile ACC_CRED/ECCED non trovata" };

  const num = (opts.numeroTitolo || "").trim() || opts.titoloId.slice(0, 8);
  const note = `Da appendice/titolo a credito ${num} (conguaglio premio)`;

  const { data, error } = await (supabase.from("cliente_anticipi") as any)
    .insert({
      cliente_id: opts.clienteId,
      data_anticipo: opts.dataAnticipo,
      importo,
      importo_residuo: importo,
      note,
      titolo_origine_id: opts.titoloId,
      creato_da: opts.userId ?? null,
      conto_bancario_id: null,
      causale_id: causaleId,
      segno: "+",
    })
    .select("id, importo")
    .single();

  if (error) {
    // Race: unique titolo_origine_id
    if (String(error.message || "").toLowerCase().includes("uq_cliente_anticipi_titolo_origine")) {
      const { data: again } = await (supabase.from("cliente_anticipi") as any)
        .select("id, importo")
        .eq("titolo_origine_id", opts.titoloId)
        .maybeSingle();
      if (again?.id) return { ok: true, anticipoId: again.id, importo: Number(again.importo) || importo, skipped: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, anticipoId: data.id, importo: Number(data.importo) || importo };
}

/** Chiude un acconto per rimborso/bonifico al cliente (azzerando il residuo). */
export async function segnaAnticipoRimborsato(
  supabase: SupabaseClient,
  anticipoId: string,
  opts: { dataRimborso: string; note?: string | null; userId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: e1 } = await (supabase.from("cliente_anticipi") as any)
    .select("id, importo, importo_residuo, rimborsato_il")
    .eq("id", anticipoId)
    .maybeSingle();
  if (e1) return { ok: false, error: e1.message };
  if (!row) return { ok: false, error: "Acconto non trovato" };
  if (row.rimborsato_il) return { ok: false, error: "Acconto già rimborsato" };
  if (Number(row.importo_residuo) <= 0) return { ok: false, error: "Acconto senza residuo da rimborsare (già usato)" };

  const noteExtra = (opts.note || "").trim();
  const { data: cur } = await (supabase.from("cliente_anticipi") as any)
    .select("note")
    .eq("id", anticipoId)
    .maybeSingle();
  const noteMerged = [cur?.note, noteExtra ? `Rimborso: ${noteExtra}` : "Rimborso/bonifico al cliente"]
    .filter(Boolean)
    .join(" · ");

  const { error } = await (supabase.from("cliente_anticipi") as any)
    .update({
      importo_residuo: 0,
      rimborsato_il: opts.dataRimborso,
      rimborsato_note: noteExtra || "Bonificato al cliente",
      rimborsato_da: opts.userId ?? null,
      note: noteMerged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", anticipoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
