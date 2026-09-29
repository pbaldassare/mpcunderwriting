import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCgaDettaglio } from "@/hooks/useLibreriaCga";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

interface Props {
  cgaId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectVersion?: (id: string) => void;
}

const fmtEur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const TIPO_LABELS: Record<string, string> = {
  esclusione: "Esclusioni",
  obbligo_assicurato: "Obblighi dell'Assicurato",
  apertura_sinistro: "Apertura Sinistro",
  definizione: "Definizioni",
  condizione_particolare: "Condizioni Particolari",
  altro: "Altre Condizioni",
};

export default function LibreriaCgaDetailDialog({ cgaId, open, onOpenChange, onSelectVersion }: Props) {
  const { data, isLoading } = useCgaDettaglio(cgaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {data?.cga.nome_prodotto ?? (isLoading ? "Caricamento..." : "CGA")}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 items-center pt-1">
            {data?.cga.compagnia && <Badge variant="secondary">{data.cga.compagnia}</Badge>}
            {data?.cga.ramo && <Badge variant="outline">{data.cga.ramo}</Badge>}
            {data?.cga.edizione && <span className="text-xs text-muted-foreground">Ed. {data.cga.edizione}</span>}
            {data?.cga.created_at && (
              <span className="text-xs text-muted-foreground ml-auto">
                Analizzata il {format(new Date(data.cga.created_at), "dd MMM yyyy", { locale: it })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {isLoading || !data ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={["sommario", "massimali", "garanzie", "esclusioni"]} className="w-full">
              {data.cga.sommario_ai && (
                <AccordionItem value="sommario">
                  <AccordionTrigger>Sommario AI</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.cga.sommario_ai}</p>
                  </AccordionContent>
                </AccordionItem>
              )}

              {data.garanzie.length > 0 && (
                <AccordionItem value="massimali">
                  <AccordionTrigger>Massimali, franchigie e scoperti ({data.garanzie.length})</AccordionTrigger>
                  <AccordionContent>
                    <TableScrollArea className="">
          <table className="w-full min-w-max text-sm">
                        <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                          <tr>
                            <th className="py-2 pr-3">Garanzia</th>
                            <th className="py-2 pr-3 text-right">Massimale</th>
                            <th className="py-2 pr-3 text-right">Franchigia</th>
                            <th className="py-2 pr-3 text-right">Scoperto %</th>
                            <th className="py-2">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.garanzie.map((g, i) => (
                            <tr key={g.id} className={i % 2 ? "bg-muted/40" : ""}>
                              <td className="py-2 pr-3 font-medium">{g.garanzia}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{fmtEur(g.massimale_standard)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{fmtEur(g.franchigia_standard)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {g.scoperto_percentuale == null ? "—" : `${g.scoperto_percentuale}%`}
                              </td>
                              <td className="py-2 text-xs text-muted-foreground">{g.note ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}

              {Object.entries(
                data.condizioni.reduce<Record<string, typeof data.condizioni>>((acc, c) => {
                  (acc[c.tipo] ||= []).push(c);
                  return acc;
                }, {})
              ).map(([tipo, items]) => (
                <AccordionItem key={tipo} value={tipo}>
                  <AccordionTrigger>
                    {TIPO_LABELS[tipo] ?? tipo} ({items.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-3">
                      {items.map((c) => (
                        <li key={c.id} className="border-l-2 border-primary/40 pl-3">
                          {c.titolo && <div className="font-medium text-sm mb-1">{c.titolo}</div>}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.testo}</p>
                          {c.rilevante_sinistri && (
                            <Badge variant="outline" className="mt-2 text-xs">Rilevante per sinistri</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}

              {data.versioni.length > 1 && (
                <AccordionItem value="versioni">
                  <AccordionTrigger>Cronologia versioni ({data.versioni.length})</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1 text-sm">
                      {data.versioni.map((v, i) => (
                        <li key={v.id} className="flex items-center justify-between py-1 border-b last:border-0">
                          <span>
                            v{data.versioni.length - i}
                            {v.edizione ? ` · ${v.edizione}` : ""}
                            <span className="text-muted-foreground ml-2">
                              {format(new Date(v.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                            </span>
                          </span>
                          {v.id !== data.cga.id && onSelectVersion && (
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => onSelectVersion(v.id)}
                            >
                              Apri questa versione
                            </button>
                          )}
                          {v.id === data.cga.id && (
                            <Badge variant="secondary" className="text-xs">Corrente</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {!data.cga.sommario_ai && data.garanzie.length === 0 && data.condizioni.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nessun dato strutturato disponibile per questa CGA.
                </div>
              )}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
