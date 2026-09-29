import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  GUIDA_AREE,
  GUIDA_PROCESSI,
  searchGuidaProcessi,
  type GuidaArea,
  type GuidaProcesso,
} from "@/lib/guidaOperativaContent";

const ListaPunti = ({ items, titolo }: { items: string[]; titolo: string }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-foreground">{titolo}</p>
    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
);

const ProcessoBlock = ({ p }: { p: GuidaProcesso }) => (
  <div className="space-y-4 pt-1">
    {p.intro && <p className="text-sm text-muted-foreground">{p.intro}</p>}
    <ListaPunti items={p.cosaFai} titolo="Cosa fai" />
    <ListaPunti items={p.cosaSuccede} titolo="Cosa succede" />
    {p.casiParticolari && p.casiParticolari.length > 0 && (
      <ListaPunti items={p.casiParticolari} titolo="Casi particolari" />
    )}
    {p.riepilogo && p.riepilogo.length > 0 && (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">In sintesi</p>
        <TableScrollArea className="rounded-md border text-sm">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Situazione</th>
                <th className="text-left p-2 font-medium">Risultato</th>
              </tr>
            </thead>
            <tbody>
              {p.riepilogo.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground align-top">{r.situazione}</td>
                  <td className="p-2 align-top">{r.risultato}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollArea>
      </div>
    )}
    <div className="flex flex-wrap gap-1">
      {p.tags.map((t) => (
        <Badge key={t} variant="secondary" className="text-xs font-normal">
          {t}
        </Badge>
      ))}
    </div>
  </div>
);

const GuidaOperativaPage = () => {
  const [search, setSearch] = useState("");

  const filtrati = useMemo(() => searchGuidaProcessi(search), [search]);

  const perArea = useMemo(() => {
    const map = new Map<GuidaArea, GuidaProcesso[]>();
    for (const a of GUIDA_AREE) map.set(a.id, []);
    for (const p of filtrati) {
      map.get(p.area)?.push(p);
    }
    return GUIDA_AREE.map((a) => ({ ...a, processi: map.get(a.id) ?? [] })).filter(
      (a) => a.processi.length > 0,
    );
  }, [filtrati]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Guida operativa</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Cosa fare e cosa succede nel gestionale: incassi, bonifici, acconti, rimesse e
          altre operazioni quotidiane. Linguaggio operativo, senza dettagli tecnici.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca (es. bonifico, acconto, rimessa…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtrati.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nessun processo trovato per &quot;{search}&quot;.
          </CardContent>
        </Card>
      ) : search.trim() ? (
        <Accordion type="multiple" defaultValue={filtrati.map((p) => p.id)} className="space-y-2">
          {filtrati.map((p) => (
            <AccordionItem key={p.id} value={p.id} className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-left font-medium">{p.titolo}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ProcessoBlock p={p} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="space-y-8">
          {perArea.map((area) => (
            <Card key={area.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{area.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Accordion type="multiple" className="space-y-2">
                  {area.processi.map((p) => (
                    <AccordionItem
                      key={p.id}
                      value={p.id}
                      className="border rounded-lg px-4 bg-muted/20"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <span className="text-left font-medium text-sm">{p.titolo}</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ProcessoBlock p={p} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground border-t pt-4">
        {GUIDA_PROCESSI.length} processi documentati · aggiornamento manuale — se qualcosa
        non corrisponde al comportamento in produzione, segnalalo al team.
      </p>
    </div>
  );
};

export default GuidaOperativaPage;
