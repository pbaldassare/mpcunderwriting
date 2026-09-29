import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Bell, Loader2, CheckCircle, ShieldCheck, Users, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface JobResult {
  label: string;
  result: any;
  error?: string;
}

const ManutenzionePage = () => {
  const [results, setResults] = useState<JobResult[]>([]);

  const refreshKpi = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_cfo_kpi_mensili");
      if (error) throw error;
      await logAttivita({ azione: "refresh_kpi_manuale", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000" });
    },
    onSuccess: () => { setResults(prev => [...prev, { label: "Refresh KPI CFO", result: { stato: "completato" } }]); toast.success("KPI aggiornati con successo"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Refresh KPI CFO", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const checkScadenze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("segna_eventi_sinistri_scaduti");
      if (error) throw error;
      await logAttivita({ azione: "controllo_scadenze_sinistri", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data) => { setResults(prev => [...prev, { label: "Scadenze Sinistri", result: data }]); toast.success("Controllo scadenze completato"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Scadenze Sinistri", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const archiviaNotifiche = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("archivia_notifiche_vecchie");
      if (error) throw error;
      await logAttivita({ azione: "archiviazione_notifiche", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data) => { setResults(prev => [...prev, { label: "Archiviazione Notifiche", result: data }]); toast.success("Notifiche archiviate"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Archiviazione Notifiche", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const runQuality = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_data_quality_checks");
      if (error) throw error;
      await logAttivita({ azione: "controllo_qualita_dati", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Controlli Qualità Dati", result: data }]); toast.success("Controlli qualità completati", { description: `${data?.totale_nuove || 0} nuove anomalie` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Controlli Qualità Dati", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const provisionClienti = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("provision-clienti-users"); if (error) throw error; return data; },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Provisioning Clienti", result: data }]); toast.success("Provisioning completato", { description: `${data?.creati || 0} utenti creati, ${data?.errori || 0} errori` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Provisioning Clienti", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const provisionCorrispondenti = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("provision-corrispondenti-users"); if (error) throw error; return data; },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Provisioning Corrispondenti", result: data }]); toast.success("Provisioning completato", { description: `${data?.creati || 0} utenti creati, ${data?.errori || 0} errori` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Provisioning Corrispondenti", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const provisionSedi = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("provision-sedi-users", {
        body: { secret: "provision-sedi-2026", reset_password: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      setResults((prev) => [...prev, { label: "Provisioning Sedi", result: data }]);
      const ok = data?.counts?.ok ?? 0;
      const skipped = data?.counts?.skipped_no_email ?? 0;
      toast.success("Provisioning sedi completato", {
        description: `${ok} account sede · ${skipped} senza email`,
      });
    },
    onError: (e: any) => {
      setResults((prev) => [...prev, { label: "Provisioning Sedi", result: null, error: e.message }]);
      toast.error("Errore provisioning sedi");
    },
  });

  const isAnyRunning =
    refreshKpi.isPending ||
    checkScadenze.isPending ||
    archiviaNotifiche.isPending ||
    runQuality.isPending ||
    provisionClienti.isPending ||
    provisionCorrispondenti.isPending ||
    provisionSedi.isPending;

  const runAll = async () => {
    setResults([]);
    await refreshKpi.mutateAsync().catch(() => {});
    await checkScadenze.mutateAsync().catch(() => {});
    await archiviaNotifiche.mutateAsync().catch(() => {});
    await runQuality.mutateAsync().catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manutenzione</h1>
        <p className="text-muted-foreground text-sm">Operazioni di manutenzione e job schedulati manuali</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh KPI CFO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Aggiorna la materialized view dei KPI mensili per la dashboard CFO.</p>
            <Button size="sm" onClick={() => refreshKpi.mutate()} disabled={isAnyRunning}>
              {refreshKpi.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Scadenze Sinistri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Marca come scaduti gli eventi sinistri con data superata.</p>
            <Button size="sm" onClick={() => checkScadenze.mutate()} disabled={isAnyRunning}>
              {checkScadenze.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Archivia Notifiche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Elimina notifiche lette più vecchie di 90 giorni.</p>
            <Button size="sm" onClick={() => archiviaNotifiche.mutate()} disabled={isAnyRunning}>
              {archiviaNotifiche.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Controlli Qualità Dati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Esegui tutti i controlli di data quality e genera anomalie per incongruenze trovate.</p>
            <Button size="sm" onClick={() => runQuality.mutate()} disabled={isAnyRunning}>
              {runQuality.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Provisioning Clienti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Crea utenti auth per tutti i clienti senza account. Password default: Leone123!</p>
            <Button size="sm" onClick={() => provisionClienti.mutate()} disabled={isAnyRunning}>
              {provisionClienti.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Provisioning Produttori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Crea utenti auth per tutti i produttori in anagrafica. Password default: Leone123!</p>
            <Button size="sm" onClick={() => provisionCorrispondenti.mutate()} disabled={isAnyRunning}>
              {provisionCorrispondenti.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Provisioning Sedi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Crea/aggiorna account per ogni sede con email: ruolo <strong>ufficio</strong>, privilegi operativi,
              visibilità solo polizze della sede. Password: Leone123!
            </p>
            <Button size="sm" onClick={() => provisionSedi.mutate()} disabled={isAnyRunning}>
              {provisionSedi.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Import anagrafiche clienti (14/07/2026)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Report PDF dettagliato e Excel con le 348 anagrafiche non importate (validazione + errori DB).
            Sede: San Donà di Piave · Specialist: Maria Midena · Importate: 2.092.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/reports/import-clienti/Report-Import-Clienti.pdf" download="Report-Import-Clienti.pdf">
                <FileDown className="w-4 h-4 mr-1" /> Scarica report PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/reports/import-clienti/Anagrafiche-Non-Importate.xlsx" download="Anagrafiche-Non-Importate.xlsx">
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Scarica Excel non importate
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Import rinnovi polizze (15/07/2026)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Report PDF e Excel con le 116 righe non importate (clienti mancanti, agenzie incerte, appendici).
            Modello madre + quietanza · Importate: 217 coppie (434 titoli).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/reports/import-rinnovi/Report-Import-Rinnovi.pdf" download="Report-Import-Rinnovi.pdf">
                <FileDown className="w-4 h-4 mr-1" /> Scarica report PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/reports/import-rinnovi/Rinnovi-Non-Importati.xlsx" download="Rinnovi-Non-Importati.xlsx">
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Scarica Excel non importate
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={runAll} disabled={isAnyRunning} variant="outline">
        {isAnyRunning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
        Esegui Tutti
      </Button>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risultati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                {r.error ? (
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.error ? (
                    <p className="text-xs text-destructive">{r.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{JSON.stringify(r.result)}</p>
                  )}
                </div>
                <Badge variant={r.error ? "destructive" : "default"} className="text-[10px]">
                  {r.error ? "Errore" : "OK"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManutenzionePage;
