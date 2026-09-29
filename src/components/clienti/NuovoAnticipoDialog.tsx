import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { useCreaAnticipo } from "@/hooks/useAnticipiCliente";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useClientiSearch } from "@/hooks/useAnticipiGlobale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { isCausaleAccontoCliente } from "@/lib/compensazioniMessaCassa";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Se passato, il cliente è bloccato. Altrimenti viene mostrato selettore. */
  clienteId?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

type CausaleOpt = {
  id: string;
  codice: string;
  descrizione: string;
  segno_default: "+" | "-";
};

export default function NuovoAnticipoDialog({ open, onOpenChange, clienteId }: Props) {
  const qc = useQueryClient();
  const fixedCliente = !!clienteId;
  const creaFixed = useCreaAnticipo(clienteId || "__none__");

  const { data: causali = [] } = useQuery({
    queryKey: ["causali-acconto-cliente"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("causali_contabili") as any)
        .select("id, codice, descrizione, segno_default")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .eq("attivo", true)
        .order("codice");
      if (error) throw error;
      // Solo acconti (ACC_*) — non abbuoni/arrotondamenti
      return ((data || []) as CausaleOpt[]).filter((c) => isCausaleAccontoCliente(c.codice));
    },
  });

  const creaGlobal = useMutation({
    mutationFn: async (input: {
      cliente_id: string;
      data_anticipo: string;
      conto_bancario_id: string | null;
      importo: number;
      note: string | null;
      causale_id: string;
      segno: "+" | "-";
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .insert({
          cliente_id: input.cliente_id,
          data_anticipo: input.data_anticipo,
          conto_bancario_id: input.conto_bancario_id,
          importo: input.importo,
          note: input.note,
          causale_id: input.causale_id,
          segno: input.segno,
          importo_residuo: input.segno === "-" ? 0 : input.importo,
          creato_da: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logAttivita({
        azione: "anticipo_creato",
        entita_tipo: "cliente",
        entita_id: input.cliente_id,
        dettagli_json: {
          anticipo_id: data.id,
          importo: input.importo,
          segno: input.segno,
          causale_id: input.causale_id,
          data: input.data_anticipo,
        },
      });
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente-anticipi", vars.cliente_id] });
      qc.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili", vars.cliente_id] });
      qc.invalidateQueries({ queryKey: ["anticipi-globale"] });
      qc.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      toast.success("Acconto / compensazione creato");
    },
    onError: (e: any) => toast.error(e?.message || "Errore creazione"),
  });

  const [data, setData] = useState(todayISO());
  const [conto, setConto] = useState<string | null>(null);
  const [importo, setImporto] = useState<string>("");
  const [note, setNote] = useState("");
  const [clienteSel, setClienteSel] = useState<string>("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [causaleId, setCausaleId] = useState<string>("");
  const [segno, setSegno] = useState<"+" | "-">("+");
  const { data: clientiOpts = [] } = useClientiSearch(clienteSearch);

  useEffect(() => {
    if (open) {
      setData(todayISO());
      setConto(null);
      setImporto("");
      setNote("");
      setClienteSel("");
      setClienteSearch("");
      setCausaleId("");
      setSegno("+");
    }
  }, [open]);

  // Allinea segno al default della causale quando la si sceglie
  useEffect(() => {
    if (!causaleId) return;
    const c = causali.find((x) => x.id === causaleId);
    if (c?.segno_default === "+" || c?.segno_default === "-") setSegno(c.segno_default);
  }, [causaleId, causali]);

  const importoN = Number(importo.replace(",", "."));
  const canSubmit =
    !!data &&
    !!causaleId &&
    importoN > 0 &&
    (fixedCliente || !!clienteSel) &&
    // Conto obbligatorio solo per partite a credito (+); a debito può restare senza banca
    (segno === "-" || !!conto);
  const isPending = fixedCliente ? creaFixed.isPending : creaGlobal.isPending;

  const handleSave = async () => {
    if (!canSubmit) return;
    const payload = {
      data_anticipo: data,
      conto_bancario_id: conto,
      importo: importoN,
      note: note || null,
      causale_id: causaleId,
      segno,
    };
    if (fixedCliente) {
      await creaFixed.mutateAsync(payload);
    } else {
      await creaGlobal.mutateAsync({
        cliente_id: clienteSel,
        ...payload,
      });
    }
    onOpenChange(false);
  };

  const labelCliente = (c: any) =>
    c.tipo_cliente === "azienda" || c.tipo_cliente === "ente"
      ? c.ragione_sociale || "—"
      : `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo acconto / compensazione</DialogTitle>
          <DialogDescription>
            Registra una partita cliente collegata a una causale contabile. Segno + = credito utilizzabile; − = debito/compensazione.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedCliente && (
            <div>
              <Label className="text-xs">Cliente</Label>
              <SearchableSelect
                className="mt-1"
                value={clienteSel}
                onValueChange={setClienteSel}
                searchValue={clienteSearch}
                onSearchChange={setClienteSearch}
                searchPlaceholder="Nome, più nomi, indirizzo, CF…"
                placeholder="Seleziona cliente…"
                serverSideSearch
                emptyText={clienteSearch.length < 2 ? "Digita almeno 2 caratteri" : "Nessun cliente"}
                options={clientiOpts.map((c: any) => ({
                  value: c.id,
                  label: labelCliente(c),
                  description: c.codice_fiscale || c.partita_iva || undefined,
                }))}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Causale contabile *</Label>
            <Select value={causaleId} onValueChange={setCausaleId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona causale…" />
              </SelectTrigger>
              <SelectContent>
                {causali.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="font-mono mr-1.5">{c.segno_default}</span>
                    {c.codice} — {c.descrizione}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Segno</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant={segno === "+" ? "default" : "outline"}
                size="sm"
                className={segno === "+" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setSegno("+")}
              >
                + Credito
              </Button>
              <Button
                type="button"
                variant={segno === "-" ? "default" : "outline"}
                size="sm"
                className={segno === "-" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setSegno("-")}
              >
                − Debito
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">
              Conto Consulbrokers {segno === "+" ? "*" : "(opzionale)"}
            </Label>
            <ContoBancarioSelect
              value={conto}
              onChange={setConto}
              tipi={["incasso_clienti", "generico"]}
              placeholder="Seleziona conto..."
              className="mt-1"
              showPreview
            />
          </div>
          <div>
            <Label className="text-xs">Importo (€) — valore assoluto *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              className="mt-1"
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs">Note (opzionale)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSubmit || isPending}>
            {isPending ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
