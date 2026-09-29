import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Users, Loader2, GitMerge } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

interface DuplicateRow {
  cluster_key: string;
  match_type: string;
  confidenza: string;
  cliente_id: string;
  nome_completo: string;
  codice_fiscale: string | null;
  partita_iva: string | null;
  tipo_cliente: string;
  attivo: boolean;
  merged_into: string | null;
  num_polizze: number;
  num_sinistri: number;
  num_documenti: number;
  created_at: string;
}

interface Cluster {
  key: string;
  match_type: string;
  confidenza: string;
  rows: DuplicateRow[];
}

const confidenzaColor: Record<string, string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-orange-500 text-white",
  bassa: "bg-yellow-500 text-white",
};

const matchTypeLabel: Record<string, string> = {
  codice_fiscale: "Stesso CF",
  partita_iva: "Stessa P.IVA",
  nome_cognome: "Stesso nome",
};

function DeduplicaContent() {
  const queryClient = useQueryClient();
  const [selectedMaster, setSelectedMaster] = useState<Record<string, string>>({});
  const [selectedLegacy, setSelectedLegacy] = useState<Record<string, Set<string>>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ cluster: Cluster; masterId: string; legacyIds: string[] } | null>(null);
  const [merging, setMerging] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["duplicati_clienti"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_clienti_duplicati");
      if (error) throw error;
      return (data || []) as DuplicateRow[];
    },
  });

  const clusters = useMemo<Cluster[]>(() => {
    const map = new Map<string, Cluster>();
    rows.forEach((r) => {
      if (!map.has(r.cluster_key)) {
        map.set(r.cluster_key, { key: r.cluster_key, match_type: r.match_type, confidenza: r.confidenza, rows: [] });
      }
      map.get(r.cluster_key)!.rows.push(r);
    });
    // Per ogni cluster suggerisce master = quello con più polizze, poi più recente
    map.forEach((c) => {
      c.rows.sort((a, b) => {
        if (b.num_polizze !== a.num_polizze) return b.num_polizze - a.num_polizze;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const order = { alta: 0, media: 1, bassa: 2 };
      return (order[a.confidenza as keyof typeof order] ?? 9) - (order[b.confidenza as keyof typeof order] ?? 9);
    });
  }, [rows]);

  const getMasterId = (c: Cluster) => selectedMaster[c.key] ?? c.rows[0]?.cliente_id;
  const getLegacyIds = (c: Cluster) => selectedLegacy[c.key] ?? new Set<string>();

  const toggleLegacy = (clusterKey: string, id: string) => {
    setSelectedLegacy((prev) => {
      const cur = new Set(prev[clusterKey] ?? []);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...prev, [clusterKey]: cur };
    });
  };

  const mergeMutation = useMutation({
    mutationFn: async ({ masterId, legacyIds }: { masterId: string; legacyIds: string[] }) => {
      const results = [];
      for (const legacyId of legacyIds) {
        const { data, error } = await supabase.rpc("merge_cliente_atomico", {
          _master_id: masterId,
          _legacy_id: legacyId,
        });
        if (error) throw error;
        results.push(data);
      }
      return results;
    },
    onSuccess: (results) => {
      const totals = results.reduce(
        (acc: any, r: any) => {
          const sp = r?.spostate || {};
          Object.keys(sp).forEach((k) => { acc[k] = (acc[k] || 0) + (sp[k] || 0); });
          return acc;
        },
        {} as Record<string, number>,
      );
      toast.success(
        `Merge completato: ${results.length} record uniti — ${totals.titoli || 0} polizze, ${totals.sinistri || 0} sinistri, ${totals.documenti || 0} documenti spostati`,
      );
      setConfirmDialog(null);
      setSelectedLegacy({});
      queryClient.invalidateQueries({ queryKey: ["duplicati_clienti"] });
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Errore durante il merge");
    },
    onSettled: () => setMerging(false),
  });

  const openConfirm = (c: Cluster) => {
    const masterId = getMasterId(c);
    const legacyIds = Array.from(getLegacyIds(c));
    if (!masterId || legacyIds.length === 0) {
      toast.error("Seleziona almeno un record da unire al master");
      return;
    }
    if (legacyIds.includes(masterId)) {
      toast.error("Il master non può essere selezionato come da unire");
      return;
    }
    setConfirmDialog({ cluster: c, masterId, legacyIds });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitMerge className="h-7 w-7" /> Deduplica Clienti
          </h1>
          <p className="text-muted-foreground mt-1">
            Trova e unisci i clienti duplicati in anagrafica. Le polizze, sinistri e documenti vengono spostati sul record master.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ricarica"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {clusters.length} cluster di duplicati trovati
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              Nessun duplicato rilevato. L'anagrafica clienti è pulita.
            </div>
          ) : (
            <div className="space-y-6">
              {clusters.map((c) => {
                const masterId = getMasterId(c);
                const legacyIds = getLegacyIds(c);
                return (
                  <Card key={c.key} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={confidenzaColor[c.confidenza]}>
                            Confidenza {c.confidenza}
                          </Badge>
                          <Badge variant="outline">{matchTypeLabel[c.match_type] || c.match_type}</Badge>
                          <span className="text-sm text-muted-foreground font-mono">{c.key}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openConfirm(c)}
                          disabled={legacyIds.size === 0}
                        >
                          <GitMerge className="h-4 w-4 mr-1" />
                          Unisci {legacyIds.size > 0 ? `(${legacyIds.size})` : ""}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={masterId} onValueChange={(v) => setSelectedMaster((p) => ({ ...p, [c.key]: v }))}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Master</TableHead>
                              <TableHead className="w-16">Unisci</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>CF / P.IVA</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead className="text-right">Polizze</TableHead>
                              <TableHead className="text-right">Sinistri</TableHead>
                              <TableHead className="text-right">Doc</TableHead>
                              <TableHead>Creato</TableHead>
                              <TableHead>Stato</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.rows.map((r) => {
                              const isMaster = masterId === r.cliente_id;
                              const isLegacy = legacyIds.has(r.cliente_id);
                              return (
                                <TableRow key={r.cliente_id} className={isMaster ? "bg-primary/5" : ""}>
                                  <TableCell>
                                    <RadioGroupItem value={r.cliente_id} id={`m-${r.cliente_id}`} />
                                  </TableCell>
                                  <TableCell>
                                    <Checkbox
                                      checked={isLegacy}
                                      disabled={isMaster}
                                      onCheckedChange={() => toggleLegacy(c.key, r.cliente_id)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <a href={`/archivi/clienti/${r.cliente_id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                      {r.nome_completo || "(senza nome)"}
                                    </a>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {r.codice_fiscale || r.partita_iva || "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-xs">{r.tipo_cliente}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">{r.num_polizze}</TableCell>
                                  <TableCell className="text-right">{r.num_sinistri}</TableCell>
                                  <TableCell className="text-right">{r.num_documenti}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {new Date(r.created_at).toLocaleDateString("it-IT")}
                                  </TableCell>
                                  <TableCell>
                                    {r.attivo ? (
                                      <Badge variant="default" className="text-xs">Attivo</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">Inattivo</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma merge</DialogTitle>
            <DialogDescription>
              Stai per unire <strong>{confirmDialog?.legacyIds.length}</strong> record nel master.
              Tutte le polizze, sinistri, documenti, trattative, codici commerciali, referenti e consensi privacy verranno
              spostati. I record uniti verranno disattivati (non eliminati). Operazione tracciata in audit log.
            </DialogDescription>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Master (resta attivo)</Label>
                <div className="font-medium">
                  {confirmDialog.cluster.rows.find((r) => r.cliente_id === confirmDialog.masterId)?.nome_completo}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Da unire (verranno disattivati)</Label>
                <ul className="list-disc list-inside">
                  {confirmDialog.legacyIds.map((id) => {
                    const r = confirmDialog.cluster.rows.find((x) => x.cliente_id === id);
                    return (
                      <li key={id}>
                        {r?.nome_completo} — {r?.num_polizze} polizze, {r?.num_sinistri} sinistri
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={merging}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!confirmDialog) return;
                setMerging(true);
                mergeMutation.mutate({ masterId: confirmDialog.masterId, legacyIds: confirmDialog.legacyIds });
              }}
              disabled={merging}
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />}
              Conferma merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DeduplicaClientiPage() {
  return (
    <RoleGuard allowedRoles={["admin", "responsabile_sede"]}>
      <DeduplicaContent />
    </RoleGuard>
  );
}
