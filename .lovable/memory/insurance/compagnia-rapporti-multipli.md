---
name: Rapporti agenzia-compagnia N:N
description: compagnia_rapporti per plurimandatarie/broker con più rapporti contemporanei, ognuno con nome, tipologia, sede partner e conto bancario dedicato
type: feature
---

## Modello
`compagnia_rapporti` lega una `compagnia` (broker/plurimandataria/agenzia) a un `gruppi_compagnia` (compagnia assicurativa madre). N:N: stessa compagnia può avere più rapporti con la stessa madre su sedi diverse.

## Campi rilevanti
- `nome_rapporto` (obbligatorio UI) — etichetta libera, es. "Nobis – Agenzia Torino Centro"
- `tipo_rapporto` — Agenzia, Direzione, Broker, Mandato diretto, Mandato principale, Sub-agenzia, Convenzione broker, Coverholder, Altro
- `gruppo_compagnia_id` (obbligatorio) — compagnia assicurativa madre
- `sede_denominazione`, `sede_indirizzo`, `sede_cap`, `sede_citta`, `sede_provincia` — sede operativa **della compagnia partner** (non del broker)
- `conto_bancario_id` — conto dedicato; fallback sul conto della compagnia madre se vuoto
- `codice_rapporto`, `rami_abilitati[]`, `data_inizio`, `data_fine`, `attivo`, `percentuale_provvigione`
- Referente: `referente_compagnia`, `email_referente`, `telefono_referente`

## UI
`src/components/compagnie/RapportiCompagniaDialog.tsx`. Tabella mostra Nome rapporto (con compagnia sotto) · Tipo · Sede (denom + città/prov) · Codice · Rami · date · % · stato.
