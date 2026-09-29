import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ServerPagination from "@/components/ServerPagination";
const statiTitolo = ["creato", "incassato", "stornato", "annullato"];

const TitoliList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  // Form nuovo titolo
  const [numeroTitolo, setNumeroTitolo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteAnagraficaId, setClienteAnagraficaId] = useState("");
  const [clienteAnagraficaSearch, setClienteAnagraficaSearch] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [produttoreId, setProduttoreId] = useState("");
  const [premioLordo, setPremioLordo] = useState("");
  const [importoIncassato, setImportoIncassato] = useState("");
  const [dataIncasso, setDataIncasso] = useState("");
  const [stato, setStato] = useState("creato");
  const [note, setNote] = useState("");

  // Filtri ricerca polizze
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroAE, setFiltroAE] = useState("");
  const [filtroPolizza, setFiltroPolizza] = useState("");
  const [filtroStato, setFiltroStato] = useState("attive");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState("all");
  const [filtroCompagnia, setFiltroCompagnia] = useState("all");
  const [filtroRamo, setFiltroRamo] = useState("all");
  const [filtroTargaTelaio, setFiltroTargaTelaio] = useState("");
  const [filtroCigRif, setFiltroCigRif] = useState("");
  const [filtroScadenzaDal, setFiltroScadenzaDal] = useState("");
  const [filtroScadenzaAl, setFiltroScadenzaAl] = useState("");
  const [filtroGruppoStatistico, setFiltroGruppoStatistico] = useState("all");
  const [filtroProduttore, setFiltroProduttore] = useState("all");

  // Applied filters (only search on CERCA click)
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});

  const { page, setPage, pageSize, range } = useServerPagination(25, [appliedFilters]);

  const { data: prodotti = [] } = useQuery({
    queryKey: ["prodotti_attivi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prodotti").select("id, nome_prodotto, compagnia_id, compagnie(nome)").eq("attivo", true).order("nome_prodotto");
      if (error) throw error;
      return data;
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_select"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, gruppo_statistico").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, cognome, ruolo").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: clientiAnagraficaSearch = [] } = useQuery({
    queryKey: ["clienti_anagrafica_search", clienteAnagraficaSearch],
    queryFn: async () => {
      if (clienteAnagraficaSearch.length < 2) return [];
      const { data } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, codice_fiscale")
        .or(`cognome.ilike.%${clienteAnagraficaSearch}%,nome.ilike.%${clienteAnagraficaSearch}%,ragione_sociale.ilike.%${clienteAnagraficaSearch}%,codice_fiscale.ilike.%${clienteAnagraficaSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: clienteAnagraficaSearch.length >= 2,
  });

  const { data: accountExecutives = [] } = useQuery({
    queryKey: ["ae_list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, ragione_sociale, cognome, nome")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("codice");
      return data || [];
    },
  });

  const { data: titoliResult, isLoading } = useQuery({
    queryKey: ["titoli", page, appliedFilters],
    enabled: searched,
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnia_id, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome), cliente:profiles!titoli_cliente_id_fkey(nome, cognome)", { count: "exact" });

      if (appliedFilters.cliente) {
        // Search by cliente name - we filter client-side after fetch or use ilike
      }
      if (appliedFilters.polizza) {
        q = q.ilike("numero_titolo", `%${appliedFilters.polizza}%`);
      }
      if (appliedFilters.stato && appliedFilters.stato !== "all") {
        if (appliedFilters.stato === "attive") {
          q = q.in("stato", ["creato", "incassato"]);
        } else {
          q = q.eq("stato", appliedFilters.stato);
        }
      }
      if (appliedFilters.compagnia && appliedFilters.compagnia !== "all") {
        q = q.eq("prodotti.compagnia_id", appliedFilters.compagnia);
      }
      if (appliedFilters.produttore && appliedFilters.produttore !== "all") {
        q = q.eq("produttore_id", appliedFilters.produttore);
      }
      if (appliedFilters.targaTelaio) {
        q = q.ilike("targa_telaio", `%${appliedFilters.targaTelaio}%`);
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const titoli = titoliResult?.data || [];
  const totalCount = titoliResult?.count || 0;

  const handleCerca = () => {
    setAppliedFilters({
      cliente: filtroCliente,
      ae: filtroAE,
      polizza: filtroPolizza,
      stato: filtroStato,
      gruppoRamo: filtroGruppoRamo,
      compagnia: filtroCompagnia,
      ramo: filtroRamo,
      targaTelaio: filtroTargaTelaio,
      cigRif: filtroCigRif,
      scadenzaDal: filtroScadenzaDal,
      scadenzaAl: filtroScadenzaAl,
      gruppoStatistico: filtroGruppoStatistico,
      produttore: filtroProduttore,
    });
    setPage(0);
    setSearched(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        numero_titolo: numeroTitolo || null,
        cliente_id: clienteId || null,
        cliente_anagrafica_id: clienteAnagraficaId || null,
        prodotto_id: prodottoId || null,
        ufficio_id: ufficioId || null,
        produttore_id: produttoreId || null,
        premio_lordo: premioLordo ? parseFloat(premioLordo) : null,
        importo_incassato: importoIncassato ? parseFloat(importoIncassato) : null,
        data_incasso: dataIncasso || null,
        stato,
        note: note || null,
      };
      const { data, error } = await supabase.from("titoli").insert(payload).select().single();
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "creazione_titolo", entita_tipo: "titolo", entita_id: data.id, dettagli_json: { stato } });
      }
      if (stato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: data.id } });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titoli"] });
      setOpen(false);
      resetForm();
      toast.success("Titolo creato con successo");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const resetForm = () => {
    setNumeroTitolo(""); setClienteId(""); setClienteAnagraficaId(""); setClienteAnagraficaSearch("");
    setProdottoId(""); setUfficioId("");
    setProduttoreId(""); setPremioLordo(""); setImportoIncassato(""); setDataIncasso("");
    setStato("creato"); setNote("");
  };

  const statoBadgeVariant = (s: string) => {
    switch (s) {
      case "incassato": return "default";
      case "stornato": return "destructive";
      case "annullato": return "secondary";
      default: return "outline";
    }
  };

  // Gruppi statistici unici dalle agenzie
  const gruppiStatistici = [...new Set(compagnie.map(c => c.gruppo_statistico).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elenco Polizze</h1>
          <p className="text-sm text-muted-foreground">Ricerca polizze nel portafoglio</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Titolo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Titolo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Numero Titolo</Label><Input value={numeroTitolo} onChange={(e) => setNumeroTitolo(e.target.value)} /></div>
              <div>
                <Label>Prodotto</Label>
                <Select value={prodottoId} onValueChange={setProdottoId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{prodotti.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome_prodotto}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente Anagrafica</Label>
                <Input
                  placeholder="Cerca per nome, cognome, ragione sociale..."
                  value={clienteAnagraficaSearch}
                  onChange={(e) => { setClienteAnagraficaSearch(e.target.value); setClienteAnagraficaId(""); }}
                />
                {clientiAnagraficaSearch.length > 0 && !clienteAnagraficaId && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {clientiAnagraficaSearch.map((c: any) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                        onClick={() => {
                          setClienteAnagraficaId(c.id);
                          const name = c.tipo_cliente === "privato"
                            ? `${c.cognome || ""} ${c.nome || ""}`.trim()
                            : c.ragione_sociale || "—";
                          setClienteAnagraficaSearch(name);
                        }}
                      >
                        {c.tipo_cliente === "privato"
                          ? `${c.cognome || ""} ${c.nome || ""}`.trim()
                          : c.ragione_sociale || "—"}
                        <span className="text-muted-foreground ml-2">({c.tipo_cliente === "privato" ? "Privato" : "Azienda"})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Cliente (profilo utente)</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sede</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produttore</Label>
                <Select value={produttoreId} onValueChange={setProduttoreId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{profiles.filter((p) => p.ruolo === "produttore").map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Premio Lordo €</Label><Input type="number" value={premioLordo} onChange={(e) => setPremioLordo(e.target.value)} /></div>
                <div><Label>Importo Incassato €</Label><Input type="number" value={importoIncassato} onChange={(e) => setImportoIncassato(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Incasso</Label><Input type="date" value={dataIncasso} onChange={(e) => setDataIncasso(e.target.value)} /></div>
                <div>
                  <Label>Stato</Label>
                  <Select value={stato} onValueChange={setStato}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statiTitolo.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">Crea Titolo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* PARAMETRI RICERCA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Parametri Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            {/* Riga 1 */}
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Cliente</Label>
              <Input value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Nome o codice..." className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">A/E</Label>
              <Select value={filtroAE} onValueChange={setFiltroAE}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Tutti" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {accountExecutives.map((ae) => (
                    <SelectItem key={ae.id} value={ae.id}>
                      {ae.codice ? `${ae.codice} - ` : ""}{ae.ragione_sociale || ae.cognome || ae.nome || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              <Button onClick={handleCerca} className="px-8">
                <Search className="w-4 h-4 mr-2" />CERCA
              </Button>
            </div>

            {/* Riga 2 */}
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Polizza</Label>
              <Input value={filtroPolizza} onChange={(e) => setFiltroPolizza(e.target.value)} placeholder="Numero polizza..." className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Stato</Label>
              <Select value={filtroStato} onValueChange={setFiltroStato}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attive">Solo Attive</SelectItem>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  {statiTitolo.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />

            {/* Riga 3 */}
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Gruppo Ramo</Label>
              <Select value={filtroGruppoRamo} onValueChange={setFiltroGruppoRamo}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i rami</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Agenzia</Label>
              <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le agenzie</SelectItem>
                  {compagnie.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.codice ? `${c.codice} - ` : ""}{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div />

            {/* Riga 4 */}
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Garanzia</Label>
              <Select value={filtroRamo} onValueChange={setFiltroRamo}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i rami</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Targa/Telaio</Label>
              <Input value={filtroTargaTelaio} onChange={(e) => setFiltroTargaTelaio(e.target.value)} className="w-32" />
              <Label className="text-sm shrink-0 ml-2">CIG/Rif.Cl.</Label>
              <Input value={filtroCigRif} onChange={(e) => setFiltroCigRif(e.target.value)} className="flex-1" />
            </div>
            <div />

            {/* Riga 5 */}
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Scadenza dal</Label>
              <Input type="date" value={filtroScadenzaDal} onChange={(e) => setFiltroScadenzaDal(e.target.value)} className="w-36" />
              <span className="text-sm text-muted-foreground">al</span>
              <Input type="date" value={filtroScadenzaAl} onChange={(e) => setFiltroScadenzaAl(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-28 text-right text-sm shrink-0">Gruppo Stat.</Label>
              <Select value={filtroGruppoStatistico} onValueChange={setFiltroGruppoStatistico}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i gruppi</SelectItem>
                  {gruppiStatistici.map((g) => <SelectItem key={g!} value={g!}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />
          </div>
        </CardContent>
      </Card>

      {/* DETTAGLIO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Dettaglio {searched && `(${totalCount} risultati)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!searched ? (
            <p className="text-center text-muted-foreground py-12">Imposta i parametri di ricerca e premi CERCA per visualizzare i risultati</p>
          ) : isLoading ? (
            <p className="text-center text-muted-foreground py-8">Caricamento...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Polizza</TableHead>
                    <TableHead>Prodotto</TableHead>
                    <TableHead>Agenzia</TableHead>
                    <TableHead>Targa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produttore</TableHead>
                    <TableHead>Premio €</TableHead>
                    <TableHead>Incassato €</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titoli.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/titoli/${t.id}`)}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {t.numero_titolo || "—"}
                          {t.emittenda && <Badge variant="outline" className="text-[10px]">Emittenda</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>{t.prodotti?.nome_prodotto || "—"}</TableCell>
                      <TableCell className="text-sm">{t.prodotti?.compagnie?.nome || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.targa_telaio || "—"}</TableCell>
                      <TableCell>{t.cliente ? `${t.cliente.cognome || ""} ${t.cliente.nome || ""}`.trim() : "—"}</TableCell>
                      <TableCell>{t.produttore ? `${t.produttore.cognome || ""} ${t.produttore.nome || ""}`.trim() : "—"}</TableCell>
                      <TableCell className="font-mono">{t.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell className="font-mono">{t.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell><Badge variant={statoBadgeVariant(t.stato)}>{t.stato}</Badge></TableCell>
                      <TableCell>{t.data_incasso || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {titoli.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nessun risultato trovato</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TitoliList;
