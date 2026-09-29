---
name: Compagnie form pulita (post-reset 16/05/2026)
description: Form Agenzia/Broker/Direzione/Plurimandataria; tipi, condizionali compagnia madre, provvigioni fuori form
type: feature
---

## Tipi (constraint DB `compagnie_tipo_check`)
`agenzia` · `broker` · `direzione` · `plurimandataria`

## Compagnia madre (`gruppo_compagnia_id`)
- **Obbligatoria** solo per `agenzia` e `direzione`.
- **Non mostrata** per `broker` e `plurimandataria` → i loro legami con le compagnie si gestiscono via `compagnia_rapporti` (tab "Rapporti" nella riga tabella).
- Nel `SearchableSelect` è disponibile opzione "— Nessuna —" (`__none__` mappato a stringa vuota).

## Form (3 tab)
1. **Identificativi**: tipo (radio), codice (UNIQUE case-insensitive, uppercase), stato, ragione sociale, compagnia madre (condizionale).
2. **Anagrafica**: CF/P.IVA, indirizzo, contatti.
3. **RUI & Bancario**: sezione+numero RUI, conto bancario, IBAN alternativo.

Tab **Provvigioni rimossa dalla form**: la gestione provvigioni avviene nelle pagine dedicate (`ProvvigioniMaturatePage`, sezione `provvigioni_compagnia_ramo`).

## Tabella elenco
Colonne: Codice · Ragione sociale · Tipo (badge colorato per tipo) · Compagnia madre · Comune · Stato · Rapporti · Attiva · Az.
Badge tipo: agenzia=emerald, broker=blue, direzione=purple, plurimandataria=orange.
Filtro per `tipo` con 5 opzioni (tutti + 4 tipi).

File: `src/pages/CompagnieList.tsx`.
