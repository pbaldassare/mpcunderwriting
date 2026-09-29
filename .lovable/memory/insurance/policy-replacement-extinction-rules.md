---
name: Sostituzione e Estinzione polizza — regole
description: Sostituzione mantiene contratto e scadenze, cambia oggetto + 1 titolo conguaglio; Estinzione chiude polizza, cancella future, rimborso opzionale; importi inseriti a mano
type: feature
---

## Sostituzione (`SostituzionePolizzaDialog`)

- Il **contratto resta in essere**: stesso `numero_titolo`, stesse rate/scadenze. Cambia solo l'**oggetto** (veicolo/bene/parametri).
- Form: data, causale (Cambio veicolo / bene / massimali / dati / Altro), motivo, nuovi parametri (RCA: targa/marca/modello/telaio; altri rami: descrizione), **conguaglio** numerico libero (positivo = a carico cliente, negativo = rimborso). Nessun calcolo automatico.
- Effetti mutation:
  1. Update `veicoli_polizza` (se RCA) + update `titoli` con `data_sostituzione`, `causale_sostituzione`, `motivo_sostituzione`, `targa_telaio` o `descrizione_polizza`.
  2. Se `conguaglio !== 0`: insert nuovo titolo "Conguaglio sostituzione DD/MM/YYYY" (riga successiva, `premio_lordo=conguaglio`, `sostituisce_polizza/riga` riferito alla madre, split commerciali copiati 1:1 da `titoli_split_commerciali`).
  3. Insert in `titoli_sostituzioni` snapshot `parametri_precedenti` + `parametri_nuovi` + conguaglio + `titolo_conguaglio_id`.
  4. Upload documento opzionale (`documenti_titoli/titolo/{id}/sostituzione_*`).
  5. Insert `movimenti_polizza` `tipo_documento='SO'`, `stato='attivo'`.
  6. `logAttivita('sostituzione_polizza', ...)`.
- Le quietanze esistenti **non vengono toccate**.

## Estinzione (`EstinzionePolizzaDialog`)

- **Nessun concetto di penale**. Solo eventuale rimborso al cliente (importo a mano).
- Form: data, causale (Recesso cliente / compagnia / Vendita bene / Cessazione / Disdetta / Sinistro / Altro), motivo, **rimborso** numerico (default 0).
- Effetti mutation:
  1. Update polizza madre: `stato='estinto'`, `data_estinzione`, `causale_estinzione`, `motivo_estinzione`.
  2. Cancella quietanze future non incassate e `data_messa_cassa IS NULL` (stesso pattern Sospensione: prima pulisce `movimenti_polizza` e `premi_garanzia_polizza`, poi `titoli`).
  3. Se `rimborso > 0`: insert titolo "Rimborso estinzione DD/MM/YYYY" con `premio_lordo=-rimborso`, split copiato dalla madre.
  4. Upload documento opzionale (`/estinzione_*`).
  5. Insert `movimenti_polizza` `tipo_documento='ES'`, `stato='estinto'`.
  6. `logAttivita('estinzione_polizza', ...)`.

## Effetti contabili (entrambi)

- I titoli conguaglio/rimborso entrano nel ciclo normale (Carico del Mese → Messa a Cassa → trigger `calcola-provvigioni`). Importi negativi producono provvigioni di storno coerenti con la quota madre.
- `stato='estinto'` rientra nelle filtri "Storico polizze" (`PortafoglioStoricoPage`).

## Schema DB

- `titoli`: `data_estinzione`, `causale_estinzione`, `motivo_estinzione`, `data_sostituzione`, `causale_sostituzione`, `motivo_sostituzione`.
- `titoli_sostituzioni` (snapshot storici): `titolo_id`, `data_sostituzione`, `causale`, `motivo`, `parametri_precedenti jsonb`, `parametri_nuovi jsonb`, `conguaglio`, `titolo_conguaglio_id`. RLS: SELECT/INSERT/UPDATE auth; DELETE admin/responsabile_sede.

## File

- `src/components/polizze/SostituzionePolizzaDialog.tsx`
- `src/components/polizze/EstinzionePolizzaDialog.tsx`
- `src/pages/TitoloDetail.tsx` (sostituiti pulsanti card Operazioni: rimosso Duplicazione, aggiunti Sostituzione + Estinzione)
- `src/pages/PortafoglioStoricoPage.tsx` (filtro stati include `estinto`)
