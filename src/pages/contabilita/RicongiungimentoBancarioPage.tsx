import { useState, useMemo, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Wallet, ChevronDown, Download, ExternalLink, Shield, Plus, X, User, Undo2, ArrowUp, ArrowDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { formatDateIT } from "@/lib/formatDate";
import * as XLSX from "xlsx";
import { MessaCassaDialog } from "@/components/portafoglio/MessaCassaDialog";
import { GarantitoDialog } from "@/components/portafoglio/GarantitoDialog";
import { notificaSedeMovimentoBancario } from "@/lib/notificheMovimentiBancari";
import { useAnticipiResiduoByClienti } from "@/hooks/useAnticipiResiduoByClienti";
import AnticipoUtilizziDrawer from "@/components/clienti/AnticipoUtilizziDrawer";
import { AggiungiPolizzaAltroClienteDialog, type PolizzaAggiunta } from "@/components/contabilita/AggiungiPolizzaAltroClienteDialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  assegnaPagatoreMovimento,
  extractOrdinanteFromDescrizione,
  fetchAllQueryPages,
  fetchContoIdsForUfficio,
  finalizeMovimentoBancarioIncasso,
  sanitizeIlikeTerm,
} from "@/lib/movimentiBancari";
import { fetchTitoliClienteDaIncassare } from "@/lib/titoliDaIncassare";
import { annullaBonificoCollegato } from "@/lib/annullaBonificoCollegato";
import { shouldScopeClientiPerSede } from "@/lib/filterContiBancariPerSede";

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLL = 0.01;

type MovimentoFilterRow = {
  data_movimento?: string | null;
  ordinante?: string | null;
  importo?: number | null;
};

const filterMovimentiByOrdinanteImporto = <T extends MovimentoFilterRow>(
  rows: T[],
  ordinante: string,
  importo: string,
): T[] => {
  let result = rows;
  const ord = ordinante.trim().toLowerCase();
  if (ord) {
    result = result.filter((m) => (m.ordinante || "").toLowerCase().includes(ord));
  }
  const impQ = importo.trim();
  if (impQ) {
    const normalized = impQ.replace(/[€$\s]/g, "").replace(",", ".");
    const asNum = parseFloat(normalized);
    result = result.filter((m) => {
      const imp = Number(m.importo) || 0;
      if (!isNaN(asNum) && /^-?\d+([.,]\d+)?$/.test(normalized)) {
        return Math.abs(imp - asNum) < TOLL;
      }
      const formatted = fmtEuro(imp).replace(/\s/g, "").toLowerCase();
      return formatted.includes(impQ.toLowerCase()) || imp.toFixed(2).includes(normalized);
    });
  }
  return result;
};

const FiltriMovimentiRow = ({
  dal,
  setDal,
  al,
  setAl,
  ordinante,
  setOrdinante,
  importo,
  setImporto,
  sortDataAsc,
  setSortDataAsc,
  children,
}: {
  dal: string;
  setDal: (v: string) => void;
  al: string;
  setAl: (v: string) => void;
  ordinante: string;
  setOrdinante: (v: string) => void;
  importo: string;
  setImporto: (v: string) => void;
  sortDataAsc: boolean;
  setSortDataAsc: (v: boolean | ((prev: boolean) => boolean)) => void;
  children?: ReactNode;
}) => (
  <div className="space-y-1.5">
    <p className="text-xs text-muted-foreground">Date in formato gg/mm/aaaa</p>
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label>
          Dal <span className="font-normal text-muted-foreground">(gg/mm/aaaa)</span>
        </Label>
        <Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" title="gg/mm/aaaa" />
      </div>
      <div>
        <Label>
          Al <span className="font-normal text-muted-foreground">(gg/mm/aaaa)</span>
        </Label>
        <Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" title="gg/mm/aaaa" />
      </div>
      <div>
        <Label>Nome ordinante</Label>
        <Input value={ordinante} onChange={(e) => setOrdinante(e.target.value)} placeholder="Cerca…" className="w-56" />
      </div>
      <div>
        <Label>Importo</Label>
        <Input value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="es. 150,00" className="w-32" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setSortDataAsc((v) => !v)}
        title={sortDataAsc ? "Ordina: dal più vecchio al più recente" : "Ordina: dal più recente al più vecchio"}
      >
        {sortDataAsc ? <ArrowUp className="w-3.5 h-3.5 mr-1" /> : <ArrowDown className="w-3.5 h-3.5 mr-1" />}
        Data {sortDataAsc ? "↑" : "↓"}
      </Button>
      {children}
    </div>
  </div>
);

const Page = () => {
  const { profile, isAdmin } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAll = isAdmin || isCfo;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const legacy = searchParams.get("legacy") === "1";

  // Flusso primario → hub Bonifici su Caricamento Mov. Bancari
  if (!legacy) {
    const dest =
      tabParam === "storico"
        ? "/contabilita/caricamento-mov-bancari?tab=ricongiunti"
        : "/contabilita/caricamento-mov-bancari?tab=da-ricongiungere";
    return <Navigate to={dest} replace />;
  }

  const activeTab =
    tabParam === "da-ricongiungere" && legacy
      ? "da-ricongiungere"
      : tabParam === "storico"
        ? "storico"
        : legacy
          ? "da-ricongiungere"
          : "storico";

  return (
    <RoleGuard allowedRoles={["admin", "cfo", "ufficio", "backoffice", "contabilita"]} permissionKey="contabilita">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">
            {activeTab === "storico" && !legacy ? "Storico bonifici" : "Bonifici (legacy)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "storico" && !legacy
              ? "Movimenti già collegati e incassati. Per i bonifici aperti usa Incassi."
              : "Vista avanzata legacy. Il flusso operativo è in Incassi → Bonifici aperti."}
          </p>
        </div>

        <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Vista legacy. Il flusso operativo è in{" "}
          <Link
            to="/contabilita/caricamento-mov-bancari?tab=da-ricongiungere"
            className="font-semibold underline underline-offset-2"
          >
            Bonifici → Da ricongiungere
          </Link>
          {" "}(match su ordinante ↔ cliente, non sull&apos;importo).
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const sp = new URLSearchParams(searchParams);
            sp.set("tab", v);
            if (legacy) sp.set("legacy", "1");
            setSearchParams(sp, { replace: true });
          }}
        >
          <TabsList>
            {(legacy || activeTab === "da-ricongiungere") && (
              <TabsTrigger value="da-ricongiungere">Da collegare</TabsTrigger>
            )}
            <TabsTrigger value="storico">Storico</TabsTrigger>
          </TabsList>

          {(legacy || activeTab === "da-ricongiungere") && (
            <TabsContent value="da-ricongiungere">
              <DaRicongiungereTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
            </TabsContent>
          )}

          <TabsContent value="storico">
            <StoricoTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
};

// === Tab: Da Ricongiungere ===
export const DaRicongiungereTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const qc = useQueryClient();
  const [filtroUfficio, setFiltroUfficio] = useState<string>("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [ordinanteDebounced, setOrdinanteDebounced] = useState("");
  const [importo, setImporto] = useState("");
  const [sortDataAsc, setSortDataAsc] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrdinanteDebounced(ordinante), 350);
    return () => clearTimeout(t);
  }, [ordinante]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    enabled: seeAll,
    queryFn: async () => (await supabase.from("uffici").select("id, nome:nome_ufficio").order("nome_ufficio")).data ?? [],
  });

  // ordinante → server (ilike ordinante|descrizione); importo → client sul set completo (tolleranza ±0.01)
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["mov-bancari", "ricongiungimento", profileUfficio, filtroUfficio, seeAll, dal, al, ordinanteDebounced, sortDataAsc],
    queryFn: async () => {
      const contoIds =
        !seeAll && profileUfficio ? await fetchContoIdsForUfficio(profileUfficio) : ([] as string[]);
      const ordTerm = sanitizeIlikeTerm(ordinanteDebounced);

      return fetchAllQueryPages<any>(async (from, to) => {
        let q = supabase.from("movimenti_bancari" as any)
          .select("id, data_movimento, importo, ordinante, descrizione, stato, ufficio_id, cliente_id, conto_bancario_id, conto:conti_bancari(etichetta), cliente:clienti(id, ragione_sociale, nome, cognome)")
          .in("stato", ["importato", "matchato", "assegnato", "ricongiunti"])
          .order("data_movimento", { ascending: sortDataAsc })
          .order("id", { ascending: sortDataAsc });
        if (seeAll && filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
        if (!seeAll && profileUfficio) {
          if (contoIds.length > 0) {
            q = q.or(`ufficio_id.eq.${profileUfficio},conto_bancario_id.in.(${contoIds.join(",")})`);
          } else {
            q = q.eq("ufficio_id", profileUfficio);
          }
        }
        if (dal) q = q.gte("data_movimento", dal);
        if (al) q = q.lte("data_movimento", al);
        if (ordTerm) q = q.or(`ordinante.ilike.%${ordTerm}%,descrizione.ilike.%${ordTerm}%`);
        return q.range(from, to);
      });
    },
  });

  // Importo filtrato client-side (match esatto con tolleranza o sottostringa formattata)
  const movsFiltrati = useMemo(
    () => filterMovimentiByOrdinanteImporto(movs, "", importo),
    [movs, importo],
  );

  return (
    <Card>
      <CardHeader>
        <FiltriMovimentiRow
          dal={dal}
          setDal={setDal}
          al={al}
          setAl={setAl}
          ordinante={ordinante}
          setOrdinante={setOrdinante}
          importo={importo}
          setImporto={setImporto}
          sortDataAsc={sortDataAsc}
          setSortDataAsc={setSortDataAsc}
        >
          {seeAll && (
            <div>
              <Label>Ufficio</Label>
              <select value={filtroUfficio} onChange={(e) => setFiltroUfficio(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
                <option value="">Tutti</option>
                {(uffici as any[]).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
        </FiltriMovimentiRow>
        {!isLoading && (
          <p className="text-sm text-muted-foreground pt-2">
            {movsFiltrati.length === 1 ? "1 movimento" : `${movsFiltrati.length} movimenti`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <p className="text-sm">Caricamento…</p> :
          movsFiltrati.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nessun bonifico da collegare</p> :
          movsFiltrati.map((m: any) => <MovimentoCard key={m.id} movimento={m} onChanged={() => qc.invalidateQueries({ queryKey: ["mov-bancari"] })} />)}
      </CardContent>
    </Card>
  );
};

// === Card movimento espandibile ===
type PolizzaSel = {
  clienteId: string;
  clienteLabel: string;
  numeroTitolo: string;
  ramo: string;
  compagnia: string;
  premio: number;
  importo: number;
};

const MovimentoCard = ({ movimento: movimentoProp, onChanged }: { movimento: any; onChanged: () => void }) => {
  const { profile } = useAuth();
  const scopeUfficioId = shouldScopeClientiPerSede(profile?.ruolo, profile?.ufficio_id)
    ? profile!.ufficio_id!
    : null;

  const [movimento, setMovimento] = useState(movimentoProp);
  useEffect(() => { setMovimento(movimentoProp); }, [movimentoProp]);

  const [open, setOpen] = useState(false);
  const cliNome = movimento.cliente?.ragione_sociale || [movimento.cliente?.nome, movimento.cliente?.cognome].filter(Boolean).join(" ") || "—";
  const pagatore = (movimento.ordinante || "").trim() || cliNome;

  const [pagatoreSearch, setPagatoreSearch] = useState("");
  const [pagatoreDebounced, setPagatoreDebounced] = useState("");
  const [assegnaPagatoreLoading, setAssegnaPagatoreLoading] = useState(false);
  const [pagatoreSelId, setPagatoreSelId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setPagatoreDebounced(pagatoreSearch), 350);
    return () => clearTimeout(t);
  }, [pagatoreSearch]);

  const { data: clientiPagatore = [] } = useQuery({
    queryKey: ["clienti-pagatore-mov", pagatoreDebounced, scopeUfficioId],
    enabled: open && !movimento.cliente_id && pagatoreDebounced.length >= 2,
    queryFn: async () => {
      let q = supabase.from("clienti")
        .select("id, ragione_sociale, nome, cognome, ufficio_id")
        .or(`ragione_sociale.ilike.%${pagatoreDebounced}%,cognome.ilike.%${pagatoreDebounced}%,nome.ilike.%${pagatoreDebounced}%`)
        .limit(25);
      if (scopeUfficioId) q = q.eq("ufficio_id", scopeUfficioId);
      const { data } = await q;
      return (data as any[]) ?? [];
    },
  });

  // Polizze attive del cliente pre-matchato (per la tabella principale)
  const { data: polizze = [] } = useQuery({
    queryKey: ["polizze-cliente", movimento.cliente_id],
    enabled: open && !!movimento.cliente_id,
    queryFn: () => fetchTitoliClienteDaIncassare(movimento.cliente_id!),
  });

  // Ricongiungimenti già salvati: TUTTE le righe movimenti_clienti del movimento (multi-cliente)
  const { data: esistenti = [] } = useQuery({
    queryKey: ["mov-clienti-by-mov", movimento.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("movimenti_clienti" as any)
        .select("id, cliente_id, importo_assegnato, anticipo, ammanco, note, cliente:clienti(id, ragione_sociale, nome, cognome), movimenti_polizze(id, titolo_id, importo, tipo, cliente_id, pagato_da, messo_a_cassa, data_messa_cassa)")
        .eq("movimento_id", movimento.id);
      return (data as any[]) ?? [];
    },
  });

  // Stato locale
  const [selPol, setSelPol] = useState<Record<string, PolizzaSel>>({});
  const [anticipo, setAnticipo] = useState(0);
  const [ammanco, setAmmanco] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [cassaOpen, setCassaOpen] = useState(false);
  const [cassaTitoli, setCassaTitoli] = useState<any[]>([]);
  const [cassaImporti, setCassaImporti] = useState<Record<string, number>>({});
  const [garantitoOpen, setGarantitoOpen] = useState(false);
  const [garantitoTitoli, setGarantitoTitoli] = useState<any[]>([]);
  const [anticipoDrawerId, setAnticipoDrawerId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Anticipi residui del cliente
  const { data: anticipiMap } = useAnticipiResiduoByClienti(
    open && movimento.cliente_id ? [movimento.cliente_id] : []
  );
  const anticipoSummary = movimento.cliente_id ? anticipiMap?.get(movimento.cliente_id) : null;

  // Pre-popola da esistenti
  useEffect(() => {
    if (!esistenti || esistenti.length === 0) return;
    const map: Record<string, PolizzaSel> = {};
    let antTot = 0, ammTot = 0;
    const notesArr: string[] = [];
    for (const mc of esistenti) {
      antTot += Number(mc.anticipo) || 0;
      ammTot += Number(mc.ammanco) || 0;
      if (mc.note) notesArr.push(mc.note);
      const cLabel = mc.cliente?.ragione_sociale || [mc.cliente?.nome, mc.cliente?.cognome].filter(Boolean).join(" ") || "—";
      for (const mp of (mc.movimenti_polizze ?? [])) {
        if (mp.tipo === "polizza" && mp.titolo_id) {
          map[mp.titolo_id] = {
            clienteId: mp.cliente_id || mc.cliente_id,
            clienteLabel: cLabel,
            numeroTitolo: "",
            ramo: "—",
            compagnia: "—",
            premio: 0,
            importo: Number(mp.importo) || 0,
          };
        }
      }
    }
    setSelPol(map);
    setAnticipo(antTot);
    setAmmanco(ammTot);
    setNote(notesArr.join(" · "));
  }, [esistenti]);

  // Arricchisce le righe esistenti con i metadati del titolo (numero/ramo/compagnia/premio)
  useEffect(() => {
    const idsToFetch = Object.entries(selPol)
      .filter(([_, v]) => !v.numeroTitolo)
      .map(([id]) => id);
    if (idsToFetch.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, ramo:rami(descrizione), compagnia:compagnie(nome)" as any)
        .in("id", idsToFetch);
      if (!data) return;
      setSelPol((prev) => {
        const next = { ...prev };
        for (const t of data as any[]) {
          if (next[t.id]) {
            next[t.id] = {
              ...next[t.id],
              numeroTitolo: t.numero_titolo || "",
              ramo: t.ramo?.descrizione ?? "—",
              compagnia: t.compagnia?.nome ?? "—",
              premio: Number(t.premio_lordo) || 0,
            };
          }
        }
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(selPol).join(",")]);

  const totalePolizze = useMemo(
    () => round2(Object.values(selPol).reduce((s, v) => s + (Number(v.importo) || 0), 0)),
    [selPol]
  );
  const totale = round2(totalePolizze + (Number(anticipo) || 0) + (Number(ammanco) || 0));
  const delta = round2((Number(movimento.importo) || 0) - totale);
  const quadra = Math.abs(delta) < TOLL;

  const togglePolPreMatched = (p: any) => {
    setSelPol((prev) => {
      if (p.id in prev) { const { [p.id]: _, ...rest } = prev; return rest; }
      return {
        ...prev,
        [p.id]: {
          clienteId: movimento.cliente_id,
          clienteLabel: cliNome,
          numeroTitolo: p.numero_titolo || "",
          ramo: p.ramo?.descrizione ?? "—",
          compagnia: p.compagnia?.nome ?? "—",
          premio: Number(p.premio_lordo) || 0,
          importo: Number(p.premio_lordo) || 0,
        },
      };
    });
  };

  const updateImporto = (id: string, v: number) => {
    setSelPol((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], importo: v } } : prev);
  };

  const removeRiga = (id: string) => {
    setSelPol((prev) => { const { [id]: _, ...rest } = prev; return rest; });
  };

  const onAggiungiPolizze = (rows: PolizzaAggiunta[]) => {
    setSelPol((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        next[r.titoloId] = {
          clienteId: r.clienteId,
          clienteLabel: r.clienteLabel,
          numeroTitolo: r.numeroTitolo,
          ramo: r.ramo,
          compagnia: r.compagnia,
          premio: r.premio,
          importo: r.importo,
        };
      }
      return next;
    });
  };

  // Polizze extra = quelle in selPol che NON appartengono al cliente pre-matchato
  const extraEntries = useMemo(
    () => Object.entries(selPol).filter(([, v]) => v.clienteId !== movimento.cliente_id),
    [selPol, movimento.cliente_id]
  );
  // Raggruppa extra per cliente
  const extraByCliente = useMemo(() => {
    const map = new Map<string, { clienteLabel: string; rows: Array<[string, PolizzaSel]> }>();
    for (const e of extraEntries) {
      const [, v] = e;
      const g = map.get(v.clienteId) ?? { clienteLabel: v.clienteLabel, rows: [] };
      g.rows.push(e);
      map.set(v.clienteId, g);
    }
    return Array.from(map.entries());
  }, [extraEntries]);

  const salvaRicongiungimento = async (): Promise<boolean> => {
    if (totale <= 0) { toast.error("Inserisci almeno una voce"); return false; }
    if (!quadra) { toast.error(`La quadratura non torna: delta ${fmtEuro(delta)}`); return false; }
    setSaving(true);
    try {
      // Cancella tutti i ricongiungimenti esistenti per questo movimento (cascade su movimenti_polizze)
      await supabase.from("movimenti_clienti" as any).delete().eq("movimento_id", movimento.id);

      // Raggruppa selPol per cliente_id
      const byCliente = new Map<string, Array<[string, PolizzaSel]>>();
      for (const [titoloId, v] of Object.entries(selPol)) {
        const arr = byCliente.get(v.clienteId) ?? [];
        arr.push([titoloId, v]);
        byCliente.set(v.clienteId, arr);
      }
      // Garantisce che il cliente pre-matchato esista (per ospitare anticipo/ammanco) anche senza polizze
      if (movimento.cliente_id && !byCliente.has(movimento.cliente_id) && (anticipo > 0 || ammanco > 0)) {
        byCliente.set(movimento.cliente_id, []);
      }

      const clienteIds = Array.from(byCliente.keys());

      for (const cid of clienteIds) {
        const righePol = byCliente.get(cid) ?? [];
        const importoPol = round2(righePol.reduce((s, [, v]) => s + (Number(v.importo) || 0), 0));
        // Anticipo/Ammanco li mettiamo solo sul cliente pre-matchato (o sul primo se nessun pre-matched)
        const isPrimario = (cid === movimento.cliente_id) || (!movimento.cliente_id && cid === clienteIds[0]);
        const ant = isPrimario ? anticipo : 0;
        const amm = isPrimario ? ammanco : 0;
        const importoAssegnato = round2(importoPol + ant + amm);

        const { data: mcIns, error: mcErr } = await supabase.from("movimenti_clienti" as any).insert({
          movimento_id: movimento.id,
          cliente_id: cid,
          ufficio_id: movimento.ufficio_id,
          importo_assegnato: importoAssegnato,
          anticipo: ant,
          ammanco: amm,
          note: isPrimario && note ? note : null,
        } as any).select("id").single();
        if (mcErr) throw mcErr;
        const mcId = (mcIns as any).id;

        const righe: any[] = [];
        for (const [titoloId, v] of righePol) {
          if ((Number(v.importo) || 0) > 0) {
            righe.push({
              movimento_cliente_id: mcId,
              titolo_id: titoloId,
              cliente_id: cid,
              importo: v.importo,
              tipo: "polizza",
              pagato_da: pagatore,
            });
          }
        }
        if (isPrimario && ant > 0) righe.push({ movimento_cliente_id: mcId, titolo_id: null, cliente_id: cid, importo: ant, tipo: "anticipo", pagato_da: pagatore });
        if (isPrimario && amm > 0) righe.push({ movimento_cliente_id: mcId, titolo_id: null, cliente_id: cid, importo: amm, tipo: "ammanco", pagato_da: pagatore });
        if (righe.length > 0) {
          const { error } = await supabase.from("movimenti_polizze" as any).insert(righe);
          if (error) throw error;
        }
      }

      await supabase.from("movimenti_bancari" as any).update({ stato: "ricongiunti" } as any).eq("id", movimento.id);

      await notificaSedeMovimentoBancario({
        evento: "ricongiunto",
        movimentoId: movimento.id,
        ufficioId: movimento.ufficio_id,
        importo: Number(movimento.importo) || 0,
        clienteLabel: cliNome,
        statoNuovo: "ricongiunti",
        note: `${Object.keys(selPol).length} polizze · ${clienteIds.length} client${clienteIds.length === 1 ? "e" : "i"}`,
      });

      const nClienti = clienteIds.length;
      const nPol = Object.keys(selPol).length;
      toast.success(
        nClienti > 1
          ? `${nPol} polizze collegate (${nClienti} clienti) · Pagatore: ${pagatore}`
          : `${nPol} polizza/e collegata/e al movimento`
      );
      onChanged();
      return true;
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAssegnaPagatore = async () => {
    if (!pagatoreSelId) { toast.error("Seleziona il cliente pagatore"); return; }
    const cli = (clientiPagatore as any[]).find((c) => c.id === pagatoreSelId);
    setAssegnaPagatoreLoading(true);
    try {
      await assegnaPagatoreMovimento(movimento.id, pagatoreSelId, cli?.ufficio_id ?? movimento.ufficio_id ?? null);
      const label = cli?.ragione_sociale || [cli?.nome, cli?.cognome].filter(Boolean).join(" ") || "—";
      setMovimento((m: any) => ({
        ...m,
        cliente_id: pagatoreSelId,
        ufficio_id: cli?.ufficio_id ?? m.ufficio_id,
        stato: "assegnato",
        cliente: { id: pagatoreSelId, ragione_sociale: cli?.ragione_sociale, nome: cli?.nome, cognome: cli?.cognome },
      }));
      toast.success(`Pagatore assegnato: ${label}`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Errore assegnazione pagatore");
    } finally {
      setAssegnaPagatoreLoading(false);
    }
  };

  // === Metti a Cassa ===
  const apriMessaCassa = async () => {
    if (!movimento.cliente_id) { toast.error("Assegna il pagatore (cliente pre-matchato) prima di mettere a cassa"); return; }
    if (!quadra) { toast.error(`Non quadra: delta ${fmtEuro(delta)}`); return; }
    const saved = await salvaRicongiungimento();
    if (!saved) return;
    const titoliIds = Object.entries(selPol).filter(([, v]) => (Number(v.importo) || 0) > 0).map(([id]) => id);
    if (titoliIds.length === 0) { toast.error("Nessuna polizza selezionata"); return; }
    const importoByTitoloId = Object.fromEntries(
      Object.entries(selPol).filter(([, v]) => (Number(v.importo) || 0) > 0).map(([id, v]) => [id, Number(v.importo) || 0])
    );
    const { data: titoli, error } = await supabase
      .from("titoli")
      .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id, importo_incassato")
      .in("id", titoliIds);
    if (error) { toast.error(error.message); return; }
    setCassaTitoli(titoli ?? []);
    setCassaImporti(importoByTitoloId);
    setCassaOpen(true);
  };

  const apriGarantito = async () => {
    if (!movimento.cliente_id) { toast.error("Assegna il pagatore prima di procedere"); return; }
    if (!quadra) { toast.error(`Non quadra: delta ${fmtEuro(delta)}`); return; }
    const saved = await salvaRicongiungimento();
    if (!saved) return;
    const titoliIds = Object.entries(selPol).filter(([, v]) => (Number(v.importo) || 0) > 0).map(([id]) => id);
    if (titoliIds.length === 0) { toast.error("Nessuna polizza selezionata"); return; }
    const { data: titoli, error } = await supabase
      .from("titoli")
      .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id")
      .in("id", titoliIds);
    if (error) { toast.error(error.message); return; }
    setGarantitoTitoli(titoli ?? []);
    setGarantitoOpen(true);
  };

  const onCassaSuccess = async (dataMessaCassa: string) => {
    const { data: mcs } = await supabase.from("movimenti_clienti" as any)
      .select("id, anticipo, ammanco")
      .eq("movimento_id", movimento.id);
    const mcRows = (mcs as any[]) ?? [];
    const mcIds = mcRows.map((r) => r.id);
    let polizzeLineIds: string[] = [];
    if (mcIds.length > 0) {
      const { data: mps } = await supabase.from("movimenti_polizze" as any)
        .select("id, tipo")
        .in("movimento_cliente_id", mcIds)
        .eq("tipo", "polizza");
      polizzeLineIds = ((mps as any[]) ?? []).map((r) => r.id);
    }
    const antTot = mcRows.reduce((s, r) => s + (Number(r.anticipo) || 0), 0);
    const ammTot = mcRows.reduce((s, r) => s + (Number(r.ammanco) || 0), 0);
    const { data: userResp } = await supabase.auth.getUser();
    await finalizeMovimentoBancarioIncasso({
      movimentoId: movimento.id,
      clienteId: movimento.cliente_id,
      contoBancarioId: movimento.conto_bancario_id ?? null,
      dataMessaCassa,
      anticipoImporto: antTot,
      ammancoImporto: ammTot,
      polizzeLineIds,
      userId: userResp.user?.id ?? null,
      note: note || null,
    });

    await notificaSedeMovimentoBancario({
      evento: "messo_a_cassa",
      movimentoId: movimento.id,
      ufficioId: movimento.ufficio_id,
      importo: Number(movimento.importo) || 0,
      clienteLabel: cliNome,
      statoNuovo: "incassato",
      note: `${cassaTitoli.length} polizze`,
    });
    toast.success(`Messa a cassa completata: ${cassaTitoli.length} polizze`);
    setCassaOpen(false);
    onChanged();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/40 flex items-center justify-between">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Data: </span>
                <span className="font-medium" title="gg/mm/aaaa">{formatDateIT(movimento.data_movimento)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ordinante: </span>
                <span className="font-medium">
                  {(movimento.ordinante || "").trim() ||
                    extractOrdinanteFromDescrizione(movimento.descrizione || "") ||
                    "—"}
                </span>
              </div>
              <div><span className="text-muted-foreground">Cliente: </span><span className="font-medium">{cliNome}</span></div>
              <div className="text-right md:text-left"><span className="text-muted-foreground">Importo: </span><span className="font-bold tabular-nums">{fmtEuro(movimento.importo)}</span></div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Badge variant={movimento.stato === "ricongiunti" ? "outline" : "default"}>{movimento.stato}</Badge>
              <ChevronDown className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t space-y-4 pt-4">
            {/* Cliente pre-matchato + pagatore */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cliente pre-matchato (pagatore)</h4>
                  {movimento.cliente_id ? (
                    <Link to={`/archivi/clienti/${movimento.cliente_id}`} className="text-sm text-primary underline flex items-center gap-1">
                      {cliNome} <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 max-w-md">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Obbligatorio prima della chiusura: indica chi ha pagato il bonifico.
                      </p>
                      <SearchableSelect
                        options={(clientiPagatore as any[]).map((c) => ({
                          value: c.id,
                          label: c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(" "),
                        }))}
                        value={pagatoreSelId}
                        onValueChange={setPagatoreSelId}
                        onSearchChange={setPagatoreSearch}
                        placeholder="Cerca cliente pagatore…"
                      />
                      <Button size="sm" onClick={handleAssegnaPagatore} disabled={assegnaPagatoreLoading || !pagatoreSelId}>
                        Cliente
                      </Button>
                    </div>
                  )}
                </div>
                {movimento.conto?.etichetta && (
                  <p className="text-xs text-muted-foreground">Conto: <span className="font-medium text-foreground">{movimento.conto.etichetta}</span></p>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Ordinante banca: <span className="font-medium text-foreground">{pagatore}</span>
              </div>
            </div>

            {/* Anticipi disponibili cliente */}
            {anticipoSummary && anticipoSummary.totale > 0 && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-emerald-800 dark:text-emerald-300">
                    Acconti disponibili: <strong className="tabular-nums">{fmtEuro(anticipoSummary.totale)}</strong>
                    {" "}({anticipoSummary.conteggio} accont{anticipoSummary.conteggio === 1 ? "o" : "i"})
                  </span>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs text-emerald-700 dark:text-emerald-400"
                    onClick={() => setAnticipoDrawerId(anticipoSummary.primoAnticipoId)}
                  >
                    Vedi dettagli
                  </Button>
                </div>
                <Button
                  size="sm" variant="outline"
                  className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                  onClick={() => {
                    const residuoMov = round2(Math.max(0, (Number(movimento.importo) || 0) - totalePolizze));
                    const da_usare = round2(Math.min(anticipoSummary.totale, residuoMov));
                    setAnticipo(da_usare);
                    if (da_usare <= 0) toast.info("Nessun importo da coprire con l'acconto");
                  }}
                >
                  Usa qui
                </Button>
              </div>
            )}

            {/* Polizze del cliente pre-matchato */}
            {movimento.cliente_id && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Polizze attive di {cliNome}</h4>
                {polizze.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna polizza in carico per questo cliente.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Numero</TableHead><TableHead>Garanzia</TableHead><TableHead>Compagnia</TableHead>
                      <TableHead className="text-right">Premio</TableHead><TableHead className="text-right w-32">Importo da collegare</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {polizze.map((p: any, i: number) => {
                        const sel = p.id in selPol;
                        const lordo = Number(p.premio_lordo) || 0;
                        return (
                          <TableRow key={p.id} className={i % 2 ? "bg-muted/30" : ""}>
                            <TableCell><Checkbox checked={sel} onCheckedChange={() => togglePolPreMatched(p)} /></TableCell>
                            <TableCell className="text-sm">{p.numero_titolo}</TableCell>
                            <TableCell className="text-sm">{p.ramo?.descrizione ?? "—"}</TableCell>
                            <TableCell className="text-sm">{p.compagnia?.nome ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">{fmtEuro(lordo)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                disabled={!sel} type="number" step="0.01"
                                value={sel ? selPol[p.id].importo : ""}
                                onChange={(e) => updateImporto(p.id, Number(e.target.value) || 0)}
                                className="h-8 w-28 text-right tabular-nums"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {/* Polizze di altri clienti (multi-cliente) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Polizze di altri clienti {extraByCliente.length > 0 && <span className="ml-1 text-foreground">({extraEntries.length})</span>}
                </h4>
                <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Aggiungi polizza di altro cliente
                </Button>
              </div>
              {extraByCliente.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nessuna polizza di altri clienti collegata a questo bonifico.</p>
              ) : (
                <div className="space-y-3">
                  {extraByCliente.map(([cid, group]) => (
                    <div key={cid} className="border rounded-md p-2">
                      <div className="text-xs font-medium mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> {group.clienteLabel}
                      </div>
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Numero</TableHead><TableHead>Garanzia</TableHead><TableHead>Compagnia</TableHead>
                          <TableHead className="text-right">Premio</TableHead><TableHead className="text-right w-32">Importo</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {group.rows.map(([id, v], i) => (
                            <TableRow key={id} className={i % 2 ? "bg-muted/30" : ""}>
                              <TableCell className="text-sm">{v.numeroTitolo || "—"}</TableCell>
                              <TableCell className="text-sm">{v.ramo}</TableCell>
                              <TableCell className="text-sm">{v.compagnia}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{fmtEuro(v.premio)}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number" step="0.01"
                                  value={v.importo}
                                  onChange={(e) => updateImporto(id, Number(e.target.value) || 0)}
                                  className="h-8 w-28 text-right tabular-nums"
                                />
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeRiga(id)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anticipi / Ammanchi */}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Acconto (€)</Label>
                <Input type="number" step="0.01" value={anticipo || ""} onChange={(e) => setAnticipo(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Ammanco (€)</Label>
                <Input type="number" step="0.01" value={ammanco || ""} onChange={(e) => setAmmanco(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {/* Quadratura */}
            <div className={`p-3 rounded-md flex justify-between text-sm ${quadra ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
              <span>Totale assegnato: <strong className="tabular-nums">{fmtEuro(totale)}</strong> · Movimento: <strong className="tabular-nums">{fmtEuro(movimento.importo)}</strong></span>
              <span>{quadra ? "✓ Quadra" : `Delta: ${fmtEuro(delta)}`}</span>
            </div>

            {/* Azioni */}
            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="outline" onClick={salvaRicongiungimento} disabled={saving || !quadra}>
                <Save className="w-4 h-4 mr-1" /> Salva
              </Button>
              <Button
                variant="outline"
                onClick={apriGarantito}
                disabled={!quadra || !movimento.cliente_id}
                className="border-orange-400 text-orange-700 hover:bg-orange-50"
                title="Incasso garantito (senza fondi in cassa)"
              >
                <Shield className="w-4 h-4 mr-1" /> Garantito
              </Button>
              <Button onClick={apriMessaCassa} disabled={!quadra || !movimento.cliente_id}>
                <Wallet className="w-4 h-4 mr-1" /> Incassa
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
      <MessaCassaDialog
        open={cassaOpen}
        onOpenChange={setCassaOpen}
        titoli={cassaTitoli}
        bankIncasso={{
          movimentoId: movimento.id,
          contoBancarioId: movimento.conto_bancario_id ?? null,
          dataMovimento: movimento.data_movimento,
          importoByTitoloId: cassaImporti,
        }}
        onSuccess={(dataMessaCassa) => onCassaSuccess(dataMessaCassa)}
      />
      <GarantitoDialog
        open={garantitoOpen}
        onOpenChange={setGarantitoOpen}
        titoli={garantitoTitoli}
        onSuccess={async () => {
          setCassaTitoli(garantitoTitoli);
          await onCassaSuccess(new Date().toISOString().slice(0, 10));
        }}
      />
      <AnticipoUtilizziDrawer
        anticipoId={anticipoDrawerId}
        onClose={() => setAnticipoDrawerId(null)}
      />
      <AggiungiPolizzaAltroClienteDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        excludeTitoloIds={Object.keys(selPol)}
        onConfirm={onAggiungiPolizze}
      />
    </Collapsible>
  );
};

type StoricoMovimento = {
  id: string;
  data_movimento?: string | null;
  importo?: number | null;
  ordinante?: string | null;
  cliente?: { ragione_sociale?: string | null; nome?: string | null; cognome?: string | null } | null;
  ufficio?: { nome?: string | null } | null;
};

type PolizzaCollegataRow = {
  titolo_id: string | null;
  importo: number | null;
  numero_titolo: string | null;
  stato: string | null;
};

// === Tab: Storico ===
export const StoricoTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const qc = useQueryClient();
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [cliente, setCliente] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [ordinanteDebounced, setOrdinanteDebounced] = useState("");
  const [importo, setImporto] = useState("");
  const [sortDataAsc, setSortDataAsc] = useState(false);
  const [annullaTarget, setAnnullaTarget] = useState<StoricoMovimento | null>(null);
  const [annullaLoading, setAnnullaLoading] = useState(false);
  const [polizzeCollegate, setPolizzeCollegate] = useState<PolizzaCollegataRow[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrdinanteDebounced(ordinante), 350);
    return () => clearTimeout(t);
  }, [ordinante]);

  // ordinante → server (ilike ordinante|descrizione); importo + cliente → client sul set completo
  const { data: movs = [], isLoading: storicoLoading } = useQuery({
    queryKey: ["mov-bancari", "storico", profileUfficio, seeAll, dal, al, ordinanteDebounced, sortDataAsc],
    queryFn: async () => {
      const contoIds =
        !seeAll && profileUfficio ? await fetchContoIdsForUfficio(profileUfficio) : ([] as string[]);
      const ordTerm = sanitizeIlikeTerm(ordinanteDebounced);
      return fetchAllQueryPages<any>(async (from, to) => {
        let q = supabase.from("movimenti_bancari" as any)
          .select("id, data_movimento, importo, ordinante, descrizione, ufficio_id, conto_bancario_id, cliente:clienti(id, ragione_sociale, nome, cognome), ufficio:uffici(nome:nome_ufficio)")
          .eq("stato", "incassato")
          .order("data_movimento", { ascending: sortDataAsc })
          .order("id", { ascending: sortDataAsc });
        if (!seeAll && profileUfficio) {
          if (contoIds.length > 0) {
            q = q.or(`ufficio_id.eq.${profileUfficio},conto_bancario_id.in.(${contoIds.join(",")})`);
          } else {
            q = q.eq("ufficio_id", profileUfficio);
          }
        }
        if (dal) q = q.gte("data_movimento", dal);
        if (al) q = q.lte("data_movimento", al);
        if (ordTerm) q = q.or(`ordinante.ilike.%${ordTerm}%,descrizione.ilike.%${ordTerm}%`);
        return q.range(from, to);
      });
    },
  });

  const movsFiltrati = useMemo(() => {
    let rows = filterMovimentiByOrdinanteImporto(movs, "", importo);
    if (cliente) {
      const c = cliente.toLowerCase();
      rows = rows.filter((m) => {
        const n = (m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "").toLowerCase();
        return n.includes(c);
      });
    }
    return rows;
  }, [movs, importo, cliente]);

  const exportXlsx = () => {
    const rows = movsFiltrati.map((m: any) => ({
      Data: formatDateIT(m.data_movimento),
      Ordinante: m.ordinante || "",
      Cliente: m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "",
      Ufficio: m.ufficio?.nome || "",
      Importo: Number(m.importo) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Storico");
    XLSX.writeFile(wb, `storico-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const apriAnnullaDialog = async (m: StoricoMovimento) => {
    setAnnullaTarget(m);
    setPolizzeCollegate([]);
    setPolizzeLoading(true);
    try {
      const { data: mcs } = await supabase
        .from("movimenti_clienti" as any)
        .select("id")
        .eq("movimento_id", m.id);
      const mcIds = ((mcs as any[]) ?? []).map((r) => r.id);
      if (mcIds.length === 0) {
        setPolizzeCollegate([]);
        return;
      }
      const { data: mps, error } = await supabase
        .from("movimenti_polizze" as any)
        .select("titolo_id, importo, titolo:titoli(numero_titolo, stato)")
        .in("movimento_cliente_id", mcIds)
        .eq("tipo", "polizza");
      if (error) throw error;
      setPolizzeCollegate(
        ((mps as any[]) ?? []).map((r) => ({
          titolo_id: r.titolo_id,
          importo: r.importo,
          numero_titolo: r.titolo?.numero_titolo ?? null,
          stato: r.titolo?.stato ?? null,
        })),
      );
    } catch (e: any) {
      toast.error(e.message ?? "Errore caricamento polizze collegate");
    } finally {
      setPolizzeLoading(false);
    }
  };

  const confermaAnnulla = async () => {
    if (!annullaTarget) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaBonificoCollegato(annullaTarget.id);
      if (!res.ok) {
        toast.error(res.error || "Annullamento fallito");
        return;
      }
      toast.success(
        `Bonifico ripristinato in Da collegare${res.clienteRimosso ? " · cliente pagatore rimosso" : ""} · ${res.titoliAnnullati ?? 0} incass${(res.titoliAnnullati ?? 0) === 1 ? "o" : "i"} annullat${(res.titoliAnnullati ?? 0) === 1 ? "o" : "i"}${(res.titoliSaltati ?? 0) > 0 ? ` · ${res.titoliSaltati} titoli non più presenti` : ""}`,
      );
      setAnnullaTarget(null);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
      qc.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      qc.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      qc.invalidateQueries({ queryKey: ["dashboard-ufficio"] });
    } finally {
      setAnnullaLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <FiltriMovimentiRow
          dal={dal}
          setDal={setDal}
          al={al}
          setAl={setAl}
          ordinante={ordinante}
          setOrdinante={setOrdinante}
          importo={importo}
          setImporto={setImporto}
          sortDataAsc={sortDataAsc}
          setSortDataAsc={setSortDataAsc}
        >
          <div>
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cerca…" className="w-56" />
          </div>
          <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="w-3 h-3 mr-1" />Export Excel</Button>
        </FiltriMovimentiRow>
        {!storicoLoading && (
          <p className="text-sm text-muted-foreground pt-2">
            {movsFiltrati.length === 1 ? "1 movimento" : `${movsFiltrati.length} movimenti`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {storicoLoading ? (
          <p className="text-sm py-6 text-center">Caricamento…</p>
        ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead title="gg/mm/aaaa">Data <span className="font-normal text-muted-foreground text-xs">(gg/mm/aaaa)</span></TableHead>
            <TableHead>Ordinante</TableHead><TableHead>Cliente</TableHead>
            <TableHead>Ufficio</TableHead><TableHead className="text-right">Importo</TableHead>
            <TableHead className="w-36 text-right">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {movsFiltrati.map((m: any, i: number) => (
              <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                <TableCell title="gg/mm/aaaa">{formatDateIT(m.data_movimento)}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{m.ordinante || "—"}</TableCell>
                <TableCell className="text-sm">{m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => apriAnnullaDialog(m)}
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Annulla
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {movsFiltrati.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
          </TableBody>
        </Table>
        )}
      </CardContent>

      <AlertDialog open={!!annullaTarget} onOpenChange={(v) => !v && !annullaLoading && setAnnullaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annulla bonifico collegato</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Verranno annullati gli incassi delle polizze collegate (come «Annulla messa a cassa»), verrà rimosso il cliente pagatore assegnato e il bonifico tornerà in <strong className="text-foreground">Da collegare</strong> come appena importato.
                </p>
                {annullaTarget && (
                  <div className="rounded-md border p-3 space-y-1 text-foreground">
                    <div><span className="text-muted-foreground">Data (gg/mm/aaaa):</span>{" "}
                      <span title="gg/mm/aaaa">{formatDateIT(annullaTarget.data_movimento)}</span>
                    </div>
                    <div><span className="text-muted-foreground">Ordinante:</span> {annullaTarget.ordinante || "—"}</div>
                    <div><span className="text-muted-foreground">Importo:</span> {fmtEuro(annullaTarget.importo)}</div>
                  </div>
                )}
                {polizzeLoading ? (
                  <p>Caricamento polizze collegate…</p>
                ) : polizzeCollegate.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {polizzeCollegate.map((p, idx) => (
                      <li key={p.titolo_id ?? idx}>
                        {p.numero_titolo || p.titolo_id || "Titolo eliminato"} — {fmtEuro(p.importo)}
                        {p.stato ? ` (${p.stato})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">Nessuna polizza collegata trovata: verranno rimossi cliente pagatore e collegamenti, il bonifico tornerà in Da collegare.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Chiudi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={annullaLoading}
              onClick={(e) => {
                e.preventDefault();
                void confermaAnnulla();
              }}
            >
              {annullaLoading ? "Annullamento…" : "Conferma annullamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default Page;
