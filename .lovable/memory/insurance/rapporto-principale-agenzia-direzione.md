---
name: Rapporto principale Agenzia/Direzione
description: Per tipo agenzia e direzione un solo rapporto principale, auto-creato dall'anagrafica con sync bidirezionale
type: feature
---

## Regola
- `compagnie.tipo IN ('agenzia','direzione')` → relazione 1:1 con `compagnia_rapporti`. Esiste un solo rapporto, flaggato `is_principale=true`.
- Altri tipi (broker, plurimandataria, sub-agenzia, ecc.) → N:N, lista standard, "Nuovo Rapporto" disponibile.

## DB
- `compagnia_rapporti.is_principale boolean NOT NULL DEFAULT false`.
- Unique index parziale: un solo principale per `compagnia_id`.
- Trigger `tg_compagnie_auto_rapporto_principale` (AFTER INSERT) crea il rapporto principale al volo per agenzia/direzione (copia nome, codice, IBAN, sede, gruppo, note, conto_bancario).
- Sync bidirezionale tramite `tg_compagnie_sync_rapporto_principale` e `tg_rapporto_principale_sync_compagnia` (guard con `pg_trigger_depth()` per evitare loop).
- Backfill one-shot eseguito 21/05/2026 per agenzie esistenti.

## UI
- `RapportiCompagniaDialog.tsx`: se `compagnie.tipo IN ('agenzia','direzione')` nasconde "Nuovo Rapporto" e mostra banner informativo.
