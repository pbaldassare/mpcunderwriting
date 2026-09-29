import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, User, FileText, AlertTriangle, Building2, Package, Banknote, X, Loader2 } from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import {
  clienteSearchDescription,
  clienteSearchLabel,
  parseSearchClientiRankedPayload,
} from "@/lib/clienteSearch";
import { buildIlikeOr, PROSPECT_SEARCH_COLUMNS, sanitizeSearchTerm } from "@/lib/searchNoEmail";

interface SearchResult {
  id: string;
  titolo: string;
  sottotitolo: string;
  categoria: string;
  link: string;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  clienti: { icon: User, label: "Clienti" },
  prospect: { icon: User, label: "Prospect" },
  titoli: { icon: FileText, label: "Titoli" },
  sinistri: { icon: AlertTriangle, label: "Sinistri" },
  compagnie: { icon: Building2, label: "Agenzie" },
  prodotti: { icon: Package, label: "Prodotti" },
  trattative: { icon: Banknote, label: "Trattative" },
  rimesse: { icon: FileText, label: "Rimesse" },
  movimenti: { icon: Banknote, label: "Movimenti" },
};

// NLP keyword mapping for smart search
const NLP_MAPPINGS: { keywords: string[]; query: () => Promise<SearchResult[]> }[] = [
  {
    keywords: ["sinistri aperti", "sinistro aperto"],
    query: async () => {
      const { data } = await supabase.from("sinistri").select("id, numero_sinistro, descrizione").eq("stato", "aperto").limit(10);
      return (data || []).map((s: any) => ({ id: s.id, titolo: `Sinistro ${s.numero_sinistro || ""}`, sottotitolo: s.descrizione || "Aperto", categoria: "sinistri", link: `/sinistri/${s.id}` }));
    },
  },
  {
    keywords: ["provvigioni non pagate", "provvigioni da pagare"],
    query: async () => {
      const { data } = await supabase.from("provvigioni_generate").select("id, importo_provvigione, user_id, profiles:user_id(nome, cognome)").eq("pagata", false).limit(10);
      return (data || []).map((p: any) => ({ id: p.id, titolo: `€${p.importo_provvigione?.toFixed(2)}`, sottotitolo: p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—", categoria: "movimenti", link: "/provvigioni-maturate" }));
    },
  },
  {
    keywords: ["incroci ko", "anomalie bancarie"],
    query: async () => {
      const { data } = await supabase.from("incroci_bancari").select("id, differenza, note").eq("esito", "ko").eq("verificato", false).limit(10);
      return (data || []).map((i: any) => ({ id: i.id, titolo: `Incrocio KO — €${i.differenza || 0}`, sottotitolo: i.note || "Da verificare", categoria: "movimenti", link: "/contabilita" }));
    },
  },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const t0 = performance.now();

    // Check NLP mappings first
    const lowerQ = q.toLowerCase().trim();
    for (const mapping of NLP_MAPPINGS) {
      if (mapping.keywords.some(k => lowerQ.includes(k))) {
        const nlpResults = await mapping.query();
        setResults(nlpResults);
        setLoading(false);
        return;
      }
    }

    const useFts = q.length >= 3;
    const term = sanitizeSearchTerm(q);
    const like = `%${term}%`;
    const allResults: SearchResult[] = [];

    // Build FTS query string (simple: join words with &)
    const tsQuery = term.split(/\s+/).filter(Boolean).join(" & ");
    const prospectOr = buildIlikeOr([...PROSPECT_SEARCH_COLUMNS], term);

    // Parallel queries — clienti via RPC (stessa query della lista, senza email)
    const [clientiRpc, prospect, titoli, sinistri, compagnie, prodotti, trattative] = await Promise.all([
      supabase.rpc("search_clienti_ranked", { p_search: term, p_limit: 5, p_offset: 0 }),
      useFts
        ? supabase.from("prospect").select("id, nome, cognome, ragione_sociale, stato").textSearch("search_vector", tsQuery, { type: "plain" }).limit(5)
        : prospectOr
          ? supabase.from("prospect").select("id, nome, cognome, ragione_sociale, stato").or(prospectOr).limit(5)
          : Promise.resolve({ data: [] as any[] }),
      useFts
        ? supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo").textSearch("search_vector", tsQuery, { type: "plain" }).limit(5)
        : supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo").or(`numero_titolo.ilike.${like},stato.ilike.${like}`).limit(5),
      useFts
        ? supabase.from("sinistri").select("id, numero_sinistro, stato, descrizione").textSearch("search_vector", tsQuery, { type: "plain" }).limit(5)
        : supabase.from("sinistri").select("id, numero_sinistro, stato, descrizione").or(`numero_sinistro.ilike.${like},descrizione.ilike.${like}`).limit(5),
      supabase.from("compagnie").select("id, nome, codice").or(`nome.ilike.${like},codice.ilike.${like}`).limit(5),
      supabase.from("prodotti").select("id, nome_prodotto, codice_prodotto").or(`nome_prodotto.ilike.${like},codice_prodotto.ilike.${like}`).limit(5),
      supabase.from("trattative").select("id, prodotto, agenzia, stato").or(`prodotto.ilike.${like},compagnia.ilike.${like}`).limit(5),
    ]);

    parseSearchClientiRankedPayload(clientiRpc.data).forEach((c) =>
      allResults.push({
        id: c.id,
        titolo: clienteSearchLabel(c) || "(senza nome)",
        sottotitolo: clienteSearchDescription(c) || "",
        categoria: "clienti",
        link: `/archivi/clienti/${c.id}`,
      }),
    );
    prospect.data?.forEach((p: any) => allResults.push({
      id: p.id,
      titolo: p.ragione_sociale || `${p.nome || ""} ${p.cognome || ""}`.trim(),
      sottotitolo: p.stato || "",
      categoria: "prospect",
      link: `/archivi/prospect/${p.id}`,
    }));
    titoli.data?.forEach((t: any) => allResults.push({ id: t.id, titolo: `Titolo ${t.numero_titolo || "—"}`, sottotitolo: `${t.stato} · €${t.premio_lordo || 0}`, categoria: "titoli", link: `/titoli/${t.id}` }));
    sinistri.data?.forEach((s: any) => allResults.push({ id: s.id, titolo: `Sinistro ${s.numero_sinistro || "—"}`, sottotitolo: `${s.stato} · ${s.descrizione?.slice(0, 40) || ""}`, categoria: "sinistri", link: `/sinistri/${s.id}` }));
    compagnie.data?.forEach((c: any) => allResults.push({ id: c.id, titolo: c.nome, sottotitolo: c.codice || "—", categoria: "agenzie", link: `/compagnie` }));
    prodotti.data?.forEach((p: any) => allResults.push({ id: p.id, titolo: p.nome_prodotto, sottotitolo: p.codice_prodotto || "—", categoria: "prodotti", link: `/compagnie` }));
    trattative.data?.forEach((t: any) => allResults.push({ id: t.id, titolo: `${t.prodotto || "Trattativa"}`, sottotitolo: `${t.stato} · ${t.compagnia || ""}`, categoria: "trattative", link: `/trattative` }));

    setResults(allResults);
    setLoading(false);

    const durata = Math.round(performance.now() - t0);
    // Fire-and-forget perf log
    logAttivita({ azione: "ricerca_globale", entita_tipo: "ricerca", entita_id: "global", dettagli_json: { query: q, risultati: allResults.length, durata_ms: durata, fts: useFts } });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.categoria]) acc[r.categoria] = [];
    acc[r.categoria].push(r);
    return acc;
  }, {});

  const handleSelect = (r: SearchResult) => {
    navigate(r.link);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Cerca cliente, titolo, sinistro, agenzia..."
          className="pl-9 pr-8 h-9 bg-muted/50 border-transparent focus:border-border"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {loading && (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}
          {!loading && results.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Nessun risultato per "{query}"</div>
          )}
          {!loading && Object.entries(grouped).map(([cat, items]) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config?.icon || FileText;
            return (
              <div key={cat}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {config?.label || cat}
                </div>
                {items.map(r => (
                  <button key={r.id} onClick={() => handleSelect(r)} className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex flex-col">
                    <span className="text-sm font-medium text-foreground">{r.titolo}</span>
                    <span className="text-xs text-muted-foreground">{r.sottotitolo}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
