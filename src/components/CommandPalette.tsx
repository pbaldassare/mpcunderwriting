import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  FileText,
  AlertTriangle,
  Building2,
  Package,
  Banknote,
  Plus,
  Percent,
  Search,
  Receipt,
  Users,
  LayoutDashboard,
  Settings,
  Loader2,
} from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import {
  clienteSearchDescription,
  clienteSearchLabel,
  parseSearchClientiRankedPayload,
} from "@/lib/clienteSearch";
import { sanitizeSearchTerm } from "@/lib/searchNoEmail";

interface PaletteResult {
  id: string;
  titolo: string;
  sottotitolo: string;
  categoria: string;
  link: string;
}

interface QuickAction {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ElementType;
  link: string;
  keywords: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-polizza", label: "Nuova polizza", icon: Plus, link: "/portafoglio/immissione", keywords: "nuova polizza titolo immissione crea" },
  { id: "new-cliente", label: "Nuovo cliente", icon: Plus, link: "/clienti?new=1", keywords: "nuovo cliente crea anagrafica" },
  { id: "new-sinistro", label: "Nuovo sinistro", icon: Plus, link: "/sinistri/apertura", keywords: "nuovo sinistro apri denuncia" },
  { id: "import-sinistri", label: "Caricamento massivo sinistri", icon: Plus, link: "/sinistri/caricamento", keywords: "import sinistri excel modulo sx caricamento massivo" },
  { id: "new-trattativa", label: "Nuova trattativa", icon: Plus, link: "/trattative?new=1", keywords: "nuova trattativa preventivo" },
  { id: "go-portafoglio", label: "Portafoglio Attive", icon: FileText, link: "/portafoglio/attive", keywords: "polizze attive portafoglio" },
  { id: "go-incassi", label: "Incassi", icon: FileText, link: "/portafoglio/incassi", keywords: "avvisi incasso incassi coperture mese scadenze messa cassa bonifici" },
  { id: "go-carico", label: "Carico del mese", icon: FileText, link: "/portafoglio/carico", keywords: "carico del mese portafoglio consultazione estrazione export excel pdf" },
  { id: "go-bonifici", label: "Bonifici", icon: Banknote, link: "/contabilita/caricamento-mov-bancari?tab=da-ricongiungere", keywords: "bonifici ricongiungimento bancario ordinante movimenti" },
  { id: "go-ec-clienti", label: "E/C Clienti", icon: Receipt, link: "/contabilita/ec-clienti", keywords: "estratto conto cliente contabilita" },
  { id: "go-ec-produttori", label: "E/C Produttori", icon: Receipt, link: "/contabilita/ec-produttori", keywords: "estratto conto produttore provvigioni" },
  { id: "go-rettifica-provv", label: "Rettifica Provvigioni", icon: Percent, link: "/portafoglio/rettifica-provvigioni", keywords: "rettifica provvigioni quietanza cassa correzione" },
  { id: "go-provvigioni", label: "Provvigioni Maturate", icon: Banknote, link: "/provvigioni-maturate", keywords: "provvigioni maturate produttori" },
  { id: "go-rca-clientela", label: "Clientela RCA", icon: Users, link: "/rca/clientela", keywords: "rca progetto clientela auto autocarro targa" },
  { id: "go-rca-scadenze", label: "Scadenze RCA", icon: FileText, link: "/rca/scadenze", keywords: "rca scadenze rinnovi preventivazione" },
  { id: "go-rca-preventivi", label: "Preventivi RCA", icon: FileText, link: "/rca/preventivi", keywords: "rca preventivi quotazioni offerte" },
  { id: "go-clienti", label: "Lista Clienti", icon: Users, link: "/clienti", keywords: "clienti anagrafica lista" },
  { id: "go-sinistri", label: "Lista Sinistri", icon: AlertTriangle, link: "/sinistri", keywords: "sinistri lista" },
  { id: "go-nidificazione", label: "Nidificazione", icon: Users, link: "/portafoglio/estrazioni/nidificazione", keywords: "nidificazione clienti gruppo statistico famiglia sindaco" },
  { id: "go-restituzione-originali", label: "Restituzione originali", icon: FileText, link: "/portafoglio/estrazioni/restituzione-originali", keywords: "restituzione originali distinte spedizione compagnie agenzie documenti" },
  { id: "go-dashboard", label: "Dashboard", icon: LayoutDashboard, link: "/", keywords: "dashboard home" },
  { id: "go-impostazioni", label: "Impostazioni", icon: Settings, link: "/impostazioni", keywords: "impostazioni settings configurazione" },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  clienti: { label: "Clienti", icon: User },
  prospect: { label: "Prospect", icon: User },
  titoli: { label: "Polizze / Titoli", icon: FileText },
  sinistri: { label: "Sinistri", icon: AlertTriangle },
  compagnie: { label: "Agenzie", icon: Building2 },
  prodotti: { label: "Prodotti", icon: Package },
  trattative: { label: "Trattative", icon: Banknote },
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t0 = performance.now();
    const useFts = q.length >= 3;
    const term = sanitizeSearchTerm(q);
    const like = `%${term}%`;
    const tsQuery = term.split(/\s+/).filter(Boolean).join(" & ");
    const all: PaletteResult[] = [];

    const [clientiRpc, titoli, sinistri, compagnie, trattative] = await Promise.all([
      supabase.rpc("search_clienti_ranked", { p_search: term, p_limit: 5, p_offset: 0 }),
      useFts
        ? supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo").textSearch("search_vector", tsQuery, { type: "plain" }).limit(5)
        : supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo").or(`numero_titolo.ilike.${like},stato.ilike.${like}`).limit(5),
      useFts
        ? supabase.from("sinistri").select("id, numero_sinistro, stato, descrizione").textSearch("search_vector", tsQuery, { type: "plain" }).limit(5)
        : supabase.from("sinistri").select("id, numero_sinistro, stato, descrizione").or(`numero_sinistro.ilike.${like},descrizione.ilike.${like}`).limit(5),
      supabase.from("compagnie").select("id, nome, codice").or(`nome.ilike.${like},codice.ilike.${like}`).limit(5),
      supabase.from("trattative").select("id, prodotto, agenzia, stato").or(`prodotto.ilike.${like}`).limit(5),
    ]);

    parseSearchClientiRankedPayload(clientiRpc.data).forEach((c) =>
      all.push({
        id: c.id,
        titolo: clienteSearchLabel(c) || "(senza nome)",
        sottotitolo: clienteSearchDescription(c) || "",
        categoria: "clienti",
        link: `/archivi/clienti/${c.id}`,
      }),
    );
    titoli.data?.forEach((t: any) =>
      all.push({ id: t.id, titolo: `Polizza ${t.numero_titolo || "—"}`, sottotitolo: `${t.stato} · €${t.premio_lordo || 0}`, categoria: "titoli", link: `/titoli/${t.id}` })
    );
    sinistri.data?.forEach((s: any) =>
      all.push({ id: s.id, titolo: `Sinistro ${s.numero_sinistro || "—"}`, sottotitolo: `${s.stato} · ${s.descrizione?.slice(0, 40) || ""}`, categoria: "sinistri", link: `/sinistri/${s.id}` })
    );
    compagnie.data?.forEach((c: any) =>
      all.push({ id: c.id, titolo: c.nome, sottotitolo: c.codice || "—", categoria: "compagnie", link: `/compagnie` })
    );
    trattative.data?.forEach((t: any) =>
      all.push({ id: t.id, titolo: t.prodotto || "Trattativa", sottotitolo: `${t.stato} · ${t.agenzia || ""}`, categoria: "trattative", link: `/trattative` })
    );

    setResults(all);
    setLoading(false);

    logAttivita({
      azione: "ricerca_palette",
      entita_tipo: "ricerca",
      entita_id: "palette",
      dettagli_json: { query: q, risultati: all.length, durata_ms: Math.round(performance.now() - t0) },
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const go = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  const grouped = results.reduce<Record<string, PaletteResult[]>>((acc, r) => {
    (acc[r.categoria] ||= []).push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Cerca cliente, polizza, sinistro... oppure 'nuova polizza', 'E/C', ⌘K"
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Ricerca in corso…
          </div>
        )}

        {!loading && query.length < 2 && (
          <CommandGroup heading="Azioni rapide">
            {QUICK_ACTIONS.map((a) => (
              <CommandItem key={a.id} value={`${a.label} ${a.keywords}`} onSelect={() => go(a.link)}>
                <a.icon className="mr-2 h-4 w-4" />
                <span>{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>Nessun risultato per "{query}"</CommandEmpty>
        )}

        {!loading && query.length >= 2 && Object.entries(grouped).map(([cat, items], idx) => {
          const info = CATEGORY_LABELS[cat] || { label: cat, icon: FileText };
          const Icon = info.icon;
          return (
            <div key={cat}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={info.label}>
                {items.map((r) => (
                  <CommandItem key={`${cat}-${r.id}`} value={`${r.titolo} ${r.sottotitolo}`} onSelect={() => go(r.link)}>
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{r.titolo}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.sottotitolo}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}

        {!loading && query.length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Azioni rapide">
              {QUICK_ACTIONS.filter((a) =>
                `${a.label} ${a.keywords}`.toLowerCase().includes(query.toLowerCase())
              ).slice(0, 4).map((a) => (
                <CommandItem key={a.id} value={`action-${a.label} ${a.keywords}`} onSelect={() => go(a.link)}>
                  <a.icon className="mr-2 h-4 w-4" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5"><Search className="h-3 w-3" /> Ricerca globale</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd> naviga · <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↵</kbd> apri · <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">esc</kbd> chiudi</span>
      </div>
    </CommandDialog>
  );
}
