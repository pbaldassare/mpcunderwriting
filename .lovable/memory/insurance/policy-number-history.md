---
name: Storico numeri polizza
description: Quando la compagnia emette un nuovo numero su Sostituzione/Sospensione/Riattivazione, la polizza resta la stessa (stesso titoli.id) e il vecchio numero viene archiviato
type: feature
---

## Modello

Stessa polizza (UN solo record madre + figli quietanze): si aggiorna `titoli.numero_titolo` su tutte le righe con `numero_titolo = vecchio`, e i riferimenti `sostituisce_polizza = vecchio`. Il numero precedente va in `titoli_numeri_storici`.

## DB

Tabella `titoli_numeri_storici`:
- `titolo_id` FK `titoli(id)` ON DELETE CASCADE
- `numero_precedente`, `numero_nuovo` text
- `causale` text CHECK in (`sostituzione`,`sospensione`,`riattivazione`)
- `motivo`, `riferimento_id` (es. `titoli_sostituzioni.id`)
- `cambiato_da_user_id`, `cambiato_il`

RLS: SELECT/INSERT/UPDATE authenticated, DELETE solo admin.

## Helper

`src/lib/aggiornaNumeroPolizza.ts` — esegue update propagato + insert storico. No-op se `numeroNuovo` vuoto o uguale al corrente.

## UI

Campo "Nuovo numero polizza (opzionale)" presente in:
- `SostituzionePolizzaDialog` (causale `sostituzione`, riferimento_id = `titoli_sostituzioni.id`)
- `SospensionePolizzaDialog` (causale `sospensione`)
- `RiattivazionePolizzaDialog` (causale `riattivazione`)

In `TitoloDetail` la sezione "Numeri polizza storici" (collapsible, nascosta se vuota) mostra la cronologia letta da `titoli_numeri_storici`.

## Sostituzione — campi per ramo

- **RCA Auto** (rilevato da `veicoli_polizza` o `targa_telaio`): blocco veicolo completo (targa, telaio, marca, modello, versione, tipo, alimentazione, cc, kW, CV, posti, immatricolazione, classe BM, provincia). Aggiorna `veicoli_polizza` + snapshot in `titoli_sostituzioni.parametri_new`.
- **Altri rami** (Vita, Trasporti, Property, Infortuni…): blocco generico con `descrizione`, `ubicazione_rischio`, `valore_assicurato`, `riferimento_oggetto`. Solo snapshot in `titoli_sostituzioni.parametri_new`, no modifiche a tabelle dedicate.
