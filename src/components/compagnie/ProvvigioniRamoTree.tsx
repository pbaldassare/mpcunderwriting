import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inheritPctLabel, placeholderPctGaranzia, type ProvvMapEntry } from "@/lib/provvigioniRamoTree";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

/** Persistenza invariata: `provvigioni_compagnia_ramo`
 *  (ramo_id null = default ramo, valorizzato = override garanzia).
 *  Stesso contratto usato da TitoloImportiPremiBlock / appendici. */

export type GruppoTreeItem = {
  gr: { id: string; codice?: string | null; descrizione?: string | null };
  sottorami: { id: string; codice?: string | null; descrizione?: string | null }[];
  defaultRow?: ProvvMapEntry;
  configuredCount: number;
};

type SaveRow = {
  id?: string;
  gruppo_ramo_id: string;
  ramo_id: string | null;
  percentuale: number;
  percentuale_accessori?: number | null;
};

interface Props {
  gruppi: GruppoTreeItem[];
  expanded: Set<string>;
  onToggle: (gruppoId: string) => void;
  provvMap: Record<string, ProvvMapEntry>;
  inheritedFromTipo: (gruppoId: string, ramoId: string | null) => number | null;
  onSave: (rows: SaveRow[]) => void;
  onDelete: (id: string) => void;
  onRemoveRamo: (gruppoId: string) => void;
}

export default function ProvvigioniRamoTree({
  gruppi,
  expanded,
  onToggle,
  provvMap,
  inheritedFromTipo,
  onSave,
  onDelete,
  onRemoveRamo,
}: Props) {
  return (
    <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-10 h-9 px-2" />
            <TableHead className="w-[72px] h-9 px-2 text-xs">Cod.</TableHead>
            <TableHead className="min-w-[180px] h-9 px-2 text-xs">Ramo / Garanzia</TableHead>
            <TableHead className="w-[100px] h-9 px-2 text-xs">% Provv.</TableHead>
            <TableHead className="w-[100px] h-9 px-2 text-xs">% Accessori</TableHead>
            <TableHead className="w-[160px] h-9 px-2 text-xs">Stato</TableHead>
            <TableHead className="w-10 h-9 px-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {gruppi.map(({ gr, sottorami, defaultRow, configuredCount }, gi) => {
            const isOpen = expanded.has(gr.id);
            return (
              <RamoBlock
                key={gr.id}
                gr={gr}
                sottorami={sottorami}
                defaultRow={defaultRow}
                configuredCount={configuredCount}
                zebraBase={gi}
                expanded={isOpen}
                onToggle={() => onToggle(gr.id)}
                provvMap={provvMap}
                inheritedFromTipo={inheritedFromTipo}
                onSave={onSave}
                onDelete={onDelete}
                onRemoveRamo={() => onRemoveRamo(gr.id)}
              />
            );
          })}
        </TableBody>
      </Table>
  );
}

function RamoBlock({
  gr,
  sottorami,
  defaultRow,
  configuredCount,
  zebraBase,
  expanded,
  onToggle,
  provvMap,
  inheritedFromTipo,
  onSave,
  onDelete,
  onRemoveRamo,
}: {
  gr: GruppoTreeItem["gr"];
  sottorami: GruppoTreeItem["sottorami"];
  defaultRow?: ProvvMapEntry;
  configuredCount: number;
  zebraBase: number;
  expanded: boolean;
  onToggle: () => void;
  provvMap: Record<string, ProvvMapEntry>;
  inheritedFromTipo: (gruppoId: string, ramoId: string | null) => number | null;
  onSave: (rows: SaveRow[]) => void;
  onDelete: (id: string) => void;
  onRemoveRamo: () => void;
}) {
  const inheritedDefault = inheritedFromTipo(gr.id, null);
  return (
    <>
      <RamoHeaderRow
        gr={gr}
        sottoramiCount={sottorami.length}
        defaultRow={defaultRow}
        configuredCount={configuredCount}
        inheritedDefault={inheritedDefault}
        expanded={expanded}
        onToggle={onToggle}
        onSave={(row) => onSave([row])}
        onDeleteDefault={(id) => onDelete(id)}
        onRemoveRamo={onRemoveRamo}
      />
      {expanded &&
        (sottorami.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="px-4 py-3 text-xs text-muted-foreground italic">
              Nessuna garanzia in catalogo per questo ramo.
            </TableCell>
          </TableRow>
        ) : (
          sottorami.map((s, i) => {
            const key = `${gr.id}|${s.id}`;
            const existing = provvMap[key];
            return (
              <GaranziaRow
                key={s.id}
                gr={gr}
                garanzia={s}
                existing={existing}
                defaultRamo={defaultRow?.perc ?? null}
                inheritedTipo={inheritedFromTipo(gr.id, s.id)}
                zebra={(zebraBase + i) % 2 === 1}
                onSave={(perc, percAcc) =>
                  onSave([
                    {
                      id: existing?.id,
                      gruppo_ramo_id: gr.id,
                      ramo_id: s.id,
                      percentuale: perc,
                      percentuale_accessori: percAcc,
                    },
                  ])
                }
                onDelete={() => existing && onDelete(existing.id)}
              />
            );
          })
        ))}
    </>
  );
}

function RamoHeaderRow({
  gr,
  sottoramiCount,
  defaultRow,
  configuredCount,
  inheritedDefault,
  expanded,
  onToggle,
  onSave,
  onDeleteDefault,
  onRemoveRamo,
}: {
  gr: GruppoTreeItem["gr"];
  sottoramiCount: number;
  defaultRow?: ProvvMapEntry;
  configuredCount: number;
  inheritedDefault: number | null;
  expanded: boolean;
  onToggle: () => void;
  onSave: (row: SaveRow) => void;
  onDeleteDefault: (id: string) => void;
  onRemoveRamo: () => void;
}) {
  const [defVal, setDefVal] = useState<string>(defaultRow ? String(defaultRow.perc) : "");
  const [defAccVal, setDefAccVal] = useState<string>(
    defaultRow?.percAccessori != null ? String(defaultRow.percAccessori) : "",
  );

  useEffect(() => {
    setDefVal(defaultRow ? String(defaultRow.perc) : "");
  }, [defaultRow?.id, defaultRow?.perc]);
  useEffect(() => {
    setDefAccVal(defaultRow?.percAccessori != null ? String(defaultRow.percAccessori) : "");
  }, [defaultRow?.id, defaultRow?.percAccessori]);

  const saveDefault = () => {
    const n = parseFloat(defVal);
    if (isNaN(n)) return;
    const acc = defAccVal.trim() === "" ? null : parseFloat(defAccVal);
    if (defAccVal.trim() !== "" && isNaN(acc!)) return;
    if (defaultRow && n === defaultRow.perc && (acc ?? null) === (defaultRow.percAccessori ?? null)) return;
    onSave({
      id: defaultRow?.id,
      gruppo_ramo_id: gr.id,
      ramo_id: null,
      percentuale: n,
      percentuale_accessori: acc,
    });
  };

  const statoBadge = defaultRow ? (
    <Badge variant="secondary" className="text-[10px]">
      default {defaultRow.perc}%
    </Badge>
  ) : inheritedDefault != null ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          eredita tipo: {inheritedDefault}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Fallback da default per tipo rapporto</TooltipContent>
    </Tooltip>
  ) : (
    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
      imposta default ramo
    </Badge>
  );

  return (
    <TableRow className={`${defaultRow || configuredCount > 0 ? "bg-primary/5" : "bg-muted/40"} border-t-2 border-border`}>
      <TableCell className="px-2 py-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label={expanded ? "Collassa" : "Espandi"}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </TableCell>
      <TableCell className="px-2 py-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{gr.codice}</span>
      </TableCell>
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{gr.descrizione}</span>
          <Badge variant="outline" className="text-[10px]">
            {sottoramiCount} garanzie · {configuredCount} override
          </Badge>
        </div>
      </TableCell>
      <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Input
          type="number"
          step="0.01"
          value={defVal}
          onChange={(e) => setDefVal(e.target.value)}
          onBlur={saveDefault}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-20"
          placeholder="% ramo"
          title="Default del ramo: tutte le garanzie senza override usano questa %"
        />
      </TableCell>
      <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Input
          type="number"
          step="0.01"
          value={defAccVal}
          onChange={(e) => setDefAccVal(e.target.value)}
          onBlur={saveDefault}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-20"
          placeholder="= netto"
          title="% accessori di default (vuoto = come netto)"
        />
      </TableCell>
      <TableCell className="px-2 py-2">{statoBadge}</TableCell>
      <TableCell className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-0.5">
          {defaultRow && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteDefault(defaultRow.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rimuovi solo il default % (le garanzie restano)</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemoveRamo}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rimuovi ramo da questo rapporto</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

function GaranziaRow({
  gr,
  garanzia,
  existing,
  defaultRamo,
  inheritedTipo,
  zebra,
  onSave,
  onDelete,
}: {
  gr: GruppoTreeItem["gr"];
  garanzia: { id: string; codice?: string | null; descrizione?: string | null };
  existing?: ProvvMapEntry;
  defaultRamo: number | null;
  inheritedTipo: number | null;
  zebra: boolean;
  onSave: (perc: number, percAcc: number | null) => void;
  onDelete: () => void;
}) {
  const [val, setVal] = useState<string>(existing ? String(existing.perc) : "");
  const [valAcc, setValAcc] = useState<string>(
    existing?.percAccessori != null ? String(existing.percAccessori) : "",
  );

  useEffect(() => {
    setVal(existing ? String(existing.perc) : "");
  }, [existing?.id, existing?.perc]);
  useEffect(() => {
    setValAcc(existing?.percAccessori != null ? String(existing.percAccessori) : "");
  }, [existing?.id, existing?.percAccessori]);

  const commit = () => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    const acc = valAcc.trim() === "" ? null : parseFloat(valAcc);
    if (valAcc.trim() !== "" && isNaN(acc!)) return;
    if (existing && n === existing.perc && (acc ?? null) === (existing.percAccessori ?? null)) return;
    onSave(n, acc);
  };

  const inheritLabel = inheritPctLabel({
    hasOverride: !!existing,
    defaultRamo,
    inheritedTipo,
  });
  const isMissing = !existing && defaultRamo == null && inheritedTipo == null;

  return (
    <TableRow className={`${zebra ? "bg-muted/20" : ""} ${isMissing ? "border-l-2 border-l-amber-400" : ""}`}>
      <TableCell className="px-2 py-1.5" />
      <TableCell className="px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{garanzia.codice || gr.codice}</span>
      </TableCell>
      <TableCell className="px-2 py-1.5 pl-6 text-sm">{garanzia.descrizione}</TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          step="0.01"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-20"
          placeholder={placeholderPctGaranzia(existing?.perc, defaultRamo)}
          title="Override garanzia. Vuoto + blur senza valore = resta sul default ramo."
        />
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          step="0.01"
          value={valAcc}
          onChange={(e) => setValAcc(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-20"
          placeholder="= netto"
        />
      </TableCell>
      <TableCell className="px-2 py-1.5">
        {existing ? (
          <Badge variant="default" className="text-[10px]">
            override
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={`text-[10px] ${isMissing ? "text-amber-700 border-amber-300 bg-amber-50" : "text-muted-foreground"}`}
          >
            {inheritLabel}
          </Badge>
        )}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-right">
        {existing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Togli override: torna al default del ramo</TooltipContent>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
