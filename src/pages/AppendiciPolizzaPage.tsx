import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { PageContainer } from "@/components/shared/PageContainer";
import { AppendiceDialog } from "@/components/polizze/azioni/AppendiceDialog";
import { fetchAppendiciPolizzaForTitolo } from "@/lib/appendiciPolizza";
import { eliminaAppendice } from "@/lib/eliminaPolizza";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import { baseNumeroPolizza, isAppendice } from "@/lib/quietanze";

const TITOLO_DERIVATO_LABEL: Record<string, string> = {
  modifica: "AM",
  proroga: "PR",
  regolazione: "RG",
};

function getTitoloDerivatoId(a: {
  tipo?: string | null;
  titolo_modifica_id?: string | null;
  titolo_proroga_id?: string | null;
  titolo_regolazione_id?: string | null;
}): { id: string; label: string } | null {
  if (a.titolo_modifica_id) return { id: a.titolo_modifica_id, label: "AM" };
  if (a.titolo_proroga_id) return { id: a.titolo_proroga_id, label: "PR" };
  if (a.titolo_regolazione_id) return { id: a.titolo_regolazione_id, label: "RG" };
  if (a.tipo && TITOLO_DERIVATO_LABEL[a.tipo]) return null;
  return null;
}

const AppendiciPolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const paramPolizza = searchParams.get("polizza") || "";
  const paramClienteId = searchParams.get("clienteId") || "";
  const paramTitoloId = searchParams.get("titoloId") || "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialTipo, setInitialTipo] = useState<string | undefined>(undefined);
  const [resolvedTitoloId, setResolvedTitoloId] = useState(paramTitoloId);
  const [resolvedPolizza, setResolvedPolizza] = useState(paramPolizza);

  // Se si apre la pagina da un titolo AM/PR/RG, ancora sulla polizza madre
  useEffect(() => {
    if (!paramTitoloId) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("titoli")
        .select("id, numero_titolo, is_appendice_modifica, is_proroga, is_regolazione, sostituisce_polizza")
        .eq("id", paramTitoloId)
        .maybeSingle();
      if (cancelled || !row) return;
      if (!isAppendice(row as any)) {
        setResolvedTitoloId(paramTitoloId);
        setResolvedPolizza(paramPolizza || row.numero_titolo || "");
        return;
      }
      const madreId = await resolveTitoloMadreId(supabase, paramTitoloId);
      const { data: madre } = await supabase
        .from("titoli")
        .select("id, numero_titolo")
        .eq("id", madreId)
        .maybeSingle();
      if (cancelled) return;
      const madreNumero = madre?.numero_titolo || baseNumeroPolizza(row.numero_titolo);
      setResolvedTitoloId(madreId);
      setResolvedPolizza(madreNumero);
      if (madreId !== paramTitoloId) {
        const qs = new URLSearchParams();
        qs.set("titoloId", madreId);
        if (madreNumero) qs.set("polizza", madreNumero);
        if (paramClienteId) qs.set("clienteId", paramClienteId);
        navigate(`/portafoglio/appendici?${qs.toString()}`, { replace: true });
        toast.message("Appendici della polizza madre", {
          description: "Le nuove appendici si creano solo dalla polizza, non da un'appendice esistente.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramTitoloId, paramPolizza, paramClienteId, navigate]);

  const effectiveTitoloId = resolvedTitoloId || paramTitoloId;
  const effectivePolizza = resolvedPolizza || paramPolizza;

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-by-id-appendici", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, tipo_cliente").eq("id", paramClienteId).maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  const { data: appendici = [], isLoading: loadingAppendici } = useQuery({
    queryKey: ["appendici-polizza", effectiveTitoloId],
    queryFn: () => fetchAppendiciPolizzaForTitolo(supabase, effectiveTitoloId),
    enabled: !!effectiveTitoloId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (appendice: {
      id: string;
      file_path?: string | null;
      titolo_modifica_id?: string | null;
      titolo_proroga_id?: string | null;
      titolo_regolazione_id?: string | null;
    }) => {
      const derivato = getTitoloDerivatoId(appendice);
      if (derivato) {
        // Prima elimina il titolo cassabile (AM/PR/RG) + finanze collegate
        const res = await eliminaAppendice(derivato.id);
        if (!res.ok) throw new Error(res.error || "Errore eliminazione titolo appendice");
        // eliminaAppendice già cancella la riga appendici_polizza collegata via FK;
        // se resta (solo header senza FK), cleanup sotto.
      }

      if (appendice.file_path) {
        await supabase.storage.from("documenti_titoli").remove([appendice.file_path]);
      }

      const { data: stillThere } = await supabase
        .from("appendici_polizza")
        .select("id")
        .eq("id", appendice.id)
        .maybeSingle();

      if (stillThere) {
        const { error } = await supabase.from("appendici_polizza").delete().eq("id", appendice.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Appendice eliminata");
      queryClient.invalidateQueries({ queryKey: ["appendici-polizza", effectiveTitoloId] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
    },
    onError: (err: Error) => toast.error(err.message || "Errore nell'eliminazione"),
  });

  const handleDownload = async (filePath: string, nomeFile: string) => {
    const { data, error } = await supabase.storage.from("documenti_titoli").download(filePath);
    if (error || !data) { toast.error("Errore download"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clienteLabel = clienteData
    ? (clienteData.tipo_cliente === "privato"
      ? `${clienteData.cognome || ""} ${clienteData.nome || ""}`.trim()
      : clienteData.ragione_sociale || "—")
    : "—";

  const openNewAppendice = (tipo?: string) => {
    setInitialTipo(tipo);
    setDialogOpen(true);
  };

  return (
    <PageContainer variant="form">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appendici Polizza</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Storico appendici per la polizza {effectivePolizza}. La creazione avviene nel modale con composizione premi completa.
          </p>
        </div>
        <Button onClick={() => openNewAppendice()} disabled={!effectiveTitoloId}>
          <Plus className="w-4 h-4 mr-1" /> Nuova appendice
        </Button>
      </div>

      <PolizzaSection title="Polizza">
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{clienteLabel}</span></div>
          <div><span className="text-muted-foreground">Polizza:</span> <span className="font-mono font-medium">{effectivePolizza || "—"}</span></div>
        </div>
      </PolizzaSection>

      <AppendiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        titoloId={effectiveTitoloId || null}
        numeroTitolo={effectivePolizza}
        initialTipo={initialTipo}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["appendici-polizza", effectiveTitoloId] });
          setDialogOpen(false);
        }}
      />

      <PolizzaSection title={`Appendici (${appendici.length})`}>
        {loadingAppendici ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : appendici.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Nessuna appendice registrata per questa polizza.</p>
            <Button variant="outline" size="sm" onClick={() => openNewAppendice()} disabled={!effectiveTitoloId}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Crea la prima appendice
            </Button>
          </div>
        ) : (
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">N°</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Effetto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Premio lordo</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-24">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appendici.map((a) => {
                  const derivato = getTitoloDerivatoId(a);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono font-bold">{a.numero_appendice}</TableCell>
                      <TableCell className="text-sm">{a.data_appendice ? format(new Date(a.data_appendice), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                      <TableCell className="text-sm">{a.data_effetto ? format(new Date(a.data_effetto), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{a.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {(a as any).premio_lordo != null ? `${Number((a as any).premio_lordo).toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell>
                        {derivato ? (
                          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate(`/titoli/${derivato.id}`)}>
                            <ExternalLink className="w-3 h-3 mr-0.5" />{derivato.label}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{a.oggetto || "—"}</TableCell>
                      <TableCell>
                        {a.nome_file && a.file_path ? (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleDownload(a.file_path!, a.nome_file!)}>
                            <Download className="w-3 h-3 mr-1" />{a.nome_file}
                          </Button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title={derivato ? "Elimina appendice e titolo collegato" : "Elimina"}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                              <AlertDialogDescription>
                                {derivato
                                  ? `Eliminare l'appendice #${a.numero_appendice} e il titolo ${derivato.label} collegato? Verranno rimossi anche incassi/provvigioni. Operazione irreversibile.`
                                  : `Eliminare l'appendice #${a.numero_appendice}? Operazione irreversibile.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(a)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        )}
      </PolizzaSection>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => effectiveTitoloId ? navigate(`/titoli/${effectiveTitoloId}`) : navigate("/portafoglio/attive")}>
          Chiudi
        </Button>
      </div>
    </PageContainer>
  );
};

export default AppendiciPolizzaPage;
