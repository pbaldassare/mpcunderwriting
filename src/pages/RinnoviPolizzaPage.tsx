import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, RefreshCw, FileSpreadsheet, FileText, ListChecks, Filter } from "lucide-react";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { PageContainer } from "@/components/shared/PageContainer";

const RinnoviPolizzaPage = () => {
  const navigate = useNavigate();

  const [codiceCliente, setCodiceCliente] = useState("");
  const [scadDal, setScadDal] = useState("");
  const [scadAl, setScadAl] = useState("");
  const [codiceCompagnia, setCodiceCompagnia] = useState("");
  const [tipoRinn, setTipoRinn] = useState("");
  const [gruppoRamo, setGruppoRamo] = useState("");
  const [ramo, setRamo] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [indotto, setIndotto] = useState("");
  const [autoFilter, setAutoFilter] = useState("tutti");
  const [tipoFilter, setTipoFilter] = useState("da_generare");
  const [searched, setSearched] = useState(false);

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup-rinn", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCliente.length >= 2,
  });

  const { data: compagniaData } = useQuery({
    queryKey: ["agenzia-lookup-rinn", codiceCompagnia],
    queryFn: async () => {
      if (!codiceCompagnia || codiceCompagnia.length < 2) return null;
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .or(`codice.ilike.%${codiceCompagnia}%,nome.ilike.%${codiceCompagnia}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCompagnia.length >= 2,
  });

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-rinn"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <PageContainer variant="form">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-teal-600" />
            Polizze in Quietanzamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione rinnovi polizze — selezione, generazione, lettera, export</p>
        </div>
      </div>

      <PolizzaSection title="Parametri Ricerca" icon={Filter} defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {/* Left column */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Cliente</Label>
              <div className="relative flex-1 max-w-[180px]">
                <Input value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="" />
                <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              {clienteData && (
                <span className="text-sm text-foreground truncate">
                  {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Scad. dal</Label>
              <Input type="date" value={scadDal} onChange={(e) => setScadDal(e.target.value)} className="w-[150px]" />
              <span className="text-sm text-muted-foreground">al</span>
              <Input type="date" value={scadAl} onChange={(e) => setScadAl(e.target.value)} className="w-[150px]" />
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Gruppo Ramo</Label>
              <select value={gruppoRamo} onChange={(e) => setGruppoRamo(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Tutti i gruppi rami</option>
              </select>
              <Label className="shrink-0">Garanzia</Label>
              <select value={ramo} onChange={(e) => setRamo(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Tutti i rami</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">A/E</Label>
              <select value={selectedAE} onChange={(e) => setSelectedAE(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Tutti gli A/E</option>
                {aeList?.map((ae) => (
                  <option key={ae.id} value={ae.id}>{ae.sigla || ae.codice} - {ae.cognome} {ae.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Specialist</Label>
              <select value={specialist} onChange={(e) => setSpecialist(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Tutti gli specialist</option>
              </select>
              <Label className="shrink-0">Indotto</Label>
              <select value={indotto} onChange={(e) => setIndotto(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Tutti</option>
              </select>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Agenzia</Label>
              <div className="relative max-w-[140px]">
                <Input value={codiceCompagnia} onChange={(e) => setCodiceCompagnia(e.target.value)} />
                <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-foreground truncate">{compagniaData?.nome || ""}</span>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Tipo Rinn</Label>
              <select value={tipoRinn} onChange={(e) => setTipoRinn(e.target.value)} className={`${selectClass} flex-1 max-w-[200px]`}>
                <option value="">Tutti i tipi</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Auto</Label>
              <RadioGroup value={autoFilter} onValueChange={setAutoFilter} className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="si" id="auto-si" />
                  <Label htmlFor="auto-si" className="font-normal cursor-pointer text-sm">Sì</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="no" id="auto-no" />
                  <Label htmlFor="auto-no" className="font-normal cursor-pointer text-sm">No</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="tutti" id="auto-tutti" />
                  <Label htmlFor="auto-tutti" className="font-normal cursor-pointer text-sm">Tutti</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-24 text-right shrink-0">Tipo</Label>
              <RadioGroup value={tipoFilter} onValueChange={setTipoFilter} className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="da_generare" id="tipo-dagen" />
                  <Label htmlFor="tipo-dagen" className="font-normal cursor-pointer text-sm">da Generare</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="generati" id="tipo-gen" />
                  <Label htmlFor="tipo-gen" className="font-normal cursor-pointer text-sm">Generati</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="tutti" id="tipo-tutti" />
                  <Label htmlFor="tipo-tutti" className="font-normal cursor-pointer text-sm">Tutti</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="annullamenti" id="tipo-ann" />
                  <Label htmlFor="tipo-ann" className="font-normal cursor-pointer text-sm">Annullamenti</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={() => setSearched(true)} className="gap-2">
                <Search className="w-4 h-4" /> Cerca
              </Button>
            </div>
          </div>
        </div>
      </PolizzaSection>

      <PolizzaSection title="Dettaglio" icon={ListChecks} defaultOpen>
        <div className="min-h-[120px]">
          {!searched && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Imposta i parametri di ricerca e clicca "Cerca"
            </p>
          )}
        </div>
      </PolizzaSection>

      {/* ACTIONS */}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        <Button variant="secondary" onClick={() => navigate("/portafoglio/attive")}>Chiudi</Button>
        <div className="flex-1" />
        <Button variant="outline" className="gap-2"><ListChecks className="w-4 h-4" /> Lista</Button>
        <Button variant="outline" className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        <Button variant="outline" className="gap-2"><FileText className="w-4 h-4" /> Lettera</Button>
        <Button className="gap-2"><RefreshCw className="w-4 h-4" /> Rinnova (Tutti)</Button>
      </div>
    </PageContainer>
  );
};

export default RinnoviPolizzaPage;
