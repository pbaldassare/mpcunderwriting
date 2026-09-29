---
name: Filiali deprecated — unified into Sedi
description: Filiali concept merged into Sedi (uffici). Table `filiali` and text columns `titoli.filiale` / `codici_commerciali_cliente.filiale` kept only for legacy/history — do NOT expose in UI. Sede address now stored as structured fields (indirizzo + cap + citta + provincia) on `uffici`.
type: constraint
---

Filiale = Sede. Single entity is `uffici` (UI label "Sede").

Address on `uffici` is now STRUCTURED:
- `indirizzo` text — via + civico (street line)
- `cap` text — 5-digit postal code
- `citta` text — city name
- `provincia` text — 2-letter province code (uppercase)

The legacy single-string `indirizzo` is kept; new entries split the address across the 4 fields. `DocPrecontrattualePage.applySede` prefers the structured fields and falls back to `parseIndirizzoSede(indirizzo)` for legacy rows.

What was removed from UI:
- Tabelle Base lookup voice "Filiali"
- Field "Filiale" in Anagrafica Cliente / ruoli commerciali (`ClienteDetail` + `ClientiList`)
- Filter "Filiale" in `RinnoviPolizzaPage`
- Option "Filiale" in `DocPrecontrattualePage` (tipo riferimento RUI)

What was kept in DB (history only, do NOT delete, do NOT re-expose):
- Table `public.filiali` (18 legacy rows)
- Column `titoli.filiale` (text, ~1043 rows)
- Column `codici_commerciali_cliente.filiale` (text, ~543 rows)

**Why:** the user explicitly stated Sedi and Filiali are the same thing. Use only `uffici` going forward. New UI must NOT add a "Filiale" selector — use Sede (`ufficio_id`) instead. CAP/Città/Provincia of the Sede must be edited via Sedi management, not via legacy `filiali`.
