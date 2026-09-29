---
name: Policy cancellation cascade
description: Annullamento polizza via RPC transazionale annulla_polizza_cascade con delete in cascata
type: feature
---
# Annullamento polizza — cascade transazionale

L'azione "Annullamento" in `TitoloDetail` chiama `src/lib/annullaPolizza.ts` che invoca la RPC DB
`public.annulla_polizza_cascade(p_titolo_id uuid)` (SECURITY DEFINER, transazione unica).

## Cosa elimina (ordine FK-safe, dentro la stessa transazione)
1. `pagamenti_provvigioni_righe` (anche se la provvigione era già pagata)
2. `provvigioni_generate` (tutte, comprese pagate)
3. `rimessa_dettaglio`
4. `movimenti_contabili` con `riferimento_tipo='titolo'`
5. `movimenti_polizza`
6. `titoli_split_commerciali`
7. Quietanze discendenti via lookup ricorsivo su `sostituisce_polizza`/`sostituisce_riga` (delete fisica)
8. **Cleanup**: `rimessa_premi` rimaste senza righe vengono eliminate
9. Reset titolo target: `stato='annullato'`, azzera `data_messa_cassa`, `data_incasso`,
   `data_pagamento`, `importo_incassato`, `tipo_pagamento`, `banca_pagamento`,
   `conferimento_gestito=false`, `data_conferimento_gestito=null`

## Log
Un solo record in `log_attivita` con `azione='annullamento_polizza_cascade'`,
`severity='warning'`, `dettagli_json` con tutti i conteggi (incluso flag
`includeva_provvigioni_pagate`).

## UI
- Il bottone "Annullamento" è disabilitato quando `stato === 'annullato'`.
- Il toast post-azione elenca tutti i conteggi (quietanze, provvigioni, righe pagamento,
  righe rimessa, testate rimessa, movimenti, split).
- `pagamenti_provvigioni` (testata) non viene toccata: solo le righe collegate al titolo.
- `annullaMessaACassa` resta separato per annullare solo l'incasso senza annullare la polizza.

## Pannello "Dove sono salvati i dati"
`TitoloDataPersistenceInfo` mostra entry dedicate per: Messa a Cassa/Incasso,
Rimessa Premi e Annullamento Polizza con le tabelle aggiornate.
