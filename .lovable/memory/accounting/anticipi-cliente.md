---
name: Anticipi cliente
description: Versamenti pre-incasso del cliente, scalati su messe a cassa con residuo parziale e tracciabilità
type: feature
---
# Anticipi Cliente

Permette al cliente di versare denaro **prima** della messa a cassa di una o più polizze e di utilizzarlo automaticamente all'incasso.

## Tabelle
- `cliente_anticipi`: `cliente_id`, `data_anticipo`, `conto_bancario_id` (Consulbrokers tipo `incasso_clienti`/`generico`), `importo`, `importo_residuo`, `note`. Trigger `trg_anticipi_init_residuo` (BEFORE INSERT) inizializza residuo = importo.
- `cliente_anticipi_utilizzi`: `anticipo_id`, `titolo_id` (ON DELETE CASCADE — annullamento polizza rilascia automaticamente), `importo_utilizzato`, `data_utilizzo`. Trigger `trg_anticipi_utilizzi_residuo` ricalcola `cliente_anticipi.importo_residuo` e blocca sovra-utilizzo.

## UI
- Card `AnticipiCard` in `ClienteDetail` tab Polizze, colonna destra (grid 2/3 + 1/3).
- Hook `useAnticipiCliente.ts` con `useAnticipiCliente`, `useAnticipiDisponibili`, `useAnticipoUtilizzi`, `useCreaAnticipo`, `useEliminaAnticipo`.
- `MessaCassaDialog`: mostra sezione "Anticipi disponibili" SOLO se tutti i titoli appartengono allo stesso cliente. Checkbox + input importo modificabile, default = min(residuo, daCoprire). Distribuzione FIFO sui titoli per bulk.
- `tipo_pagamento` settato dalla messa a cassa:
  - `'anticipo'` → coperto interamente da anticipi
  - `'anticipo_misto'` → parte anticipo + parte cash/bonifico
  - tipo classico → nessun anticipo usato

## Rilascio
- `annullaMessaACassa.ts` esegue DELETE su `cliente_anticipi_utilizzi` prima del reset titolo → residuo torna disponibile.
- Cascade annullamento polizza (`policy-cancellation-cascade`): FK ON DELETE CASCADE su `titolo_id` rilascia tutto.

## RLS
- Staff (admin/cfo/ufficio/backoffice/contabilita/manager): FULL via check su `profiles.ruolo`.
- Cliente: SELECT-only su anticipi del proprio `clienti.user_id`.

## Limitazione nota
TitoloDetail ha un dialog di Incassa proprietario (non condiviso) che NON include la sezione anticipi. Per usare gli anticipi serve passare da `PortafoglioCaricoPage`. Refactor futuro: condividere `MessaCassaDialog` anche in TitoloDetail.
