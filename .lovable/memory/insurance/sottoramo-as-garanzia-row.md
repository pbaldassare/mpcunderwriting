---
name: Sottoramo come riga garanzia in immissione
description: In ImmissionePolizzaPage il Sottoramo non è più un campo singolo accanto al Ramo; si seleziona riga per riga nelle card "Composizione Premio" (Firma + Quietanza). Il catalogo riga è `rami` filtrato per gruppo. titoli.ramo_id è derivato dalla prima riga garanzia non vuota.
type: feature
---

## Modello UI (immissione)

- Card **Contratto** mostra solo **Ramo** (`gruppi_ramo`), tramite `RamoSottoramoSelect gruppoOnly`.
- Le card **Premi per Garanzia — Firma** e **— Quietanza** (`PremiGaranziaCardShell`) hanno una colonna "Voce" che è un `SearchableSelect` di **sottorami** (`rami` filtrati per `gruppo_ramo_id = selectedGruppoRamoId`).
- Cambio Ramo → reset righe garanzia (sottorami precedenti potrebbero non essere validi).
- Ogni riga ha `sottoramoId` (rami.id), `codice`, `descrizione`, `aliquotaTasse` (default da `rami.aliquota_tasse_ramo`), `netto`, `tasse`.

## Salvataggio

- `titoli.ramo_id` continua a puntare a `rami.id` (sottoramo). Si **deriva** dalla prima riga firma non vuota (fallback: prima quietanza).
- Validazione: serve almeno un Ramo selezionato e una riga garanzia con sottoramo.
- `premi_garanzia_polizza.garanzia` resta testo (codice o descrizione del sottoramo).

## Note

- `TitoloDetail` (modifica polizza esistente) usa ancora il selettore Ramo+Sottoramo legacy via `RamoSottoramoSelect`; allineamento successivo.
- Catalogo `rca_garanzie` non più usato come sorgente delle voci premio in immissione (resta per altri usi).
