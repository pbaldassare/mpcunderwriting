import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTitoliClienteDaIncassare } from "@/lib/titoliDaIncassare";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fmtEuro } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { shouldScopeClientiPerSede } from "@/lib/filterContiBancariPerSede";

export interface PolizzaAggiunta {
  titoloId: string;
  clienteId: string;
  clienteLabel: string;
  numeroTitolo: string;
  ramo: string;
  compagnia: string;
  premio: number;
  importo: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  excludeTitoloIds: string[];
  onConfirm: (rows: PolizzaAggiunta[]) => void;
}

export function AggiungiPolizzaAltroClienteDialog({ open, onOpenChange, excludeTitoloIds, onConfirm }: Props) {
  const { profile } = useAuth();
  const scopeUfficioId = shouldScopeClientiPerSede(profile?.ruolo, profile?.ufficio_id)
    ? profile!.ufficio_id!
    : null;
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clienti, setClienti] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [polizze, setPolizze] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<string, number>>({});
  const [loadingPol, setLoadingPol] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebounced(""); setClienti([]); setClienteId(""); setPolizze([]); setSel({});
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open || debounced.length < 2) { setClienti([]); return; }
    let cancel = false;
    (async () => {
      const q = debounced.trim();
      let query = supabase
        .from("clienti")
        .select("id, ragione_sociale, nome, cognome, codice_fiscale, partita_iva")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,nome.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .limit(25);
      if (scopeUfficioId) query = query.eq("ufficio_id", scopeUfficioId);
      const { data } = await query;
      if (!cancel) setClienti(data ?? []);
    })();
    return () => { cancel = true; };
  }, [debounced, open, scopeUfficioId]);

  const clienteLabel = (c: any) => c.ragione_sociale || [c.cognome, c.nome].filter(Boolean).join(" ") || "—";

  const clientiOptions = useMemo(() => clienti.map((c) => ({
    value: c.id,
    label: clienteLabel(c),
    description: [c.codice_fiscale, c.partita_iva].filter(Boolean).join(" · "),
  })), [clienti]);

  useEffect(() => {
    if (!clienteId) { setPolizze([]); setSel({}); return; }
    setLoadingPol(true);
    (async () => {
      try {
        const data = await fetchTitoliClienteDaIncassare(clienteId);
        const rows = data.filter((p) => !excludeTitoloIds.includes(p.id));
        setPolizze(rows as any[]);
      } catch (error: any) {
        toast.error(error.message ?? "Errore caricamento polizze");
        setPolizze([]);
      } finally {
        setLoadingPol(false);
      }
    })();
  }, [clienteId, excludeTitoloIds]);

  const toggle = (id: string, suggested: number) => {
    setSel((p) => { if (id in p) { const { [id]: _, ...r } = p; return r; } return { ...p, [id]: suggested }; });
  };

  const conferma = () => {
    const cli = clienti.find((c) => c.id === clienteId);
    if (!cli) { toast.error("Seleziona un cliente"); return; }
    const cLabel = clienteLabel(cli);
    const rows: PolizzaAggiunta[] = polizze
      .filter((p) => p.id in sel && (Number(sel[p.id]) || 0) > 0)
      .map((p) => ({
        titoloId: p.id,
        clienteId: cli.id,
        clienteLabel: cLabel,
        numeroTitolo: p.numero_titolo,
        ramo: p.ramo?.descrizione ?? "—",
        compagnia: p.compagnia?.nome ?? "—",
        premio: Number(p.premio_lordo) || 0,
        importo: Number(sel[p.id]) || 0,
      }));
    if (rows.length === 0) { toast.error("Seleziona almeno una polizza"); return; }
    onConfirm(rows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aggiungi polizza di altro cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cerca cliente</Label>
            <SearchableSelect
              options={clientiOptions}
              value={clienteId}
              onValueChange={setClienteId}
              searchValue={search}
              onSearchChange={setSearch}
              placeholder="Ragione sociale, cognome, CF, P.IVA…"
              searchPlaceholder="Almeno 2 caratteri…"
              emptyText={debounced.length < 2 ? "Digita almeno 2 caratteri" : "Nessun cliente trovato"}
            />
          </div>

          {clienteId && (
            <div>
              <Label>Polizze attive del cliente</Label>
              {loadingPol ? <p className="text-sm text-muted-foreground py-2">Caricamento…</p> :
                polizze.length === 0 ? <p className="text-sm text-muted-foreground py-2">Nessuna polizza in carico.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Numero</TableHead><TableHead>Garanzia</TableHead><TableHead>Compagnia</TableHead>
                    <TableHead className="text-right">Premio</TableHead><TableHead className="text-right w-32">Importo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {polizze.map((p, i) => {
                      const checked = p.id in sel;
                      const lordo = Number(p.premio_lordo) || 0;
                      return (
                        <TableRow key={p.id} className={i % 2 ? "bg-muted/30" : ""}>
                          <TableCell><Checkbox checked={checked} onCheckedChange={() => toggle(p.id, lordo)} /></TableCell>
                          <TableCell className="text-sm">{p.numero_titolo}</TableCell>
                          <TableCell className="text-sm">{p.ramo?.descrizione ?? "—"}</TableCell>
                          <TableCell className="text-sm">{p.compagnia?.nome ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{fmtEuro(lordo)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              disabled={!checked} type="number" step="0.01"
                              value={checked ? sel[p.id] : ""}
                              onChange={(e) => setSel((s) => ({ ...s, [p.id]: Number(e.target.value) || 0 }))}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={conferma}>Aggiungi al bonifico</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
