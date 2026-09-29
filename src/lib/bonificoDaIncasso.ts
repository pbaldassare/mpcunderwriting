import { supabase } from "@/integrations/supabase/client";
import {
  assegnaPagatoreMovimento,
  fetchContoIdsForUfficio,
  finalizeMovimentoBancarioIncasso,
} from "@/lib/movimentiBancari";
import { notificaSedeMovimentoBancario } from "@/lib/notificheMovimentiBancari";
import {
  BONIFICO_MATCH_MIN_SCORE,
  scoreOrdinanteVsNomi,
  suggestBonificiPerCliente,
  type BonificoAperto,
} from "@/lib/bonificoMatch";

const round2 = (n: number) => Math.round(n * 100) / 100;

export { normalizeNomeMatch } from "@/lib/bonificoMatch";

export type BonificoCandidato = {
  id: string;
  data_movimento: string;
  importo: number;
  ordinante: string | null;
  descrizione: string | null;
  stato: string;
  cliente_id: string | null;
  ufficio_id: string | null;
  conto_bancario_id: string | null;
  matchReason: "cliente" | "ordinante" | "conto";
  score: number;
};

const FETCH_PAGE = 500;

/**
 * Candidati bonifico su un conto: aperti (importato/matchato/assegnato).
 * Match solo per cliente_id / ordinante (l'importo NON è criterio di matching).
 */
export async function fetchBonificiCandidatiPerIncasso(opts: {
  contoBancarioId: string;
  clienteIds: string[];
  clienteNomi: string[];
  /** @deprecated ignorato — l'importo non è parametro di matching */
  importoTarget?: number;
  limit?: number;
}): Promise<BonificoCandidato[]> {
  const limit = opts.limit ?? 120;
  const { data, error } = await supabase
    .from("movimenti_bancari" as any)
    .select(
      "id, data_movimento, importo, ordinante, descrizione, stato, cliente_id, ufficio_id, conto_bancario_id",
    )
    .eq("conto_bancario_id", opts.contoBancarioId)
    .in("stato", ["importato", "matchato", "assegnato"])
    .order("data_movimento", { ascending: false })
    .limit(FETCH_PAGE);
  if (error) throw error;

  const clienteSet = new Set(opts.clienteIds.filter(Boolean));
  const nomi = opts.clienteNomi.filter(Boolean);

  const rows = ((data as any[]) || []).map((r) => {
    let matchReason: BonificoCandidato["matchReason"] = "conto";
    let score = 10;
    if (r.cliente_id && clienteSet.has(r.cliente_id)) {
      matchReason = "cliente";
      score = 200;
    } else if (nomi.length > 0) {
      const ordScore = scoreOrdinanteVsNomi(r.ordinante, r.descrizione, nomi);
      if (ordScore >= BONIFICO_MATCH_MIN_SCORE) {
        matchReason = "ordinante";
        score = 100 + ordScore;
      } else {
        score += ordScore;
      }
    }
    return {
      id: r.id as string,
      data_movimento: String(r.data_movimento || "").slice(0, 10),
      importo: Number(r.importo) || 0,
      ordinante: r.ordinante ?? null,
      descrizione: r.descrizione ?? null,
      stato: String(r.stato || ""),
      cliente_id: r.cliente_id ?? null,
      ufficio_id: r.ufficio_id ?? null,
      conto_bancario_id: r.conto_bancario_id ?? null,
      matchReason,
      score,
    } satisfies BonificoCandidato;
  });

  rows.sort((a, b) => b.score - a.score || b.data_movimento.localeCompare(a.data_movimento));
  return rows.slice(0, limit);
}

/**
 * Cerca il miglior bonifico aperto (qualsiasi conto) per nome/cliente.
 * Usato quando sul conto corrente non c'è match nome — per suggerire di cambiare conto.
 */
export async function findBestBonificoApertoPerCliente(opts: {
  clienteIds: string[];
  clienteNomi: string[];
  excludeContoId?: string | null;
}): Promise<(BonificoAperto & { score: number; matchReason: "cliente" | "ordinante" }) | null> {
  const aperti = await fetchBonificiApertiPerIncassi({});
  const filtered = opts.excludeContoId
    ? aperti.filter((b) => b.conto_bancario_id !== opts.excludeContoId)
    : aperti;
  const clienteId = opts.clienteIds[0] ?? null;
  const sug = suggestBonificiPerCliente(filtered, {
    clienteId,
    clienteNomi: opts.clienteNomi,
  });
  // Anche match su altri clienteIds
  if (opts.clienteIds.length > 1) {
    for (const id of opts.clienteIds.slice(1)) {
      for (const b of filtered) {
        if (b.cliente_id === id && !sug.some((s) => s.id === b.id)) {
          sug.push({ ...b, score: 200, matchReason: "cliente" });
        }
      }
    }
    sug.sort((a, b) => b.score - a.score || b.data_movimento.localeCompare(a.data_movimento));
  }
  return sug[0] ?? null;
}

/**
 * Bonifici aperti per la pagina Incassi, filtrati per sedi (→ conti abilitati) e/o ufficio.
 * Carica tutti i record aperti (paginazione interna); `limit` opzionale solo se serve un tetto.
 */
export async function fetchBonificiApertiPerIncassi(opts: {
  ufficioIds?: string[];
  /** Se omesso, carica tutti i bonifici aperti (a pagine da 1000). */
  limit?: number;
}): Promise<BonificoAperto[]> {
  let contoIds: string[] = [];
  if (opts.ufficioIds && opts.ufficioIds.length > 0) {
    const sets = await Promise.all(opts.ufficioIds.map((id) => fetchContoIdsForUfficio(id)));
    contoIds = Array.from(new Set(sets.flat()));
    if (contoIds.length === 0) return [];
  }

  const PAGE = 1000;
  const hardCap = opts.limit && opts.limit > 0 ? opts.limit : Number.POSITIVE_INFINITY;
  const out: BonificoAperto[] = [];
  let from = 0;

  while (out.length < hardCap) {
    const take = Math.min(PAGE, hardCap - out.length);
    let q = supabase
      .from("movimenti_bancari" as any)
      .select(
        "id, data_movimento, importo, ordinante, descrizione, stato, cliente_id, ufficio_id, conto_bancario_id, conto:conti_bancari(etichetta)",
      )
      .in("stato", ["importato", "matchato", "assegnato"])
      .order("data_movimento", { ascending: false })
      .range(from, from + take - 1);

    if (contoIds.length > 0) {
      q = q.in("conto_bancario_id", contoIds);
    } else if (opts.ufficioIds && opts.ufficioIds.length > 0) {
      q = q.in("ufficio_id", opts.ufficioIds);
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data as any[]) || [];
    for (const r of batch) {
      out.push({
        id: r.id as string,
        data_movimento: String(r.data_movimento || "").slice(0, 10),
        importo: Number(r.importo) || 0,
        ordinante: r.ordinante ?? null,
        descrizione: r.descrizione ?? null,
        stato: String(r.stato || ""),
        cliente_id: r.cliente_id ?? null,
        ufficio_id: r.ufficio_id ?? null,
        conto_bancario_id: r.conto_bancario_id ?? null,
        conto_etichetta: r.conto?.etichetta ?? null,
      });
    }
    if (batch.length < take) break;
    from += take;
  }

  return out;
}

/**
 * Dalla messa a cassa Incassi: collega il bonifico alle quietanze e chiude il movimento
 * (stesso esito del percorso Bonifici → ricongiungimento → finalize).
 */
export async function ricongiungiEFinalizzaBonificoDaIncasso(opts: {
  movimentoId: string;
  clientePagatoreId: string;
  contoBancarioId: string | null;
  dataMessaCassa: string;
  titoli: Array<{ titoloId: string; clienteId: string; importo: number }>;
  userId: string | null;
  clienteLabel: string;
  ufficioIdHint?: string | null;
  /** Se true, non crea acconto automatico in cliente_anticipi da surplus bonifico (solo ACC_* manuali). */
  skipClienteAnticipoInsert?: boolean;
  /** Consente finalize senza quietanze (intero movimento → acconto), es. multi-bonifico. */
  allowSoloAnticipo?: boolean;
}): Promise<void> {
  const righe = opts.titoli.filter((t) => t.importo > 0 && t.clienteId && t.titoloId);
  if (righe.length === 0 && !opts.allowSoloAnticipo) {
    throw new Error("Nessuna quota bonifico da collegare");
  }

  const { data: mov, error: movErr } = await supabase
    .from("movimenti_bancari" as any)
    .select("id, importo, cliente_id, ufficio_id, conto_bancario_id, stato")
    .eq("id", opts.movimentoId)
    .maybeSingle();
  if (movErr) throw movErr;
  if (!mov) throw new Error("Movimento bancario non trovato");
  if (!["importato", "matchato", "assegnato", "ricongiunti"].includes(String((mov as any).stato))) {
    throw new Error(`Movimento non collegabile (stato: ${(mov as any).stato})`);
  }

  const ufficioId = (mov as any).ufficio_id ?? opts.ufficioIdHint ?? null;
  if (!(mov as any).cliente_id) {
    await assegnaPagatoreMovimento(opts.movimentoId, opts.clientePagatoreId, ufficioId);
  }

  await supabase.from("movimenti_clienti" as any).delete().eq("movimento_id", opts.movimentoId);

  const byCliente = new Map<string, Array<{ titoloId: string; importo: number }>>();
  for (const r of righe) {
    const arr = byCliente.get(r.clienteId) ?? [];
    arr.push({ titoloId: r.titoloId, importo: round2(r.importo) });
    byCliente.set(r.clienteId, arr);
  }

  const totPolizze = round2(righe.reduce((s, r) => s + r.importo, 0));
  const movImporto = round2(Number((mov as any).importo) || 0);
  const anticipo = round2(Math.max(0, movImporto - totPolizze));
  const ammanco = round2(Math.max(0, totPolizze - movImporto));

  const clienteIds = Array.from(byCliente.keys());
  if (!clienteIds.includes(opts.clientePagatoreId) && (anticipo > 0 || ammanco > 0)) {
    byCliente.set(opts.clientePagatoreId, byCliente.get(opts.clientePagatoreId) ?? []);
    if (!clienteIds.includes(opts.clientePagatoreId)) clienteIds.push(opts.clientePagatoreId);
  }

  const polizzeLineIds: string[] = [];

  for (const cid of Array.from(byCliente.keys())) {
    const righePol = byCliente.get(cid) ?? [];
    const importoPol = round2(righePol.reduce((s, v) => s + v.importo, 0));
    const isPrimario = cid === opts.clientePagatoreId;
    const ant = isPrimario ? anticipo : 0;
    const amm = isPrimario ? ammanco : 0;
    const importoAssegnato = round2(importoPol + ant + amm);

    const { data: mcIns, error: mcErr } = await supabase
      .from("movimenti_clienti" as any)
      .insert({
        movimento_id: opts.movimentoId,
        cliente_id: cid,
        ufficio_id: ufficioId,
        importo_assegnato: importoAssegnato,
        anticipo: ant,
        ammanco: amm,
        note: "Collegato da Incassi / messa a cassa",
      } as any)
      .select("id")
      .single();
    if (mcErr) throw mcErr;
    const mcId = (mcIns as any).id;

    const mpRows: any[] = [];
    for (const v of righePol) {
      mpRows.push({
        movimento_cliente_id: mcId,
        titolo_id: v.titoloId,
        cliente_id: cid,
        importo: v.importo,
        tipo: "polizza",
        pagato_da: opts.clienteLabel,
      });
    }
    if (isPrimario && ant > 0) {
      mpRows.push({
        movimento_cliente_id: mcId,
        titolo_id: null,
        cliente_id: cid,
        importo: ant,
        tipo: "anticipo",
        pagato_da: opts.clienteLabel,
      });
    }
    if (isPrimario && amm > 0) {
      mpRows.push({
        movimento_cliente_id: mcId,
        titolo_id: null,
        cliente_id: cid,
        importo: amm,
        tipo: "ammanco",
        pagato_da: opts.clienteLabel,
      });
    }
    if (mpRows.length > 0) {
      const { data: inserted, error } = await supabase
        .from("movimenti_polizze" as any)
        .insert(mpRows)
        .select("id, tipo");
      if (error) throw error;
      for (const row of (inserted as any[]) || []) {
        if (row.tipo === "polizza") polizzeLineIds.push(row.id);
      }
    }
  }

  await supabase
    .from("movimenti_bancari" as any)
    .update({ stato: "ricongiunti" } as any)
    .eq("id", opts.movimentoId);

  await notificaSedeMovimentoBancario({
    evento: "ricongiunto",
    movimentoId: opts.movimentoId,
    ufficioId,
    importo: movImporto,
    clienteLabel: opts.clienteLabel,
    statoNuovo: "ricongiunti",
    note: `${righe.length} quietanze da Incassi`,
  });

  await finalizeMovimentoBancarioIncasso({
    movimentoId: opts.movimentoId,
    clienteId: opts.clientePagatoreId,
    contoBancarioId: opts.contoBancarioId ?? (mov as any).conto_bancario_id ?? null,
    dataMessaCassa: opts.dataMessaCassa,
    anticipoImporto: opts.skipClienteAnticipoInsert ? 0 : anticipo,
    ammancoImporto: ammanco,
    polizzeLineIds,
    userId: opts.userId,
    note: "Incasso da pagina Incassi",
  });

  await notificaSedeMovimentoBancario({
    evento: "messo_a_cassa",
    movimentoId: opts.movimentoId,
    ufficioId,
    importo: movImporto,
    clienteLabel: opts.clienteLabel,
    statoNuovo: "incassato",
    note: `${righe.length} quietanze`,
  });
}

/**
 * Collega più bonifici alla stessa messa a cassa: distribuisce le quote cash
 * sui movimenti in ordine (greedy) e finalizza ciascuno.
 */
export async function ricongiungiEFinalizzaBonificiMultipliDaIncasso(opts: {
  movimentoIds: string[];
  movimentiImporti: Record<string, number>;
  clientePagatoreId: string;
  contoBancarioId: string | null;
  dataMessaCassa: string;
  titoli: Array<{ titoloId: string; clienteId: string; importo: number }>;
  userId: string | null;
  clienteLabel: string;
  ufficioIdHint?: string | null;
  skipClienteAnticipoInsert?: boolean;
}): Promise<void> {
  const ids = Array.from(new Set(opts.movimentoIds.filter(Boolean)));
  if (ids.length === 0) throw new Error("Nessun bonifico selezionato");
  if (ids.length === 1) {
    await ricongiungiEFinalizzaBonificoDaIncasso({
      movimentoId: ids[0],
      clientePagatoreId: opts.clientePagatoreId,
      contoBancarioId: opts.contoBancarioId,
      dataMessaCassa: opts.dataMessaCassa,
      titoli: opts.titoli,
      userId: opts.userId,
      clienteLabel: opts.clienteLabel,
      ufficioIdHint: opts.ufficioIdHint,
      skipClienteAnticipoInsert: opts.skipClienteAnticipoInsert,
    });
    return;
  }

  const remaining = opts.titoli
    .filter((t) => t.importo > 0 && t.clienteId && t.titoloId)
    .map((t) => ({ ...t, importo: round2(t.importo) }));

  for (const movimentoId of ids) {
    const cap = round2(Math.max(0, Number(opts.movimentiImporti[movimentoId]) || 0));
    if (cap <= 0) continue;

    const allocate: Array<{ titoloId: string; clienteId: string; importo: number }> = [];
    let left = cap;
    for (const r of remaining) {
      if (left <= 0) break;
      if (r.importo <= 0) continue;
      const take = round2(Math.min(r.importo, left));
      if (take <= 0) continue;
      allocate.push({ titoloId: r.titoloId, clienteId: r.clienteId, importo: take });
      r.importo = round2(r.importo - take);
      left = round2(left - take);
    }

    await ricongiungiEFinalizzaBonificoDaIncasso({
      movimentoId,
      clientePagatoreId: opts.clientePagatoreId,
      contoBancarioId: opts.contoBancarioId,
      dataMessaCassa: opts.dataMessaCassa,
      titoli: allocate,
      userId: opts.userId,
      clienteLabel: opts.clienteLabel,
      ufficioIdHint: opts.ufficioIdHint,
      skipClienteAnticipoInsert: opts.skipClienteAnticipoInsert,
      allowSoloAnticipo: allocate.length === 0,
    });
  }

  const leftover = round2(remaining.reduce((s, r) => s + r.importo, 0));
  if (leftover > 0.009) {
    throw new Error(
      `I bonifici selezionati non coprono tutto l'incasso (mancano ${leftover.toFixed(2)} €). Aggiungi un altro movimento.`,
    );
  }
}
