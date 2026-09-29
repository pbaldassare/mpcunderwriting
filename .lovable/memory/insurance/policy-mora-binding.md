---
name: GG Mora ↔ Limite Mora — binding bidirezionale
description: Collegamento automatico tra titoli.mora_giorni e titoli.limite_mora basato su data_competenza (fallback garanzia_da). Persistito in DB e usabile come filtro.
type: feature
---

## Regola

- Base date = `titoli.data_competenza` (fallback `titoli.garanzia_da`).
- `limite_mora = base_date + mora_giorni`.
- L'utente può cambiare uno dei tre campi (data_competenza, mora_giorni, limite_mora): gli altri si ricalcolano:
  - Cambio `mora_giorni` o `data_competenza` → ricalcola `limite_mora`.
  - Cambio `limite_mora` → ricalcola `mora_giorni = round(diff_days(limite_mora, base))`, min 0.

## Persistenza

Entrambi i campi sono salvati su `titoli`: `mora_giorni (int)` e `limite_mora (date)`. Nessuna nuova colonna.

## File

- `src/pages/ImmissionePolizzaPage.tsx` — handler inline su Data Competenza / Limite Mora / GG Mora.
- `src/pages/TitoloDetail.tsx` — periodoForm: stesso binding bidirezionale.

## Filtri futuri

I due campi sono pronti per scadenziari "polizze in mora" e cruscotti: filtrare per `limite_mora < today AND stato != 'incassato'`.
