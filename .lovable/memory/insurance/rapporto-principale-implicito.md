---
name: Rapporto principale implicito
description: Ogni agenzia/direzione/broker/plurimandataria in `compagnie` è già il proprio rapporto principale; `compagnia_rapporti` contiene solo i rapporti aggiuntivi
type: feature
---

## Regola

Ogni record in `compagnie` di tipo **agenzia / direzione / broker / plurimandataria** rappresenta **già di per sé un rapporto** (il *rapporto principale*).
La tabella `compagnia_rapporti` contiene **solo i rapporti aggiuntivi** (es. plurimandatarie con più mandati, co-assicurazioni, broker che gestiscono più portafogli).

## Implicazioni

- **UI colonna "Rapporti"** (tab Agenzie in `/compagnie`): il numero mostrato = `count(compagnia_rapporti attivi) + 1`. Mai 0. (Stesso pattern per `tot + 1` se ci sono inattivi.)
- **Non creare** record fittizi in `compagnia_rapporti` per rappresentare il rapporto principale: causa duplicazioni in matrici provvigioni, rimesse, flussi.
- **Verifica esistenza agenzia**: quando il nome di una "agenzia/broker" appare in un'importazione (es. Excel polizze), bisogna controllare se esiste come **record `compagnie`** (non come `compagnia_rapporti`).

## File chiave

- `src/pages/CompagnieList.tsx` (cella colonna "Rapporti" tab Agenzie)
- `RapportiCompagniaDialog` gestisce solo gli aggiuntivi
- RPC `get_rapporti_counts_per_compagnia` ritorna solo il count di `compagnia_rapporti`
