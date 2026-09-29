---
name: Sottorami default CF / Oneri per ogni Ramo
description: Ogni gruppi_ramo ha sempre due sottorami `<CODICE>-CF` (CONTRIBUTO FORZOSO) e `<CODICE>-ON` (ONERI) con flag rami.escludi_provvigioni=true. Trigger trg_seed_cf_oneri li crea su INSERT di un nuovo Gruppo.
type: feature
---

## Schema

- `rami.escludi_provvigioni boolean NOT NULL DEFAULT false`: se true il sottoramo è "esente":
  - tasse forzate a 0 (l'aliquota nel record è 0 ma la UI le blocca comunque)
  - `resolvePercentualeProvvigione` early-return 0% (fonte: "sottoramo esente (CF/Oneri)")

## Seed

Per ogni `gruppi_ramo` esistono due rami con codici prefissati:
- `<codice_gruppo>-CF` — descrizione `CONTRIBUTO FORZOSO`
- `<codice_gruppo>-ON` — descrizione `ONERI`

Esempio: ramo `ZD CORPI` → `ZD-CF`, `ZD-ON`.

## Trigger automatico

`trg_seed_cf_oneri` (AFTER INSERT su `gruppi_ramo`) chiama `public.trg_gruppi_ramo_seed_cf_oneri()`:
crea le due righe `<NEW.codice>-CF` e `<NEW.codice>-ON` con `escludi_provvigioni=true`,
`aliquota_tasse_ramo=0`, `aliquota_tasse_ard=0`, `ssn_attivo=false`, `attivo=true`.
Idempotente (ON CONFLICT codice DO NOTHING).

## UI

- `PremiGaranziaCardShell`: il `SearchableSelect` Voce mostra " · esente" nel label; selezionando un sottoramo esente le tasse vengono fissate a 0 e l'input disabilitato.
- `GaranziaRow.escludiProvvigioni` espone il flag a livello riga (transient, non persistito sul titolo).
- `useRamiLookup.RamoOption` include `escludi_provvigioni`.

## Note

Non vengono inserite righe a 0% nelle matrici provvigioni (compagnia_rapporto_rami, produttori_provvigioni_per_ramo): il flag a livello sottoramo basta a saltare il calcolo.
