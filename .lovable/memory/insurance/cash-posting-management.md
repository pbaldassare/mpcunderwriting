---
name: Cash posting management
description: Messa a Cassa rules, state transitions, anti-double-incasso protection
type: feature
---
# Messa a Cassa - Regole

- La messa a cassa porta lo stato del titolo da `attivo` → `incassato` e valorizza `data_messa_cassa`, `data_pagamento`, `data_decorrenza_rinnovo`, `data_incasso`, `importo_incassato`.
- I bottoni **Incassa** e **Garantito** in `TitoloDetail` e l'azione bulk in `PortafoglioCaricoPage` sono visibili SOLO quando: `stato === 'attivo' && (!data_messa_cassa || isPoliennale)`.
- Polizze **poliennali** (durata > 13 mesi) restano in stato `attivo` anche dopo la messa a cassa della rata corrente, perché hanno rate residue future.

## Protezione anti-doppio-incasso (DB)

Trigger `trg_prevent_double_messa_cassa` (BEFORE UPDATE su `titoli`, funzione `public.prevent_double_messa_cassa`):

- Blocca update che cambiano `data_messa_cassa` quando OLD era già non-null (eccetto poliennali attive).
- Blocca update che cambiano `data_incasso` quando stato era già `incassato` (eccetto poliennali).
- **Bypass admin**: `SET LOCAL app.bypass_messa_cassa_lock = 'on'` nella sessione (stessa convenzione di `lock_premi_storici`).
- Per reincassare una polizza non-poliennale serve prima annullare la messa a cassa precedente (UI: bottone "Annulla Incasso/Messa a Cassa", admin only).
