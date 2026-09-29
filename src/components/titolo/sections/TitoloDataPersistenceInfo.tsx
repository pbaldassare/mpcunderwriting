import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Database,
  ChevronDown,
  RefreshCw,
  Clock,
  CheckSquare,
  ArrowRightLeft,
  FileText,
  XCircle,
  AlertTriangle,
  DollarSign,
  Banknote,
  Ban,
} from "lucide-react";

/**
 * Pannello informativo statico "Dove sono salvati i dati" — reference
 * delle tabelle aggiornate per ogni operazione di ciclo vita polizza.
 * Estratto 1:1 da TitoloDetail.tsx (nessuno stato, nessuna prop).
 */
export function TitoloDataPersistenceInfo() {
  const items = [
    {
      icon: RefreshCw,
      nome: "Regolazione",
      header: "titoli — campi: regolazione=true, tipo_scadenza, periodicita, scadenza_regolazione",
      movimento: "— nessun movimento dedicato (è una proprietà del titolo, non un evento)",
      collegate: "attivita_log",
      note: null as string | null,
    },
    {
      icon: Clock,
      nome: "Sospensione",
      header: "titoli (madre) — campi: stato='sospeso', data_sospensione, quietanze_sospensione_snapshot",
      movimento: "movimenti_polizza — tipo_documento='SO' sul titolo oneri sospensione (is_oneri_sospensione=true)",
      collegate: "titoli quietanze congelate (stato='sospeso') + attivita_log",
      note: "Le quietanze future e in corso non vengono eliminate: vengono congelate e bloccate all'incasso fino alla riattivazione.",
    },
    {
      icon: CheckSquare,
      nome: "Riattivazione",
      header: "titoli (madre) — campi: stato='attivo', data_riattivazione, date estese (garanzia_a, data_scadenza, durata_a)",
      movimento: "movimenti_polizza — tipo_documento='RA' sul titolo oneri riattivazione (is_oneri_riattivazione=true)",
      collegate: "titoli quietanze ripristinate con shift date + attivita_log",
      note: "Le quietanze congelate vengono riattivate con date shiftate in base alla durata della sospensione.",
    },
    {
      icon: ArrowRightLeft,
      nome: "Sostituzione / Rinnovo",
      header: "titoli — stesso numero_titolo aggiornato (veicolo/oggetto) + titolo conguaglio (anche €0)",
      movimento: "movimenti_polizza — tipo_documento='SO' sulla polizza madre (non RN, nessun nuovo numero)",
      collegate: "titoli_sostituzioni + attivita_log",
      note: null,
    },
    {
      icon: FileText,
      nome: "Appendice",
      header: "titoli — invariato (la polizza non cambia)",
      movimento: "movimenti_polizza — tipo_documento='AP' (riferimento all'appendice)",
      collegate: "appendici_polizza (record principale) + Storage (file PDF allegato)",
      note: null,
    },
    {
      icon: XCircle,
      nome: "Storno",
      header: "titoli — campi: stato='scaduto', data_storno",
      movimento: "— (gap noto: nessun movimento dedicato 'ST' viene attualmente generato)",
      collegate: "attivita_log",
      note: "Lo storno aggiorna solo lo stato del titolo. Non viene creata una riga in movimenti_polizza con tipo_documento='ST'.",
    },
    {
      icon: DollarSign,
      nome: "Messa a Cassa / Incasso",
      header: "titoli — campi: stato='incassato' (o 'attivo' per poliennali), data_messa_cassa, data_pagamento, data_incasso, importo_incassato, tipo_pagamento, banca_pagamento",
      movimento: "movimenti_contabili (riferimento_tipo='titolo') + trigger auto-genera quietanza successiva nei titoli (frazionamento)",
      collegate: "log_attivita + notifica_messa_cassa_inviata + PDF in documenti_titoli (categoria notifica_messa_cassa)",
      note: "Protezione anti-doppio-incasso: trigger DB blocca un secondo incasso senza prima annullare quello in corso (admin only).",
    },
    {
      icon: Banknote,
      nome: "Rimessa Premi (verso compagnia/agenzia)",
      header: "rimessa_premi — campi: stato, totale_importi, data_pagamento_rimessa, iban_utilizzato, xml_output, pdf_url",
      movimento: "rimessa_dettaglio — righe { rimessa_id, titolo_id, importo } per ogni titolo incluso",
      collegate: "log_attivita ('rimessa_in_pagamento') + Storage 'rimesse-pdf' + flussi_compagnie (XML)",
      note: "Un titolo è eleggibile per rimessa solo se messo a cassa (data_messa_cassa) e non già incluso in altra rimessa non annullata.",
    },
    {
      icon: Ban,
      nome: "Annullamento Polizza (cascade)",
      header: "titoli — campi: stato='annullato' + reset data_messa_cassa/data_incasso/data_pagamento/importo_incassato/tipo_pagamento/banca_pagamento/conferimento_gestito",
      movimento: "RPC transazionale annulla_polizza_cascade — elimina: pagamenti_provvigioni_righe, provvigioni_generate, rimessa_dettaglio, movimenti_contabili, movimenti_polizza, titoli_split_commerciali, quietanze discendenti (delete fisica) + testate rimessa_premi rimaste vuote",
      collegate: "log_attivita (azione='annullamento_polizza_cascade', severity='warning', conteggi in dettagli_json)",
      note: "Operazione irreversibile. Il titolo madre resta in stato 'annullato' come ancora per il log; tutto il resto è eliminato fisicamente (anche provvigioni già pagate).",
    },
  ];

  return (
    <Collapsible>
      <Card className="border-l-4 border-l-teal-600 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer bg-teal-50/60 dark:bg-teal-950/20 border-b hover:bg-teal-100/60 dark:hover:bg-teal-900/30 transition-colors">
            <CardTitle className="text-sm sm:text-base font-semibold text-teal-900 dark:text-teal-100 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                Dove sono salvati i dati
                <span className="text-xs font-normal text-muted-foreground">
                  (reference tabelle aggiornate per ogni operazione)
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-teal-700/70 dark:text-teal-300/70 transition-transform data-[state=open]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 text-sm">
            {items.map((op) => {
              const Icon = op.icon;
              return (
                <div key={op.nome} className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2 font-semibold">
                    <Icon className="w-4 h-4 text-primary" />
                    <span>{op.nome}</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground pl-6">
                    <div><span className="font-medium text-foreground">Tabella header:</span> <code className="font-mono text-[11px]">{op.header}</code></div>
                    <div><span className="font-medium text-foreground">Movimento:</span> <code className="font-mono text-[11px]">{op.movimento}</code></div>
                    <div><span className="font-medium text-foreground">Tabelle collegate:</span> <code className="font-mono text-[11px]">{op.collegate}</code></div>
                    {op.note && (
                      <div className="flex gap-1 mt-2 pt-2 border-t border-border/50 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{op.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
