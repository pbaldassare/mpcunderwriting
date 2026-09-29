import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";

export const NIDIFICAZIONE_CATEGORIE = ["incarico", "familiare", "societario"] as const;
export type NidificazioneCategoria = (typeof NIDIFICAZIONE_CATEGORIE)[number];

export type TitoloNidificazione = {
  codice: string;
  descrizione: string;
  preposizione: string;
  categoria: NidificazioneCategoria;
  attivo?: boolean;
};

export type ClienteNidificazioneLite = {
  id: string;
  tipo_cliente?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  gruppo_statistico?: string | null;
};

export type RelazioneNidificazione = {
  id: string;
  cliente_id: string;
  cliente_collegato_id: string;
  tipo_relazione: string;
  note?: string | null;
};

export const CATEGORIA_LABEL: Record<NidificazioneCategoria, string> = {
  incarico: "Incarico",
  familiare: "Familiare",
  societario: "Societario",
};

export function clienteDisplayName(c: ClienteNidificazioneLite | null | undefined): string {
  return resolveClienteNome(c);
}

/** Garanzie da premi_garanzia_polizza, altrimenti prodotto / ramo. */
export function garanziaCollegataLabel(
  garanzie: Array<string | null | undefined>,
  prodottoNome?: string | null,
  ramoNome?: string | null,
): string {
  const fromGaranzie = [...new Set(garanzie.map((g) => (g || "").trim()).filter(Boolean))].join(", ");
  if (fromGaranzie) return fromGaranzie;
  const fallback = [...new Set([prodottoNome, ramoNome].map((v) => (v || "").trim()).filter(Boolean))].join(", ");
  return fallback || "—";
}

export function findTitolo(
  codice: string,
  titoli: TitoloNidificazione[],
): TitoloNidificazione | undefined {
  return titoli.find((t) => t.codice === codice);
}

/** "Paolo Baldassare sindaco di Comune di Varese" */
export function formatNidificazionePhrase(
  soggetto: ClienteNidificazioneLite | string,
  titolo: TitoloNidificazione | undefined,
  riferimento: ClienteNidificazioneLite | string,
): string {
  const chi = typeof soggetto === "string" ? soggetto : clienteDisplayName(soggetto);
  const diChi = typeof riferimento === "string" ? riferimento : clienteDisplayName(riferimento);
  const etichetta = (titolo?.descrizione || "collegato").toLowerCase();
  const prep = (titolo?.preposizione || "di").trim();
  return `${chi} ${etichetta} ${prep} ${diChi}`.replace(/\s+/g, " ").trim();
}

/** Messaggio utente da errore PostgREST / trigger su clienti_relazioni. */
export function formatNidificazioneSaveError(err: unknown): string {
  const e = err && typeof err === "object" ? (err as { message?: string; details?: string; hint?: string; code?: string }) : null;
  const raw = [e?.message, e?.details, e?.hint].filter(Boolean).join(" — ")
    || (err instanceof Error ? err.message : "");
  const lower = raw.toLowerCase();
  if (e?.code === "42501" || lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Non hai i permessi per salvare la nidificazione. Riprova: se persiste, manca il ruolo staff su user_roles o profiles.";
  }
  if (e?.code === "23505" || lower.includes("clienti_relazioni_unique")) {
    return "Questo collegamento esiste già.";
  }
  if (lower.includes("invalid tipo_relazione")) {
    return "Titolo di nidificazione non valido o non attivo.";
  }
  if (lower.includes("nidificazione ciclica") || lower.includes("cannot create self-relation")) {
    return "Questo collegamento creerebbe un ciclo o un auto-collegamento.";
  }
  return raw || "Impossibile salvare la nidificazione";
}

export function wouldCreateCycle(
  clienteId: string,
  parentId: string,
  relazioni: Pick<RelazioneNidificazione, "cliente_id" | "cliente_collegato_id">[],
): boolean {
  if (!clienteId || !parentId || clienteId === parentId) return true;
  const parentOf = new Map<string, string>();
  for (const r of relazioni) {
    parentOf.set(r.cliente_id, r.cliente_collegato_id);
  }
  let cursor: string | undefined = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === clienteId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return false;
}

export type NidificazioneTreeNode = {
  cliente: ClienteNidificazioneLite;
  children: {
    relazione: RelazioneNidificazione;
    titolo?: TitoloNidificazione;
    node: NidificazioneTreeNode;
  }[];
};

export function buildNidificazioneForest(
  clienti: ClienteNidificazioneLite[],
  relazioni: RelazioneNidificazione[],
  titoli: TitoloNidificazione[],
): NidificazioneTreeNode[] {
  const byId = new Map(clienti.map((c) => [c.id, c]));
  const childrenByParent = new Map<string, RelazioneNidificazione[]>();
  const childIds = new Set<string>();
  for (const r of relazioni) {
    childIds.add(r.cliente_id);
    const list = childrenByParent.get(r.cliente_collegato_id) || [];
    list.push(r);
    childrenByParent.set(r.cliente_collegato_id, list);
  }

  const visiting = new Set<string>();
  const build = (id: string): NidificazioneTreeNode | null => {
    const cliente = byId.get(id);
    if (!cliente) return null;
    if (visiting.has(id)) return { cliente, children: [] };
    visiting.add(id);
    const kids = (childrenByParent.get(id) || [])
      .map((relazione) => {
        const node = build(relazione.cliente_id);
        if (!node) return null;
        return { relazione, titolo: findTitolo(relazione.tipo_relazione, titoli), node };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    visiting.delete(id);
    return { cliente, children: kids };
  };

  const roots = clienti.filter((c) => !childIds.has(c.id) && childrenByParent.has(c.id));
  return roots
    .map((c) => build(c.id))
    .filter((n): n is NidificazioneTreeNode => !!n && n.children.length > 0);
}

export function flattenNidificazioneForest(
  forest: NidificazioneTreeNode[],
): {
  depth: number;
  cliente: ClienteNidificazioneLite;
  phrase: string | null;
  categoria: NidificazioneCategoria | null;
  gruppo_statistico: string;
}[] {
  const rows: {
    depth: number;
    cliente: ClienteNidificazioneLite;
    phrase: string | null;
    categoria: NidificazioneCategoria | null;
    gruppo_statistico: string;
  }[] = [];

  const walk = (node: NidificazioneTreeNode, depth: number, incomingPhrase: string | null, categoria: NidificazioneCategoria | null) => {
    rows.push({
      depth,
      cliente: node.cliente,
      phrase: incomingPhrase,
      categoria,
      gruppo_statistico: node.cliente.gruppo_statistico || "",
    });
    for (const child of node.children) {
      const phrase = formatNidificazionePhrase(child.node.cliente, child.titolo, node.cliente);
      walk(child.node, depth + 1, phrase, child.titolo?.categoria || null);
    }
  };

  for (const root of forest) walk(root, 0, null, null);
  return rows;
}
