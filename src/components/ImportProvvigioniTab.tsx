import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Upload, Brain, Save, CheckCircle2, AlertTriangle, PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MatchSimile {
  id: string;
  nome: string;
  score: number;
}

interface RigaRisultato {
  nome_originale: string;
  percentuale: number;
  match_esatto: { id: string; nome: string } | null;
  match_simili: MatchSimile[];
  suggerimento: "usa_esistente" | "crea_nuova";
}

type AzioneRiga = "usa_esistente" | "crea_nuova" | "rinomina_crea";

interface RigaConAzione extends RigaRisultato {
  azione: AzioneRiga;
  categoria_scelta_id: string | null;
  nuovo_nome: string;
  salvata: boolean;
}

const ImportProvvigioniTab = () => {
  const queryClient = useQueryClient();
  const [selectedCompagnia, setSelectedCompagnia] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [righe, setRighe] = useState<RigaConAzione[]>([]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["agenzie-select"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto"],
    queryFn: async () => {
      const { data } = await supabase.from("categorie_prodotto").select("id, nome").order("nome");
      return data || [];
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast.error("Seleziona un file PDF valido");
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAnalyze = async () => {
    if (!selectedCompagnia) return toast.error("Seleziona una agenzia");
    if (!pdfFile) return toast.error("Carica un PDF");

    setAnalyzing(true);
    setRighe([]);
    try {
      const pdf_base64 = await fileToBase64(pdfFile);
      const { data, error } = await supabase.functions.invoke("parse-provvigioni-pdf", {
        body: {
          pdf_base64,
          categorie_esistenti: categorie.map((c) => ({ id: c.id, nome: c.nome })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const risultati: RigaRisultato[] = data.risultati || [];
      if (risultati.length === 0) {
        toast.warning("Nessuna provvigione trovata nel PDF");
        return;
      }

      setRighe(
        risultati.map((r) => ({
          ...r,
          azione: r.match_esatto
            ? "usa_esistente"
            : r.suggerimento === "usa_esistente" && r.match_simili.length > 0
            ? "usa_esistente"
            : "crea_nuova",
          categoria_scelta_id: r.match_esatto?.id || (r.match_simili.length > 0 ? r.match_simili[0].id : null),
          nuovo_nome: r.nome_originale,
          salvata: false,
        }))
      );
      toast.success(`${risultati.length} righe estratte dal PDF`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante l'analisi");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRiga = (idx: number, updates: Partial<RigaConAzione>) => {
    setRighe((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const handleSaveAll = async () => {
    if (!selectedCompagnia) return;
    const righeNonSalvate = righe.filter((r) => !r.salvata);
    if (righeNonSalvate.length === 0) return toast.info("Tutte le righe sono già salvate");

    setSaving(true);
    try {
      // Risolvi/crea il rapporto unico per agenzia/direzione. Per broker/plurimandataria
      // l'import non è supportato (serve sapere quale rapporto) e la RPC ritorna errore.
      const { data: rapportoId, error: rappErr } = await supabase.rpc(
        "ensure_default_rapporto" as any,
        { _compagnia_id: selectedCompagnia },
      );
      if (rappErr) throw new Error(
        rappErr.message?.includes("esplicitamente")
          ? "Import non disponibile: per broker/plurimandataria configura le provvigioni dalla pagina Provvigioni Compagnie/Ramo scegliendo il rapporto."
          : `Errore risoluzione rapporto: ${rappErr.message}`,
      );

      for (let i = 0; i < righe.length; i++) {
        const riga = righe[i];
        if (riga.salvata) continue;

        let categoriaId = riga.categoria_scelta_id;

        // Create new category if needed
        if (riga.azione === "crea_nuova" || riga.azione === "rinomina_crea") {
          const nome = riga.azione === "rinomina_crea" ? riga.nuovo_nome : riga.nome_originale;
          const { data: newCat, error: catErr } = await supabase
            .from("categorie_prodotto")
            .insert({ nome })
            .select("id")
            .single();
          if (catErr) throw new Error(`Errore creazione categoria "${nome}": ${catErr.message}`);
          categoriaId = newCat.id;
        }

        if (!categoriaId) throw new Error(`Nessuna categoria per riga "${riga.nome_originale}"`);

        // Upsert into provvigioni_compagnia_ramo per (rapporto, categoria)
        const { error: provErr } = await supabase.from("provvigioni_compagnia_ramo").upsert(
          {
            compagnia_rapporto_id: rapportoId as string,
            categoria_id: categoriaId,
            percentuale_provvigione: riga.percentuale,
            attiva: true,
          } as any,
          { onConflict: "compagnia_rapporto_id,categoria_id" },
        );
        if (provErr) throw new Error(`Errore salvataggio provvigione: ${provErr.message}`);

        updateRiga(i, { salvata: true, categoria_scelta_id: categoriaId });
      }

      queryClient.invalidateQueries({ queryKey: ["categorie_prodotto"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo_all"] });
      toast.success("Provvigioni salvate con successo!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const compagniaOptions = compagnie.map((c) => ({ value: c.id, label: c.nome }));
  const categoriaOptions = categorie.map((c) => ({ value: c.id, label: c.nome }));

  return (
    <div className="space-y-4 mt-4">
      {/* Step 1: Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5" /> Import Provvigioni con IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agenzia</Label>
              <SearchableSelect
                options={compagniaOptions}
                value={selectedCompagnia}
                onValueChange={setSelectedCompagnia}
                placeholder="Seleziona agenzia..."
              />
            </div>
            <div className="space-y-2">
              <Label>PDF Provvigioni</Label>
              <Input type="file" accept=".pdf" onChange={handleFileChange} />
              {pdfFile && <p className="text-xs text-muted-foreground">{pdfFile.name}</p>}
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={analyzing || !selectedCompagnia || !pdfFile}>
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso...</>
            ) : (
              <><Upload className="w-4 h-4" /> Analizza con IA</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Results */}
      {righe.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Risultati Analisi ({righe.length} righe)
            </CardTitle>
            <Button onClick={handleSaveAll} disabled={saving || righe.every((r) => r.salvata)}>
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvataggio...</>
              ) : (
                <><Save className="w-4 h-4" /> Salva Tutto</>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria (dal PDF)</TableHead>
                  <TableHead>% Provv.</TableHead>
                  <TableHead>Azione</TableHead>
                  <TableHead>Categoria DB</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {righe.map((riga, idx) => (
                  <TableRow key={idx} className={riga.salvata ? "opacity-60" : ""}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{riga.nome_originale}</span>
                        {riga.match_esatto && (
                          <Badge variant="outline" className="ml-2 text-xs">Match esatto</Badge>
                        )}
                        {!riga.match_esatto && riga.match_simili.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Simile ({Math.round(riga.match_simili[0].score * 100)}%)
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{riga.percentuale}%</Badge>
                    </TableCell>
                    <TableCell>
                      {riga.salvata ? (
                        <span className="text-muted-foreground text-sm">Salvata</span>
                      ) : (
                        <Select
                          value={riga.azione}
                          onValueChange={(v: AzioneRiga) => updateRiga(idx, { azione: v })}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usa_esistente">Usa esistente</SelectItem>
                            <SelectItem value="crea_nuova">Crea nuova</SelectItem>
                            <SelectItem value="rinomina_crea">Rinomina e crea</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {riga.salvata ? (
                        <span className="text-sm text-muted-foreground">
                          {categorie.find((c) => c.id === riga.categoria_scelta_id)?.nome || riga.nuovo_nome}
                        </span>
                      ) : riga.azione === "usa_esistente" ? (
                        <SearchableSelect
                          options={[
                            ...riga.match_simili.map((m) => ({
                              value: m.id,
                              label: `${m.nome} (${Math.round(m.score * 100)}%)`,
                            })),
                            ...categoriaOptions.filter(
                              (co) => !riga.match_simili.some((m) => m.id === co.value)
                            ),
                          ]}
                          value={riga.categoria_scelta_id || ""}
                          onValueChange={(v) => updateRiga(idx, { categoria_scelta_id: v })}
                          placeholder="Scegli categoria..."
                        />
                      ) : riga.azione === "rinomina_crea" ? (
                        <Input
                          value={riga.nuovo_nome}
                          onChange={(e) => updateRiga(idx, { nuovo_nome: e.target.value })}
                          className="w-48"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          Verrà creata: "{riga.nome_originale}"
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {riga.salvata ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : riga.azione === "usa_esistente" && !riga.categoria_scelta_id ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <PlusCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportProvvigioniTab;
