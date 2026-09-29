import { Car, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { MarcaCombobox, ModelloCombobox } from "@/components/rca/MarcaModelloCombobox";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { CLASSI_MERITO, TIPI_VEICOLO, PROVINCE_IT, isTargaItValid } from "@/lib/rcaConstants";
import { useLookupTipologiaVeicolo } from "@/hooks/useLookupTables";

export type RcaDatiVeicoloSectionProps = {
  isRCA: boolean;
  showBanner?: boolean;
  aiPrefilled: Set<string>;
  clearAiPrefilled: (key: string) => void;
  cProvincia: string;
  kwCvLocked: null | "cv" | "kw";
  setKwCvLocked: (v: null | "cv" | "kw") => void;
  rcaUsi: SearchableSelectOption[] | undefined;
  vTipoVeicolo: string;
  setVTipoVeicolo: (v: string) => void;
  setVSettore: (v: string) => void;
  vUso: string;
  setVUso: (v: string) => void;
  vMarca: string;
  setVMarca: (v: string) => void;
  vModello: string;
  setVModello: (v: string) => void;
  vVersione: string;
  setVVersione: (v: string) => void;
  vTarga: string;
  setVTarga: (v: string) => void;
  vTelaio: string;
  setVTelaio: (v: string) => void;
  vDescrizione: string;
  setVDescrizione: (v: string) => void;
  vDataImmatricolazione: string;
  setVDataImmatricolazione: (v: string) => void;
  vAnnoAcquisto: string;
  setVAnnoAcquisto: (v: string) => void;
  vProvinciaCircolazione: string;
  setVProvinciaCircolazione: (v: string) => void;
  vClasseBm: string;
  setVClasseBm: (v: string) => void;
  vCv: string;
  setVCv: (v: string) => void;
  vKw: string;
  setVKw: (v: string) => void;
  vCc: string;
  setVCc: (v: string) => void;
  vPosti: string;
  setVPosti: (v: string) => void;
  vPesoMotrice: string;
  setVPesoMotrice: (v: string) => void;
  vPesoRimorchio: string;
  setVPesoRimorchio: (v: string) => void;
  vPesoTotale: string;
  setVPesoTotale: (v: string) => void;
  vTipologiaGuida: string;
  setVTipologiaGuida: (v: string) => void;
  vTipoAlimentazione: string;
  setVTipoAlimentazione: (v: string) => void;
  vMass1: string;
  setVMass1: (v: string) => void;
  vMass2: string;
  setVMass2: (v: string) => void;
  vMass3: string;
  setVMass3: (v: string) => void;
  vFranchigia: string;
  setVFranchigia: (v: string) => void;
  vPeius: boolean;
  setVPeius: (v: boolean) => void;
  vTemporanea: boolean;
  setVTemporanea: (v: boolean) => void;
  vCaricoScarico: boolean;
  setVCaricoScarico: (v: boolean) => void;
  vCompetizione: boolean;
  setVCompetizione: (v: boolean) => void;
  vRimorchio: boolean;
  setVRimorchio: (v: boolean) => void;
};

// Relazione metrica standard: 1 CV = 0.735499 kW (1 kW = 1.35962 CV).
// Usiamo un'unica costante così le due direzioni sono esattamente l'inversa l'una dell'altra.
const KW_PER_CV = 0.735499;

export function RcaDatiVeicoloSection({ showBanner = false, ...p }: RcaDatiVeicoloSectionProps) {
  const { data: tipiVeicolo = [] } = useLookupTipologiaVeicolo();
  const tipiVeicoloOpts = tipiVeicolo.length > 0 ? tipiVeicolo : TIPI_VEICOLO;

  const aiCls = (key: string) =>
    p.aiPrefilled.has(key) ? "border-l-2 border-l-primary bg-primary/[0.03]" : "";
  const aiBadge = (key: string) =>
    p.aiPrefilled.has(key) ? <Sparkles className="inline-block h-3 w-3 text-primary ml-1" /> : null;

  const handleCvChange = (val: string) => {
    p.setVCv(val);
    p.clearAiPrefilled("vCv");
    p.setKwCvLocked("cv");
    if (p.kwCvLocked !== "kw") {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        p.setVKw(String(Math.round(n * KW_PER_CV)));
        p.clearAiPrefilled("vKw");
      }
    }
  };

  const handleKwChange = (val: string) => {
    p.setVKw(val);
    p.clearAiPrefilled("vKw");
    p.setKwCvLocked("kw");
    if (p.kwCvLocked !== "cv") {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        p.setVCv(String(Math.round(n / KW_PER_CV)));
        p.clearAiPrefilled("vCv");
      }
    }
  };

  const handlePesoChange = (which: "m" | "r", val: string) => {
    if (which === "m") {
      p.setVPesoMotrice(val);
      p.clearAiPrefilled("vPesoMotrice");
    } else {
      p.setVPesoRimorchio(val);
      p.clearAiPrefilled("vPesoRimorchio");
    }
    const m = parseFloat(which === "m" ? val : p.vPesoMotrice) || 0;
    const r = parseFloat(which === "r" ? val : p.vPesoRimorchio) || 0;
    if (m && r) {
      p.setVPesoTotale(String(m + r));
      p.clearAiPrefilled("vPesoTotale");
    }
  };

  const targaValid = !p.vTarga || isTargaItValid(p.vTarga);
  const telaioValid = !p.vTelaio || p.vTelaio.replace(/\s/g, "").length === 17;
  const provinciaCircDiverge =
    p.vProvinciaCircolazione && p.cProvincia && p.vProvinciaCircolazione !== p.cProvincia;

  return (
    <>
      {showBanner && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-2.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-primary uppercase tracking-wide">Sezione RCA Auto</p>
            <p className="text-xs text-muted-foreground">
              Compila i dati del veicolo — i campi con <Sparkles className="inline h-3 w-3 text-primary" /> sono stati riempiti dall&apos;AI.
            </p>
          </div>
        </div>
      )}

      <PolizzaSection title="Dati Veicolo" icon={Car}>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Identificazione</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Tipo Veicolo{p.isRCA && <span className="text-destructive ml-0.5">*</span>}
                {aiBadge("vTipoVeicolo")}
              </Label>
              <SearchableSelect
                className={`h-9 text-sm ${aiCls("vTipoVeicolo")} ${p.isRCA && !p.vTipoVeicolo ? "border-amber-500" : ""}`}
                value={p.vTipoVeicolo}
                onValueChange={(v) => {
                  p.setVTipoVeicolo(v);
                  p.setVSettore(v);
                  p.clearAiPrefilled("vTipoVeicolo");
                }}
                placeholder="—"
                options={tipiVeicoloOpts}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Marca{aiBadge("vMarca")}</Label>
              <MarcaCombobox
                className={`h-9 text-sm ${aiCls("vMarca")}`}
                value={p.vMarca}
                onValueChange={(v) => {
                  p.setVMarca(v);
                  p.setVModello("");
                  p.clearAiPrefilled("vMarca");
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Modello{aiBadge("vModello")}</Label>
              <ModelloCombobox
                className={`h-9 text-sm ${aiCls("vModello")}`}
                marca={p.vMarca}
                value={p.vModello}
                onValueChange={(v) => {
                  p.setVModello(v);
                  p.clearAiPrefilled("vModello");
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Versione{aiBadge("vVersione")}</Label>
              <Input
                value={p.vVersione}
                onChange={(e) => {
                  p.setVVersione(e.target.value);
                  p.clearAiPrefilled("vVersione");
                }}
                className={`h-9 text-sm ${aiCls("vVersione")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Targa{p.isRCA && <span className="text-destructive ml-0.5">*</span>}
                {aiBadge("vTarga")}
                {p.vTarga && !targaValid && <span className="ml-1 text-[10px] text-amber-600">⚠ formato</span>}
              </Label>
              <Input
                value={p.vTarga}
                onChange={(e) => {
                  p.setVTarga(e.target.value.toUpperCase());
                  p.clearAiPrefilled("vTarga");
                }}
                className={`h-9 text-sm font-mono uppercase ${aiCls("vTarga")} ${(p.vTarga && !targaValid) || (p.isRCA && !p.vTarga) ? "border-amber-500" : ""}`}
                placeholder="AB123CD"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Telaio (VIN){aiBadge("vTelaio")}
                {p.vTelaio && !telaioValid && <span className="ml-1 text-[10px] text-amber-600">⚠ 17 car.</span>}
              </Label>
              <Input
                value={p.vTelaio}
                onChange={(e) => {
                  p.setVTelaio(e.target.value.toUpperCase());
                  p.clearAiPrefilled("vTelaio");
                }}
                className={`h-9 text-sm font-mono uppercase ${aiCls("vTelaio")} ${p.vTelaio && !telaioValid ? "border-amber-500" : ""}`}
                maxLength={17}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 md:col-span-3 lg:col-span-2">
              <Label className="text-[11px] font-medium text-foreground/80">Descrizione completa{aiBadge("vDescrizione")}</Label>
              <Input
                value={p.vDescrizione}
                onChange={(e) => {
                  p.setVDescrizione(e.target.value);
                  p.clearAiPrefilled("vDescrizione");
                }}
                placeholder="es. AUDI A1 1.6 TDI SPORTBACK"
                className={`h-9 text-sm ${aiCls("vDescrizione")}`}
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Circolazione</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Uso{p.isRCA && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <SearchableSelect
                className={`h-9 text-sm ${p.isRCA && !p.vUso ? "border-amber-500" : ""}`}
                value={p.vUso}
                onValueChange={p.setVUso}
                placeholder="—"
                options={p.rcaUsi || []}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Provincia Circolazione{aiBadge("vProvinciaCircolazione")}
                {provinciaCircDiverge && (
                  <span className="ml-1 text-[10px] text-amber-600" title="Differisce dalla residenza del conducente">
                    ⚠
                  </span>
                )}
              </Label>
              <SearchableSelect
                className={`h-9 text-sm ${aiCls("vProvinciaCircolazione")}`}
                value={p.vProvinciaCircolazione}
                onValueChange={(v) => {
                  p.setVProvinciaCircolazione(v);
                  p.clearAiPrefilled("vProvinciaCircolazione");
                }}
                placeholder="—"
                options={PROVINCE_IT}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Classe B/M{aiBadge("vClasseBm")}</Label>
              <SearchableSelect
                className={`h-9 text-sm ${aiCls("vClasseBm")}`}
                value={p.vClasseBm}
                onValueChange={(v) => {
                  p.setVClasseBm(v);
                  p.clearAiPrefilled("vClasseBm");
                }}
                placeholder="—"
                options={CLASSI_MERITO}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Immatricolazione{aiBadge("vDataImmatricolazione")}</Label>
              <Input
                type="date"
                value={p.vDataImmatricolazione}
                onChange={(e) => {
                  p.setVDataImmatricolazione(e.target.value);
                  p.clearAiPrefilled("vDataImmatricolazione");
                }}
                className={`h-9 text-sm ${aiCls("vDataImmatricolazione")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Anno Acquisto{aiBadge("vAnnoAcquisto")}</Label>
              <Input
                type="number"
                value={p.vAnnoAcquisto}
                onChange={(e) => {
                  p.setVAnnoAcquisto(e.target.value);
                  p.clearAiPrefilled("vAnnoAcquisto");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vAnnoAcquisto")}`}
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Caratteristiche tecniche</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">CV{aiBadge("vCv")}</Label>
              <Input type="number" value={p.vCv} onChange={(e) => handleCvChange(e.target.value)} className={`h-9 text-sm font-mono ${aiCls("vCv")}`} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">KW{aiBadge("vKw")}</Label>
              <Input type="number" value={p.vKw} onChange={(e) => handleKwChange(e.target.value)} className={`h-9 text-sm font-mono ${aiCls("vKw")}`} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">CC{aiBadge("vCc")}</Label>
              <Input
                type="number"
                value={p.vCc}
                onChange={(e) => {
                  p.setVCc(e.target.value);
                  p.clearAiPrefilled("vCc");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vCc")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Posti{aiBadge("vPosti")}</Label>
              <Input
                type="number"
                value={p.vPosti}
                onChange={(e) => {
                  p.setVPosti(e.target.value);
                  p.clearAiPrefilled("vPosti");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vPosti")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Peso Mot.{aiBadge("vPesoMotrice")}</Label>
              <Input type="number" value={p.vPesoMotrice} onChange={(e) => handlePesoChange("m", e.target.value)} className={`h-9 text-sm font-mono ${aiCls("vPesoMotrice")}`} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Peso Rim.{aiBadge("vPesoRimorchio")}</Label>
              <Input type="number" value={p.vPesoRimorchio} onChange={(e) => handlePesoChange("r", e.target.value)} className={`h-9 text-sm font-mono ${aiCls("vPesoRimorchio")}`} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Peso Tot.{aiBadge("vPesoTotale")}</Label>
              <Input
                type="number"
                value={p.vPesoTotale}
                onChange={(e) => {
                  p.setVPesoTotale(e.target.value);
                  p.clearAiPrefilled("vPesoTotale");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vPesoTotale")}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">
                Tipologia Guida{p.isRCA && <span className="text-destructive ml-0.5">*</span>}
                {aiBadge("vTipologiaGuida")}
              </Label>
              <SearchableSelect
                className={`h-9 text-sm ${aiCls("vTipologiaGuida")} ${p.isRCA && !p.vTipologiaGuida ? "border-amber-500" : ""}`}
                value={p.vTipologiaGuida}
                onValueChange={(v) => {
                  p.setVTipologiaGuida(v);
                  p.clearAiPrefilled("vTipologiaGuida");
                }}
                placeholder="—"
                options={["Libera", "Esperta"].map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Alimentazione{aiBadge("vTipoAlimentazione")}</Label>
              <SearchableSelect
                className={`h-9 text-sm ${aiCls("vTipoAlimentazione")}`}
                value={p.vTipoAlimentazione}
                onValueChange={(v) => {
                  p.setVTipoAlimentazione(v);
                  p.clearAiPrefilled("vTipoAlimentazione");
                }}
                placeholder="—"
                options={["Benzina", "Diesel", "GPL", "Metano", "Ibrido", "Elettrico"].map((v) => ({ value: v, label: v }))}
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Coperture e massimali</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Massimale 1{aiBadge("vMass1")}</Label>
              <Input
                type="number"
                step="0.01"
                value={p.vMass1}
                onChange={(e) => {
                  p.setVMass1(e.target.value);
                  p.clearAiPrefilled("vMass1");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vMass1")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Massimale 2{aiBadge("vMass2")}</Label>
              <Input
                type="number"
                step="0.01"
                value={p.vMass2}
                onChange={(e) => {
                  p.setVMass2(e.target.value);
                  p.clearAiPrefilled("vMass2");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vMass2")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Massimale 3{aiBadge("vMass3")}</Label>
              <Input
                type="number"
                step="0.01"
                value={p.vMass3}
                onChange={(e) => {
                  p.setVMass3(e.target.value);
                  p.clearAiPrefilled("vMass3");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vMass3")}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-foreground/80">Franchigia{aiBadge("vFranchigia")}</Label>
              <Input
                type="number"
                step="0.01"
                value={p.vFranchigia}
                onChange={(e) => {
                  p.setVFranchigia(e.target.value);
                  p.clearAiPrefilled("vFranchigia");
                }}
                className={`h-9 text-sm font-mono ${aiCls("vFranchigia")}`}
              />
            </div>
          </div>
          <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Clausole</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                { id: "v-peius", label: "Peius", checked: p.vPeius, onChange: p.setVPeius },
                { id: "v-temporanea", label: "Temporanea", checked: p.vTemporanea, onChange: p.setVTemporanea },
                { id: "v-caricoscarico", label: "Carico/Scarico", checked: p.vCaricoScarico, onChange: p.setVCaricoScarico },
                { id: "v-competizione", label: "Competizione", checked: p.vCompetizione, onChange: p.setVCompetizione },
                { id: "v-rimorchio", label: "Rimorchio", checked: p.vRimorchio, onChange: p.setVRimorchio },
              ].map((flag) => (
                <div key={flag.id} className="flex items-center gap-1.5">
                  <Checkbox id={flag.id} checked={flag.checked} onCheckedChange={(v) => flag.onChange(v === true)} />
                  <Label htmlFor={flag.id} className="font-normal cursor-pointer text-sm">
                    {flag.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PolizzaSection>
    </>
  );
}
