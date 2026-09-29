---
name: RCA Auto Specific Data
description: Validazioni e automazioni per polizze RCA Auto - catalogo veicoli locale, usi RCA come FK, tipi veicolo come rami
type: feature
---

La gestione delle polizze RCA Auto integra:

- **Catalogo veicoli locale**: tabelle `veicoli_marche` e `veicoli_modelli` (DB) con flag `popolare` per ordinamento. Inserimento on-the-fly dal form via `MarcaModelloCombobox`.
- **Tipi veicolo come rami**: i 16 ex `rca_settori` sono stati inglobati in `rami` con codici `RV01…RV16` e descrizioni `VEICOLO - …` sotto il gruppo `ZQ - R.C.A.`. La tabella `rca_settori` non esiste più.
- **Usi RCA**: tabella `rca_usi` (lista piatta, senza `settore_id`). Hook `useRcaUsi()` ritorna `{ value: id, label: "codice - descrizione", codice, descrizione }`. La colonna `veicoli_polizza.uso` è **uuid con FK a `rca_usi(id)`** (ON DELETE SET NULL). Il form salva/legge l'id; in lettura si risolve la label via lookup. Validazione UI: warning se l'id salvato non è tra le opzioni attive.
- **Form RCA** (`ImmissionePolizzaPage.tsx`, `TitoloDetail.tsx`): non c'è dropdown "Settore"; `vSettore` è popolato dal "Tipo Veicolo". Il dropdown "Uso" è sempre abilitato.
- **Campi obbligatori RCA Auto** (blocco salvataggio): `Tipo Veicolo`, `Targa`, `Uso`, `Tipologia Guida`. Label con asterisco rosso e bordo amber quando vuoti.
- **Tipologia Guida**: solo 2 valori ammessi → `Libera`, `Esperta`. "Esclusiva" rimosso ovunque (UI + AI mapping in `parse-polizza-completa` normalizza Esclusiva/Conducente unico → Esperta).
- **Permessi**: lettura per tutti gli authenticated; INSERT/UPDATE riservato a staff.
- **Classi BM**: 18 classi di merito (1–18) per RCA Auto.
- **Tipi veicolo hardcoded**: `TIPI_VEICOLO` in `src/lib/rcaConstants.ts` resta come riferimento alternativo nel form.
