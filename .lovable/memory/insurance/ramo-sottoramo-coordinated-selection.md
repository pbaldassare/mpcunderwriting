---
name: Selezione coordinata Ramo / Sottoramo
description: Componente RamoSottoramoSelect e RamoSottoramoFilter che coordinano gruppi_ramo (Ramo) e rami (Sottoramo). Colonna legacy titoli.gruppo_ramo eliminata.
type: feature
---

## Convenzione UI

- **Ramo** = `gruppi_ramo` (es. `ZQ - R.C.A.`)
- **Sottoramo** = `rami` (es. `PI - R.C. AUTOVEICOLI`), filtrato per il gruppo selezionato.

## Database

- `titoli.gruppo_ramo` (text) **eliminata** (era sempre NULL e fuorviante).
- Verità: `titoli.ramo_id → rami.gruppo_ramo_id → gruppi_ramo`.
- Vista `v_portafoglio_titoli` ricreata: espone `gruppo_ramo` (codice), `gruppo_ramo_id`, `gruppo_ramo_descrizione` derivati via JOIN.

## Componenti riusabili

- `src/hooks/useRamiLookup.ts` → `useGruppiRamo()`, `useRamiAll()`, `useRami(gruppoRamoId?)`.
- `src/components/polizze/RamoSottoramoSelect.tsx` — coppia di `SearchableSelect` per i form (Polizze, Trattative). Cambio Ramo resetta Sottoramo se incoerente; cambio Sottoramo auto-popola Ramo.
- `src/components/polizze/RamoSottoramoFilter.tsx` + `expandRamoFilter()` — variante filtro per liste; quando si seleziona solo il Gruppo, il filtro si espande in `ramo_id IN (...lista sottorami)`.

## Pagine integrate

Form: `ImmissionePolizzaPage`, `TitoloDetail` (modifica contratto), `TrattativaDettagliTab`, `TrattativeList` (creazione).
Filtri lista: `PortafoglioAttivePage`, `PortafoglioStoricoPage`.
Le altre pagine con filtro ramo (Provvigioni*, EC*Pdf, ClienteDetail, ProspectDetail, ClienteDashboard, StoricoTrattativePage) restano sul filtro singolo finché non aggiornate; possono adottare lo stesso pattern.

## Salvataggio

Il backend continua a persistere **solo `ramo_id`** (sottoramo). Il gruppo si deriva sempre via join. Nessuno schema change su `trattative` o `titoli` oltre alla DROP COLUMN.
