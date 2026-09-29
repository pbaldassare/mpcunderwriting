import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  FileText, 
  ArrowLeft, 
  Search, 
  Save, 
  Printer, 
  FileDown, 
  AlertCircle, 
  UserCheck, 
  Calendar, 
  Activity, 
  FileCheck
} from "lucide-react";
import { format, parseISO } from "date-fns";

const sirSchema = z.object({
  // Sezione 1: Infortunato
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  codice_fiscale: z.string().min(1, "Il codice fiscale è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  luogo_nascita: z.string().min(1, "Il luogo di nascita è obbligatorio"),
  professione: z.string().min(1, "La professione è obbligatoria"),
  indirizzo: z.string().min(1, "L'indirizzo è obbligatorio"),

  // Sezione 2: Evento
  data_evento: z.string().min(1, "La data dell'evento è obbligatoria"),
  luogo_evento: z.string().min(1, "Il luogo dell'evento è obbligatorio"),
  dinamica: z.string().min(1, "La descrizione della dinamica è obbligatoria"),
  testimoni: z.string().optional(),

  // Sezione 3: Medico e diagnosi
  medico_curante: z.string().min(1, "Il medico curante è obbligatorio"),
  struttura_sanitaria: z.string().min(1, "La struttura sanitaria è obbligatoria"),
  diagnosi: z.string().min(1, "La diagnosi è obbligatoria"),
  prognosi_giorni: z.preprocess((val) => (val === "" || val === undefined ? undefined : Number(val)), z.number().min(0, "I giorni non possono essere negativi")),
  data_fine_prognosi: z.string().min(1, "La data fine prognosi è obbligatoria"),

  // Sezione 4: Invalidità
  invalidita_temporanea: z.boolean().default(false),
  invalidita_temporanea_giorni: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().min(0).optional()),
  invalidita_permanente: z.boolean().default(false),
  invalidita_permanente_pct: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().min(0).max(100).optional()),
  morte: z.boolean().default(false),
  data_morte: z.string().optional(),

  // Sezione 5: Note
  note_aggiuntive: z.string().optional()
});

type SirFormValues = z.infer<typeof sirSchema>;

export default function SinistroReportSirPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedSinistroId, setSelectedSinistroId] = useState<string>("");
  const [selectedSinistroData, setSelectedSinistroData] = useState<any>(null);
  const [generazionePdf, setGenerazionePdf] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SirFormValues>({
    resolver: zodResolver(sirSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      codice_fiscale: "",
      data_nascita: "",
      luogo_nascita: "",
      professione: "",
      indirizzo: "",
      data_evento: "",
      luogo_evento: "",
      dinamica: "",
      testimoni: "",
      medico_curante: "",
      struttura_sanitaria: "",
      diagnosi: "",
      prognosi_giorni: undefined,
      data_fine_prognosi: "",
      invalidita_temporanea: false,
      invalidita_temporanea_giorni: 0,
      invalidita_permanente: false,
      invalidita_permanente_pct: 0,
      morte: false,
      data_morte: "",
      note_aggiuntive: ""
    }
  });

  const watchInvaliditaTemp = watch("invalidita_temporanea");
  const watchInvaliditaPerm = watch("invalidita_permanente");
  const watchMorte = watch("morte");

  // Query per selezionare i sinistri di tipo infortunio o malattia
  const { data: sinistriList = [] } = useQuery({
    queryKey: ["sinistri-report-sir-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("sinistri").select(`
        id, 
        numero_sinistro, 
        tipo_sinistro, 
        data_evento, 
        luogo_sinistro, 
        note_perito,
        dinamica,
        medico_legale,
        clienti!sinistri_cliente_anagrafica_id_fkey(
          id, 
          nome, 
          cognome, 
          ragione_sociale, 
          codice_fiscale, 
          data_nascita, 
          citta_residenza, 
          indirizzo_residenza, 
          cap_residenza, 
          provincia_residenza
        )
      `)
      .in("tipo_sinistro", ["infortunio", "malattia"])
      .neq("stato", "archiviato")
      .order("created_at", { ascending: false });
      return data || [];
    }
  });

  // Query documenti del sinistro selezionato
  const { data: documentiSinistro = [] } = useQuery({
    queryKey: ["documenti-sinistro-report", selectedSinistroId],
    queryFn: async () => {
      if (!selectedSinistroId) return [];
      const { data } = await supabase.from("documenti")
        .select("id, nome_file, categoria, creato_il")
        .eq("entita_id", selectedSinistroId)
        .eq("entita_tipo", "sinistro");
      return data || [];
    },
    enabled: !!selectedSinistroId
  });

  // Auto-popola i dati del form quando viene selezionato il sinistro
  useEffect(() => {
    if (!selectedSinistroId) {
      reset();
      setSelectedSinistroData(null);
      return;
    }

    const sinistro = sinistriList.find(s => s.id === selectedSinistroId);
    if (!sinistro) return;

    setSelectedSinistroData(sinistro);

    // Controlliamo se c'è già una bozza del report SIR salvata in note_perito
    let bozzaSir: Partial<SirFormValues> = {};
    if (sinistro.note_perito && sinistro.note_perito.startsWith("[SIR_REPORT]")) {
      try {
        const jsonStr = sinistro.note_perito.replace("[SIR_REPORT]", "").trim();
        bozzaSir = JSON.parse(jsonStr);
        toast.success("Bozza report SIR caricata dal database");
      } catch (e) {
        console.warn("Errore parsing bozza SIR", e);
      }
    }

    const cliente = sinistro.clienti as any;

    // Popoliamo i campi con precedenza alla bozza, poi ai dati reali della polizza/sinistro
    setValue("nome", bozzaSir.nome || cliente?.nome || "");
    setValue("cognome", bozzaSir.cognome || cliente?.cognome || "");
    setValue("codice_fiscale", bozzaSir.codice_fiscale || cliente?.codice_fiscale || "");
    setValue("data_nascita", bozzaSir.data_nascita || cliente?.data_nascita || "");
    setValue("luogo_nascita", bozzaSir.luogo_nascita || cliente?.citta_residenza || "");
    setValue("professione", bozzaSir.professione || "Impiegato");
    setValue("indirizzo", bozzaSir.indirizzo || (cliente ? `${cliente.indirizzo_residenza || ""} ${cliente.cap_residenza || ""} ${cliente.citta_residenza || ""}`.trim() : ""));

    setValue("data_evento", bozzaSir.data_evento || sinistro.data_evento || "");
    setValue("luogo_evento", bozzaSir.luogo_evento || sinistro.luogo_sinistro || "");
    setValue("dinamica", bozzaSir.dinamica || sinistro.dinamica || "");
    setValue("testimoni", bozzaSir.testimoni || "");

    setValue("medico_curante", bozzaSir.medico_curante || sinistro.medico_legale || "");
    setValue("struttura_sanitaria", bozzaSir.struttura_sanitaria || "");
    setValue("diagnosi", bozzaSir.diagnosi || "");
    setValue("prognosi_giorni", bozzaSir.prognosi_giorni || 0);
    setValue("data_fine_prognosi", bozzaSir.data_fine_prognosi || "");

    setValue("invalidita_temporanea", bozzaSir.invalidita_temporanea || false);
    setValue("invalidita_temporanea_giorni", bozzaSir.invalidita_temporanea_giorni || 0);
    setValue("invalidita_permanente", bozzaSir.invalidita_permanente || false);
    setValue("invalidita_permanente_pct", bozzaSir.invalidita_permanente_pct || 0);
    setValue("morte", bozzaSir.morte || false);
    setValue("data_morte", bozzaSir.data_morte || "");
    
    setValue("note_aggiuntive", bozzaSir.note_aggiuntive || "");

  }, [selectedSinistroId, sinistriList, setValue, reset]);

  // Azione Salva Bozza
  const saveBozzaMutation = useMutation({
    mutationFn: async (values: SirFormValues) => {
      if (!selectedSinistroId) throw new Error("Seleziona prima un sinistro");

      // Serializziamo l'intero form con un prefisso speciale
      const serializedData = `[SIR_REPORT] ${JSON.stringify(values)}`;

      // Aggiorniamo note_perito e dinamica/medico_legale nel sinistro
      const { error } = await supabase.from("sinistri").update({
        note_perito: serializedData,
        dinamica: values.dinamica,
        medico_legale: values.medico_curante
      }).eq("id", selectedSinistroId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinistri-report-sir-lookup"] });
      toast.success("Bozza salvata con successo sul database");
    },
    onError: (err: any) => {
      toast.error("Errore salvataggio bozza: " + err.message);
    }
  });

  const handleSalvaBozza = () => {
    const values = watch();
    saveBozzaMutation.mutate(values);
  };

  // Azione Genera PDF tramite Edge Function
  const handleGeneraPDF = async (values: SirFormValues) => {
    if (!selectedSinistroId) {
      toast.error("Seleziona prima un sinistro");
      return;
    }
    setGenerazionePdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Invochiamo la Edge Function
      const { data, error } = await supabase.functions.invoke("genera-pdf-template", {
        body: {
          tipo: "sir",
          sinistro_id: selectedSinistroId,
          dati_sir: values // Passiamo tutti i dati del form sanitario
        }
      });

      if (error || data?.error) throw new Error(error?.message || data?.error || "Errore sconosciuto");

      // Convertiamo il base64 ricevuto in Blob ed eseguiamo l'upload nel bucket documenti_sinistri
      const base64Data = data.content;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const storagePath = `sinistro/${selectedSinistroId}/report_sir_${Date.now()}.pdf`;

      // Upload file su storage
      const { error: uploadErr } = await supabase.storage
        .from("documenti_sinistri")
        .upload(storagePath, blob);

      if (uploadErr) throw uploadErr;

      // Creazione record metadati in documenti
      const { error: docErr } = await supabase.from("documenti").insert({
        nome_file: `Report_SIR_${selectedSinistroData?.numero_sinistro}.pdf`,
        path_storage: storagePath,
        bucket_name: "documenti_sinistri",
        entita_tipo: "sinistro",
        entita_id: selectedSinistroId,
        caricato_da: user?.id,
        categoria: "referto_medico",
        descrizione: `Report Sanitario SIR generato in data ${format(new Date(), "dd/MM/yyyy")}`
      });

      if (docErr) throw docErr;

      toast.success("PDF del Report SIR generato e salvato nei documenti del sinistro!");
      qc.invalidateQueries({ queryKey: ["documenti-sinistro-report", selectedSinistroId] });
    } catch (err: any) {
      toast.error("Errore generazione PDF: " + err.message);
    } finally {
      setGenerazionePdf(false);
    }
  };

  // Stampa diretta browser
  const handleStampaDiretta = () => {
    window.print();
  };

  const optionsSinistri = sinistriList.map((s: any) => ({
    value: s.id,
    label: `${s.numero_sinistro} — ${s.clienti ? `${s.clienti.cognome || ""} ${s.clienti.nome || ""}`.trim() : "—"}`,
    description: `Tipo: ${s.tipo_sinistro?.replace(/_/g, " ")} | Data evento: ${s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "N/D"}`
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" /> Report Sanitario SIR
            </h1>
            <p className="text-muted-foreground">Compilazione modulo e refertazione per sinistri infortuni e malattia</p>
          </div>
        </div>
        
        {selectedSinistroId && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSalvaBozza} disabled={saveBozzaMutation.isPending} className="gap-1.5">
              <Save className="h-4 w-4" /> Salva bozza
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleStampaDiretta} className="gap-1.5">
              <Printer className="h-4 w-4" /> Stampa diretta
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit(handleGeneraPDF)} disabled={generazionePdf} className="btn-primary-gradient gap-1.5">
              <FileDown className="h-4 w-4" /> 
              {generazionePdf ? "Generazione..." : "Genera PDF"}
            </Button>
          </div>
        )}
      </div>

      {/* Selezione Sinistro */}
      <Card className="print:hidden">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Seleziona Sinistro Collegato</CardTitle>
          <CardDescription>Il report sanitario può essere compilato unicamente per sinistri con Ramo Infortunio o Malattia.</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <SearchableSelect
            value={selectedSinistroId}
            onValueChange={setSelectedSinistroId}
            placeholder="Cerca sinistro per N° o nominativo cliente..."
            options={optionsSinistri}
          />
        </CardContent>
      </Card>

      {!selectedSinistroId ? (
        <Card className="p-8 text-center text-muted-foreground print:hidden">
          <AlertCircle className="h-10 w-10 mx-auto opacity-45 mb-2 text-primary" />
          <p className="font-medium">Seleziona un sinistro attivo per iniziare la compilazione del Report SIR</p>
        </Card>
      ) : (
        <div id="sir-printable-area" className="space-y-6">
          
          {/* Mostrato solo in Stampa */}
          <div className="hidden print:block border-b-2 border-primary pb-3 mb-6">
            <h1 className="text-2xl font-bold text-center text-primary uppercase">Report Sanitario SIR</h1>
            <p className="text-center text-xs text-muted-foreground mt-1">Sinistro N° {selectedSinistroData?.numero_sinistro} — Generato il {format(new Date(), "dd/MM/yyyy")}</p>
          </div>

          {/* SEZIONE 1: INFORTUNATO */}
          <Card className="card-accent-left shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <UserCheck className="h-5 w-5" /> Sezione 1 — Dati dell'Infortunato
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" {...register("nome")} />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cognome">Cognome</Label>
                <Input id="cognome" {...register("cognome")} />
                {errors.cognome && <p className="text-xs text-destructive">{errors.cognome.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
                <Input id="codice_fiscale" className="font-mono" {...register("codice_fiscale")} />
                {errors.codice_fiscale && <p className="text-xs text-destructive">{errors.codice_fiscale.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_nascita">Data Nascita</Label>
                <Input id="data_nascita" type="date" {...register("data_nascita")} />
                {errors.data_nascita && <p className="text-xs text-destructive">{errors.data_nascita.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="luogo_nascita">Luogo Nascita</Label>
                <Input id="luogo_nascita" {...register("luogo_nascita")} />
                {errors.luogo_nascita && <p className="text-xs text-destructive">{errors.luogo_nascita.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="professione">Professione svolta</Label>
                <Input id="professione" {...register("professione")} />
                {errors.professione && <p className="text-xs text-destructive">{errors.professione.message}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                <Label htmlFor="indirizzo">Indirizzo di Residenza</Label>
                <Input id="indirizzo" {...register("indirizzo")} />
                {errors.indirizzo && <p className="text-xs text-destructive">{errors.indirizzo.message}</p>}
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 2: EVENTO */}
          <Card className="card-accent-left shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Sezione 2 — Dettagli dell'Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="data_evento">Data Accadimento</Label>
                  <Input id="data_evento" type="date" {...register("data_evento")} />
                  {errors.data_evento && <p className="text-xs text-destructive">{errors.data_evento.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="luogo_evento">Luogo Accadimento</Label>
                  <Input id="luogo_evento" {...register("luogo_evento")} />
                  {errors.luogo_evento && <p className="text-xs text-destructive">{errors.luogo_evento.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dinamica">Descrizione Dinamica Infortunio</Label>
                <Textarea id="dinamica" rows={3} placeholder="Descrivere come si è verificato l'evento..." {...register("dinamica")} />
                {errors.dinamica && <p className="text-xs text-destructive">{errors.dinamica.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="testimoni">Testimoni dell'evento (nominativi e recapiti, se presenti)</Label>
                <Input id="testimoni" placeholder="Es. Mario Rossi (Tel: 333/123456)" {...register("testimoni")} />
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 3: MEDICO E DIAGNOSI */}
          <Card className="card-accent-left shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <Activity className="h-5 w-5" /> Sezione 3 — Valutazione Medica e Diagnosi
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="medico_curante">Medico Curante</Label>
                  <Input id="medico_curante" placeholder="Nome del medico..." {...register("medico_curante")} />
                  {errors.medico_curante && <p className="text-xs text-destructive">{errors.medico_curante.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="struttura_sanitaria">Struttura Sanitaria / Ospedale</Label>
                  <Input id="struttura_sanitaria" placeholder="Es. Ospedale Niguarda..." {...register("struttura_sanitaria")} />
                  {errors.struttura_sanitaria && <p className="text-xs text-destructive">{errors.struttura_sanitaria.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="diagnosi">Diagnosi Clinica Riscontrata</Label>
                <Textarea id="diagnosi" rows={3} placeholder="Es. Frattura composta del radio..." {...register("diagnosi")} />
                {errors.diagnosi && <p className="text-xs text-destructive">{errors.diagnosi.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prognosi_giorni">Giorni di Prognosi prescritti</Label>
                  <Input id="prognosi_giorni" type="number" {...register("prognosi_giorni")} />
                  {errors.prognosi_giorni && <p className="text-xs text-destructive">{errors.prognosi_giorni.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="data_fine_prognosi">Data presunta fine prognosi</Label>
                  <Input id="data_fine_prognosi" type="date" {...register("data_fine_prognosi")} />
                  {errors.data_fine_prognosi && <p className="text-xs text-destructive">{errors.data_fine_prognosi.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 4: INVALIDITA */}
          <Card className="card-accent-left shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Sezione 4 — Grado di Invalidità
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                
                {/* Invalidità Temporanea */}
                <div className="p-3 border rounded-lg space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="invalidita_temporanea" className="font-semibold cursor-pointer">Invalidità Temporanea</Label>
                    <Switch id="invalidita_temporanea" checked={watchInvaliditaTemp} onCheckedChange={(val) => setValue("invalidita_temporanea", val)} />
                  </div>
                  {watchInvaliditaTemp && (
                    <div className="space-y-1.5">
                      <Label htmlFor="invalidita_temporanea_giorni">Giorni Effettivi</Label>
                      <Input id="invalidita_temporanea_giorni" type="number" {...register("invalidita_temporanea_giorni")} />
                    </div>
                  )}
                </div>

                {/* Invalidità Permanente */}
                <div className="p-3 border rounded-lg space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="invalidita_permanente" className="font-semibold cursor-pointer">Invalidità Permanente</Label>
                    <Switch id="invalidita_permanente" checked={watchInvaliditaPerm} onCheckedChange={(val) => setValue("invalidita_permanente", val)} />
                  </div>
                  {watchInvaliditaPerm && (
                    <div className="space-y-1.5">
                      <Label htmlFor="invalidita_permanente_pct">Percentuale (0-100 %)</Label>
                      <Input id="invalidita_permanente_pct" type="number" min="0" max="100" {...register("invalidita_permanente_pct")} />
                    </div>
                  )}
                </div>

                {/* Morte */}
                <div className="p-3 border rounded-lg space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="morte" className="font-semibold cursor-pointer">Decesso</Label>
                    <Switch id="morte" checked={watchMorte} onCheckedChange={(val) => setValue("morte", val)} />
                  </div>
                  {watchMorte && (
                    <div className="space-y-1.5">
                      <Label htmlFor="data_morte">Data Decesso</Label>
                      <Input id="data_morte" type="date" {...register("data_morte")} />
                    </div>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 5: NOTE E DOCUMENTI ALLEGATI */}
          <Card className="card-accent-left shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <FileCheck className="h-5 w-5" /> Sezione 5 — Annotazioni e Documentazione Allegata
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="note_aggiuntive">Note Aggiuntive e Rilievi Particolari</Label>
                <Textarea id="note_aggiuntive" rows={3} placeholder="Es. Precedenti patologie dichiarate..." {...register("note_aggiuntive")} />
              </div>

              {/* Lista documenti esistenti sul sinistro */}
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documenti Caricati a Sistema sul Sinistro:</h4>
                {documentiSinistro.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Nessun documento caricato per questo sinistro.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="py-2">Nome File</TableHead>
                          <TableHead className="py-2">Categoria</TableHead>
                          <TableHead className="py-2">Data Caricamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documentiSinistro.map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="py-2 font-medium">{doc.nome_file}</TableCell>
                            <TableCell className="py-2 capitalize">{doc.categoria?.replace(/_/g, " ") || "Altro"}</TableCell>
                            <TableCell className="py-2">{doc.creato_il ? format(new Date(doc.creato_il), "dd/MM/yyyy") : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pulsantiera Stampa Form (mostrata in fondo al foglio) */}
          <div className="hidden print:flex justify-between items-center border-t pt-4 mt-8">
            <span className="text-[10px] text-muted-foreground">ConsulNet Software — Modulo SIR</span>
            <span className="text-[10px] font-semibold">Firma dell'Infortunato / Medico: ___________________________</span>
          </div>

        </div>
      )}
    </div>
  );
}
