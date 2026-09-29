---
name: Regolazione come promemoria
description: titoli.regolazione è un flag promemoria con data presunta e fattore (fatturato/dipendenti/retribuzioni/altro). Card "Regolazioni Attese" in Gestione Polizze. Da non confondere con titoli_regolazioni (regolazione eseguita).
type: feature
---

## Semantica

`titoli.regolazione` (boolean) è la **verità del promemoria**: indica che la polizza dovrà essere regolata. Quando ON, sono valorizzati:

- `regolazione_data_presunta DATE` — quando va fatta
- `regolazione_fattore TEXT` ∈ `('fatturato','num_dipendenti','retribuzioni','altro')`
- `regolazione_note TEXT` — note libere

Quando il flag passa a OFF la UI azzera i tre campi in submit.

Convivono i campi legacy `periodicita`, `tipo_scadenza`, `giorni_presentazione`,
`tipo_lettera_regolazione`, `libro_matricola` (restano dove sono).

## Distinzione

- **`titoli.regolazione` + nuovi campi** = promemoria (questa feature).
- **`titoli_regolazioni`** = regolazione **eseguita** (consuntivo, conguaglio, titolo figlio generato). Non toccata.

## UI

- `TitoloDetail` sezione "Regolazione": Switch "Polizza in regolazione (promemoria)"; quando ON appare blocco ambra con Data presunta, Fattore (SearchableSelect), Note. Lock se messa a cassa/incassato/stornato.
- `GestionePolizzePage` (`/portafoglio/gestione`):
  - Card **"Regolazioni Attese"** (icona `FileClock`) con badge live ambra (conteggio `regolazione=true` in stati attivo/sospeso/incassato).
  - "Esegui" naviga a `/titoli/:id?section=regolazione`.
  - Filtro segmentato "Regolazione" (Tutti / In reg. / Senza) con persistenza in URL `reg=`, nascosto sull'operazione dedicata.
  - Colonna "Reg." in tabella: badge rosso se scaduta, giallo se entro 30gg, ambra altrimenti.

## Indice

`idx_titoli_regolazione_flag` su `regolazione_data_presunta WHERE regolazione = true` per ordinamento veloce nella card.
