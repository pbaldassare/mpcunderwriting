import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/SearchableSelect";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { TIPI_SINISTRO } from "@/lib/tipiSinistro";
import {
  DESCRIZIONE_MIN_CHARS,
  isTipoSinistroVeicolo,
  type SinistroPraticaValues,
} from "@/lib/sinistroPraticaSchema";

interface LookupPerson {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
}

interface Props {
  register: UseFormRegister<SinistroPraticaValues>;
  setValue: UseFormSetValue<SinistroPraticaValues>;
  watch: UseFormWatch<SinistroPraticaValues>;
  errors: FieldErrors<SinistroPraticaValues>;
  responsabiliList?: LookupPerson[];
  liquidatoriList?: LookupPerson[];
  /** Mostra campi evento (date, tipo, luogo, descrizione…) */
  showEvento?: boolean;
  /** Mostra Data Accadimento (nascosta nel wizard step 2 se già in step 1) */
  showDataEvento?: boolean;
  /** Mostra sezione importi economici (dettaglio) */
  showEconomici?: boolean;
  /** Mostra assegnazione responsabile/liquidatore (step 4 o dettaglio) */
  showAssegnazione?: boolean;
  /** Mostra note interne */
  showNoteInterne?: boolean;
  /** Mostra note importanti accanto a descrizione (solo dettaglio pratica) */
  showNoteImportanti?: boolean;
}

export default function SinistroPraticaFormFields({
  register,
  setValue,
  watch,
  errors,
  responsabiliList = [],
  liquidatoriList = [],
  showEconomici = false,
  showEvento = true,
  showDataEvento = true,
  showAssegnazione = false,
  showNoteInterne = false,
  showNoteImportanti = false,
}: Props) {
  const tipoStd = watch("tipo_sinistro");
  const tipoCustom = watch("tipo_sinistro_personalizzato");
  const usaPersonalizzato = (tipoCustom || "").length > 0 || tipoStd === "__custom__";
  const showTarga = isTipoSinistroVeicolo(tipoStd, tipoCustom);

  return (
    <div className="space-y-4">
      {showEvento && (
        <>
      <div className={`grid grid-cols-1 ${showDataEvento ? "md:grid-cols-2" : ""} gap-4`}>
        {showDataEvento && (
          <div className="space-y-2">
            <Label htmlFor="data_evento">Data Accadimento *</Label>
            <Input type="date" id="data_evento" {...register("data_evento")} />
            {errors.data_evento && <p className="text-xs text-destructive">{errors.data_evento.message}</p>}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="data_denuncia">Data Denuncia *</Label>
          <Input type="date" id="data_denuncia" {...register("data_denuncia")} />
          {errors.data_denuncia && <p className="text-xs text-destructive">{errors.data_denuncia.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo_sinistro">Tipo Sinistro *</Label>
          {usaPersonalizzato ? (
            <Input
              id="tipo_sinistro_personalizzato"
              placeholder="Descrivi il tipo di sinistro (min 3 caratteri)"
              value={tipoCustom || ""}
              onChange={(e) => {
                setValue("tipo_sinistro_personalizzato", e.target.value, { shouldValidate: true });
                setValue("tipo_sinistro", "", { shouldValidate: true });
              }}
              maxLength={500}
            />
          ) : (
            <SearchableSelect
              options={TIPI_SINISTRO.map((t) => ({ value: t.value, label: t.label }))}
              value={tipoStd || ""}
              onValueChange={(val) => setValue("tipo_sinistro", val, { shouldValidate: true })}
              placeholder="Seleziona tipo sinistro..."
              searchPlaceholder="Cerca tipo..."
            />
          )}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="usa_tipo_personalizzato"
              checked={usaPersonalizzato}
              onCheckedChange={(checked) => {
                if (checked) {
                  setValue("tipo_sinistro", "__custom__");
                } else {
                  setValue("tipo_sinistro", "");
                  setValue("tipo_sinistro_personalizzato", "");
                }
              }}
            />
            <Label htmlFor="usa_tipo_personalizzato" className="text-xs font-normal cursor-pointer">
              Tipo non in elenco (personalizzato)
            </Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="numero_sinistro_compagnia">Numero Sinistro Compagnia (opzionale)</Label>
          <Input id="numero_sinistro_compagnia" placeholder="Es. AN-2026-X8" {...register("numero_sinistro_compagnia")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="indirizzo_sinistro">Luogo Accadimento</Label>
        <AddressAutocomplete
          value={watch("indirizzo_sinistro") || watch("luogo_sinistro") || ""}
          onChange={(v) => {
            setValue("indirizzo_sinistro", v, { shouldValidate: true });
            setValue("luogo_sinistro", v, { shouldValidate: true });
          }}
          onSelect={(c) => {
            setValue("indirizzo_sinistro", c.indirizzo, { shouldValidate: true });
            setValue("cap_sinistro", c.cap, { shouldValidate: true });
            setValue("citta_sinistro", c.citta, { shouldValidate: true });
            setValue("provincia_sinistro", c.provincia, { shouldValidate: true });
            const full = [c.indirizzo, c.cap, c.citta, c.provincia].filter(Boolean).join(", ");
            setValue("luogo_sinistro", full, { shouldValidate: true });
          }}
          placeholder="Inizia a digitare via, piazza, città..."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="CAP" {...register("cap_sinistro")} />
          <Input placeholder="Città" {...register("citta_sinistro")} />
          <Input placeholder="Prov." maxLength={2} {...register("provincia_sinistro")} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="controparte">Controparte (opzionale)</Label>
          <Input id="controparte" placeholder="Nome controparte o veicolo coinvolto" {...register("controparte")} />
        </div>
        {showTarga && (
          <div className="space-y-2">
            <Label htmlFor="targa_veicolo">Targa Veicolo</Label>
            <Input id="targa_veicolo" placeholder="Es. AB123CD" {...register("targa_veicolo")} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="importo_riserva">Importo Riserva Iniziale (€, opzionale)</Label>
          <Input type="number" step="0.01" id="importo_riserva" placeholder="0.00" {...register("importo_riserva")} />
          {errors.importo_riserva && <p className="text-xs text-destructive">{errors.importo_riserva.message}</p>}
        </div>
      </div>

      {showNoteImportanti ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="descrizione">Descrizione Accadimento (min {DESCRIZIONE_MIN_CHARS} caratteri) *</Label>
            <Textarea
              id="descrizione"
              placeholder="Descrivi dettagliatamente come e cosa è accaduto..."
              rows={4}
              {...register("descrizione")}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {(watch("descrizione") || "").length}/{DESCRIZIONE_MIN_CHARS} caratteri minimi
            </p>
            {errors.descrizione && <p className="text-xs text-destructive">{errors.descrizione.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="note_importanti">Note importanti</Label>
            <Textarea
              id="note_importanti"
              placeholder="Punti critici, urgenze o informazioni da evidenziare..."
              rows={4}
              {...register("note_importanti")}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="descrizione">Descrizione Accadimento (min {DESCRIZIONE_MIN_CHARS} caratteri) *</Label>
          <Textarea
            id="descrizione"
            placeholder="Descrivi dettagliatamente come e cosa è accaduto..."
            rows={4}
            {...register("descrizione")}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {(watch("descrizione") || "").length}/{DESCRIZIONE_MIN_CHARS} caratteri minimi
          </p>
          {errors.descrizione && <p className="text-xs text-destructive">{errors.descrizione.message}</p>}
        </div>
      )}
        </>
      )}

      {showEconomici && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <h4 className="text-sm font-semibold">Importi economici</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costo_preventivato">Costo preventivato (€)</Label>
              <Input type="number" step="0.01" id="costo_preventivato" {...register("costo_preventivato")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo_effettivo">Costo effettivo (€)</Label>
              <Input type="number" step="0.01" id="costo_effettivo" {...register("costo_effettivo")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="franchigia">Franchigia (€)</Label>
              <Input type="number" step="0.01" id="franchigia" {...register("franchigia")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importo_liquidato">Liquidato (€)</Label>
              <Input type="number" step="0.01" id="importo_liquidato" {...register("importo_liquidato")} />
            </div>
          </div>
        </div>
      )}

      {showAssegnazione && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Responsabile Interno <span className="text-muted-foreground text-xs">(Specialist Sinistri)</span></Label>
            <SearchableSelect
              value={watch("responsabile_id") || ""}
              onValueChange={(val) => setValue("responsabile_id", val, { shouldValidate: true })}
              placeholder="Seleziona responsabile..."
              clearable
              clearLabel="— Nessuno —"
              options={responsabiliList.map((r) => ({
                value: r.id,
                label: `${r.cognome || ""} ${r.nome || ""}`.trim() || r.id,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Liquidatore Esterno <span className="text-muted-foreground text-xs">(facoltativo)</span></Label>
            <SearchableSelect
              value={watch("liquidatore_id") || ""}
              onValueChange={(val) => setValue("liquidatore_id", val, { shouldValidate: true })}
              placeholder="Seleziona liquidatore..."
              clearable
              clearLabel="— Nessuno —"
              options={liquidatoriList.map((l) => ({
                value: l.id,
                label: l.ragione_sociale || `${l.cognome || ""} ${l.nome || ""}`.trim(),
              }))}
            />
          </div>
        </div>
      )}

      {showNoteInterne && (
        <div className="space-y-2">
          <Label htmlFor="note_interne">Note Interne Operatore (opzionale)</Label>
          <Textarea
            id="note_interne"
            placeholder="Annotazioni non visibili al cliente..."
            rows={3}
            {...register("note_interne")}
          />
        </div>
      )}
    </div>
  );
}
