import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export type TitoloCassaClienti = {
  cognome: string | null;
  nome: string | null;
  ragione_sociale: string | null;
};

export type TitoloCassa = {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  cliente_anagrafica_id: string | null;
  riga: number | null;
  tipo: string | null;
  premio_lordo: number | null;
  provvigioni_firma: number | null;
  provvigioni_quietanza: number | null;
  compagnia_id: string | null;
  conferimento_gestito: boolean | null;
  fondi_ricevuti: boolean | null;
  tipo_pagamento: string | null;
  compagnie: { nome: string } | null;
  clienti: TitoloCassaClienti | null;
};

export type RiepilogoTotali = {
  count: number;
  premio_lordo: number;
  provvigioni: number;
  da_rimettere: number;
};

export type GruppoDataMessaCassa = RiepilogoTotali & {
  dataKey: string;
  dataLabel: string;
  titoli: TitoloCassa[];
};

export type GruppoPolizzaMessaCassa = RiepilogoTotali & {
  numero_titolo: string;
  dateGroups: GruppoDataMessaCassa[];
};

export type GruppoClienteMessaCassa = RiepilogoTotali & {
  cliente_id: string;
  nome: string;
  polizze: GruppoPolizzaMessaCassa[];
};

export type GruppoAgenziaMessaCassa = RiepilogoTotali & {
  compagnia_id: string;
  nome: string;
  clienti: GruppoClienteMessaCassa[];
};

export const TITOLI_CASSA_SELECT =
  "id, numero_titolo, data_messa_cassa, cliente_anagrafica_id, riga, tipo, premio_lordo, provvigioni_firma, provvigioni_quietanza, compagnia_id, conferimento_gestito, fondi_ricevuti, tipo_pagamento, compagnie:compagnie!titoli_compagnia_id_fkey(nome), clienti:clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale)";

export function clienteDisplay(t: TitoloCassa): string {
  const c = t.clienti;
  if (!c) return "—";
  return c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
}

export function importiTitolo(t: TitoloCassa) {
  const lordo = t.premio_lordo || 0;
  const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
  return { lordo, provv, netto: lordo - provv, da_rimettere: lordo - provv };
}

export function totaliDaTitoli(titoli: TitoloCassa[]): RiepilogoTotali {
  return titoli.reduce(
    (acc, t) => {
      const { lordo, provv, da_rimettere } = importiTitolo(t);
      acc.count += 1;
      acc.premio_lordo += lordo;
      acc.provvigioni += provv;
      acc.da_rimettere += da_rimettere;
      return acc;
    },
    { count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0 },
  );
}

export function dataMessaCassaLabel(raw: string | null | undefined): string {
  if (!raw) return "Senza data";
  try {
    return format(parseISO(raw.slice(0, 10)), "dd/MM/yyyy", { locale: it });
  } catch {
    return raw.slice(0, 10);
  }
}

export function dataMessaCassaKey(raw: string | null | undefined): string {
  if (!raw) return "senza-data";
  return raw.slice(0, 10);
}

export function filtraTitoliCassa(titoli: TitoloCassa[], search: string): TitoloCassa[] {
  const q = search.trim().toLowerCase();
  if (!q) return titoli;
  return titoli.filter((t) => {
    const ag = (t.compagnie?.nome || "").toLowerCase();
    const cl = clienteDisplay(t).toLowerCase();
    const pol = (t.numero_titolo || "").toLowerCase();
    const data = dataMessaCassaLabel(t.data_messa_cassa).toLowerCase();
    return ag.includes(q) || cl.includes(q) || pol.includes(q) || data.includes(q);
  });
}

export function flattenAgenzia(g: GruppoAgenziaMessaCassa): TitoloCassa[] {
  return g.clienti.flatMap((c) => c.polizze.flatMap((p) => p.dateGroups.flatMap((d) => d.titoli)));
}

function sortDateGroups(groups: GruppoDataMessaCassa[]): GruppoDataMessaCassa[] {
  return [...groups].sort((a, b) => b.dataKey.localeCompare(a.dataKey));
}

function sortPolizze(groups: GruppoPolizzaMessaCassa[]): GruppoPolizzaMessaCassa[] {
  return [...groups].sort((a, b) => a.numero_titolo.localeCompare(b.numero_titolo, "it"));
}

function sortClienti(groups: GruppoClienteMessaCassa[]): GruppoClienteMessaCassa[] {
  return [...groups].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export function buildRiepilogoTree(titoli: TitoloCassa[]): GruppoAgenziaMessaCassa[] {
  const byAgenzia = new Map<string, TitoloCassa[]>();

  for (const t of titoli) {
    const cId = t.compagnia_id || "sconosciuta";
    const list = byAgenzia.get(cId) || [];
    list.push(t);
    byAgenzia.set(cId, list);
  }

  const agenzie: GruppoAgenziaMessaCassa[] = [];

  for (const [compagnia_id, titoliAgenzia] of byAgenzia) {
    const byCliente = new Map<string, TitoloCassa[]>();
    for (const t of titoliAgenzia) {
      const clId = t.cliente_anagrafica_id || "senza-cliente";
      const list = byCliente.get(clId) || [];
      list.push(t);
      byCliente.set(clId, list);
    }

    const clienti: GruppoClienteMessaCassa[] = [];
    for (const [cliente_id, titoliCliente] of byCliente) {
      const byPolizza = new Map<string, TitoloCassa[]>();
      for (const t of titoliCliente) {
        const pol = t.numero_titolo || "senza-numero";
        const list = byPolizza.get(pol) || [];
        list.push(t);
        byPolizza.set(pol, list);
      }

      const polizze: GruppoPolizzaMessaCassa[] = [];
      for (const [numero_titolo, titoliPolizza] of byPolizza) {
        const byData = new Map<string, TitoloCassa[]>();
        for (const t of titoliPolizza) {
          const dk = dataMessaCassaKey(t.data_messa_cassa);
          const list = byData.get(dk) || [];
          list.push(t);
          byData.set(dk, list);
        }

        const dateGroups: GruppoDataMessaCassa[] = [];
        for (const [dataKey, titoliData] of byData) {
          dateGroups.push({
            dataKey,
            dataLabel: dataMessaCassaLabel(titoliData[0]?.data_messa_cassa),
            ...totaliDaTitoli(titoliData),
            titoli: titoliData.sort((a, b) => (a.riga ?? 0) - (b.riga ?? 0)),
          });
        }

        polizze.push({
          numero_titolo,
          ...totaliDaTitoli(titoliPolizza),
          dateGroups: sortDateGroups(dateGroups),
        });
      }

      clienti.push({
        cliente_id,
        nome: clienteDisplay(titoliCliente[0]),
        ...totaliDaTitoli(titoliCliente),
        polizze: sortPolizze(polizze),
      });
    }

    agenzie.push({
      compagnia_id,
      nome: titoliAgenzia[0]?.compagnie?.nome || "Senza agenzia",
      ...totaliDaTitoli(titoliAgenzia),
      clienti: sortClienti(clienti),
    });
  }

  return agenzie.sort((a, b) => b.da_rimettere - a.da_rimettere);
}
