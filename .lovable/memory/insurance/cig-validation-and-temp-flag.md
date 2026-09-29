---
name: CIG validation and temporary flag
description: Codice CIG vive SOLO a livello di polizza/quietanza (titoli.cig_rif) e solo se il cliente collegato è ENTE. Rimosso da anagrafica cliente. Validato come 10 caratteri alfanumerici (regex `/^[A-Z0-9]{10}$/`) via helper `src/lib/validateCig.ts`. Flag `cig_temporaneo` (boolean): se attivo rilassa la validazione (basta non vuoto).
type: feature
---

## Regola principale
- **CIG appartiene alla polizza/quietanza**, NON all'anagrafica cliente.
- Visibile/obbligatorio **solo** quando `cliente.gruppi_finanziari.tipo_soggetto === 'ente'` (fallback su `clienti.tipo_cliente === 'ente'`).
- Per Privati e Aziende il campo è **nascosto** in ImmissionePolizzaPage e TitoloDetail; in submit `cig_rif=null`, `cig_temporaneo=false`.

## Schema (storico, conservato per dati esistenti)
- `clienti.codice_cig` — colonna lasciata in DB ma NON più editabile da UI (rimossa da ClienteDetail).
- `clienti.cig_temporaneo` — idem, legacy.
- `titoli.cig_rif` — sorgente di verità per la singola polizza/quietanza.
- `titoli.cig_temporaneo boolean NOT NULL DEFAULT false`.
- Indici parziali: `idx_titoli_cig_temp` (WHERE = true).

## Helper
`src/lib/validateCig.ts`:
- `normalizeCig(v)` → uppercase + strip spazi
- `isValidCig(v)` → `/^[A-Z0-9]{10}$/`
- `isValidCigWithFlag(v, temporaneo)` → se temporaneo: solo non vuoto; altrimenti regex

## UI (solo Ente)
- Input CIG con `font-mono`, auto-uppercase, maxLength 10 (40 se temporaneo).
- Checkbox "CIG temporaneo (formato libero)" sotto il campo.
- Errore inline "CIG: 10 caratteri alfanumerici" quando non valido e flag OFF.
- Submit polizza bloccato se CIG vuoto o non valido (con flag OFF) per Enti.
