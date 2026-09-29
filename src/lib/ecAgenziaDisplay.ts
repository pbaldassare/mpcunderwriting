import {
  isTipoPagamentoAliasBonificoEsterno,
  TIPO_PAGAMENTO_COMPENSAZIONE,
  TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
} from "@/lib/incassoTipoPagamento";

type CompagniaCollegataSource = {
  gruppi_compagnia?: { descrizione?: string | null } | null;
  gruppo_compagnia?: string | null;
} | null | undefined;

/** Nome compagnia mandataria collegata all'agenzia (gruppo compagnia). */
export function resolveCompagniaCollegataNome(comp: CompagniaCollegataSource): string {
  const nome = comp?.gruppi_compagnia?.descrizione || comp?.gruppo_compagnia || "";
  return (typeof nome === "string" ? nome : "").trim();
}

/** Cliente da join titoli → clienti_anagrafica / clienti. */
export function formatClienteEc(
  cli: { ragione_sociale?: string | null; cognome?: string | null; nome?: string | null } | null | undefined,
): string {
  if (!cli) return "—";
  return cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim() || "—";
}

export function uniqueCigsEc(titoli: { cig_rif?: string | null }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of titoli) {
    const c = (t.cig_rif || "").trim();
    if (!c) continue;
    const key = c.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Causale bonifico / oggetto mail: CIG distinti dei titoli. */
export function formatCigCausale(titoli: { cig_rif?: string | null }[], maxLen = 120): string {
  const cigs = uniqueCigsEc(titoli);
  if (cigs.length === 0) return "";
  const joined = cigs.join(", ");
  if (joined.length <= maxLen) return joined;
  return `${cigs.slice(0, 2).join(", ")} +${cigs.length - 2}`;
}

export function titoloMatchesEcSearch(
  t: {
    id?: string | null;
    numero_titolo?: string | null;
    cliente?: string | null;
    cig_rif?: string | null;
    codice_cliente?: string | null;
  },
  q: string,
): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return [t.cig_rif, t.numero_titolo, t.id, t.cliente, t.codice_cliente].some((v) =>
    (v || "").toLowerCase().includes(n),
  );
}

export function agenziaMatchesEcSearch(
  r: { nome?: string | null; codice?: string | null; compagniaCollegata?: string | null },
  q: string,
): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return `${r.nome || ""} ${r.codice || ""} ${r.compagniaCollegata || ""}`.toLowerCase().includes(n);
}

type EcGroupForSearch<TTitolo extends { premio_lordo: number }> = {
  nome: string;
  codice: string;
  compagniaCollegata?: string;
  lordo: number;
  provvigioni: number;
  ritenutaAcconto: number;
  titoli: TTitolo[];
};

/** Se matcha l'agenzia (nome/codice) mostra tutti i titoli; altrimenti solo i titoli che matchano. */
export function filterEcAgenziaGroups<TTitolo extends {
  id?: string | null;
  numero_titolo?: string | null;
  cliente?: string | null;
  cig_rif?: string | null;
  codice_cliente?: string | null;
  premio_lordo: number;
}, TGroup extends EcGroupForSearch<TTitolo>>(rows: TGroup[], query: string): TGroup[] {
  const q = query.trim();
  if (!q) return rows;
  const out: TGroup[] = [];
  for (const r of rows) {
    if (agenziaMatchesEcSearch(r, q)) {
      out.push(r);
      continue;
    }
    const titoli = r.titoli.filter((t) => titoloMatchesEcSearch(t, q));
    if (!titoli.length) continue;
    const lordo = titoli.reduce((s, t) => s + t.premio_lordo, 0);
    const factor = r.lordo > 0 ? lordo / r.lordo : 0;
    out.push({
      ...r,
      titoli,
      lordo,
      provvigioni: r.provvigioni * factor,
      ritenutaAcconto: r.ritenutaAcconto * factor,
    });
  }
  return out;
}

type TitoloImportoEc = {
  stato?: string | null;
  premio_lordo?: number | null;
  importo_incassato?: number | null;
};

/**
 * Vista E/C agenzia: se il premio è saldato (incassato), mostra il premio lordo.
 * L'abbuono è quadratura interna; all'agenzia interessa il premio versato.
 */
export function resolveImportoVersatoAgenzia(t: TitoloImportoEc): number {
  if (t.stato === "incassato") return Number(t.premio_lordo) || 0;
  return Number(t.importo_incassato) || 0;
}

/** Etichetta tipo pagamento verso agenzia: mai abbuono/compensazione interna. */
export function resolveTipoPagamentoLabelEcAgenzia(tipoPagamento: string | null | undefined): string {
  const tp = (tipoPagamento || "").toLowerCase();
  if (!tp || tp === "abbuono") return "Premio saldato";
  if (tp === "compensato" || tp === "misto_compensato") return "Premio saldato";
  if (tp === "contanti") return "Contanti";
  if (tp === "pos" || tp === "carta_credito") return "POS";
  if (tp === "bonifico" || tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS || tp === TIPO_PAGAMENTO_COMPENSAZIONE) {
    return "Bonifico";
  }
  if (tp === "garantito") return "Garantito";
  if (tp === "pagamento_diretto_compagnia") return "Pag. diretto";
  if (tp === "anticipo" || tp === "anticipo_misto") return "Acconto";
  return tipoPagamento || "—";
}

/** Codice MI export E/C agenzia: mai esporre abbuono/compensazione. */
export function resolveTipoPagamentoMiEcAgenzia(tipoPagamento: string | null | undefined): string {
  const tp = (tipoPagamento || "").toLowerCase();
  if (tp === "contanti") return "C";
  if (
    tp === "bonifico" ||
    tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS ||
    tp === TIPO_PAGAMENTO_COMPENSAZIONE ||
    tp === "abbuono" ||
    tp === "compensato" ||
    tp === "misto_compensato"
  ) {
    return "B";
  }
  // Acconti da conto bancario → bonifico verso agenzia (come incasso reale)
  if (tp === "anticipo" || tp === "anticipo_misto") return "B";
  if (tp === "pos" || tp === "carta_credito") return "B";
  if (tp === "assegno") return "A";
  if (tp === "pagamento_diretto_compagnia") return "B";
  if (tp === "garantito") return "*";
  return "";
}

/** Codice MI per riga PDF E/C agenzia (A/B/C/*). */
export function resolveMiCodiceEcAgenzia(tipoPagamento: string | null | undefined): string {
  if (!tipoPagamento) return "B";
  const mapped = resolveTipoPagamentoMiEcAgenzia(tipoPagamento);
  if (mapped) return mapped;
  return "*";
}

export function resolveTipoPagamentoBadgeVariant(
  tipoPagamento: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  const tp = (tipoPagamento || "").toLowerCase();
  if (tp === "contanti") return "secondary";
  if (tp === "pos" || tp === "carta_credito" || tp === "garantito") return "default";
  if (
    isTipoPagamentoAliasBonificoEsterno(tp) ||
    tp === "compensato" ||
    tp === "misto_compensato"
  ) {
    return "outline";
  }
  if (tp === "pagamento_diretto_compagnia") return "outline";
  return "secondary";
}
