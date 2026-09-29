---
name: Storno e Regolazione Premio
description: Logica e UI per pulsanti Storno (annullo amministrativo) e Regolazione Premio (conguaglio fine periodo) sul TitoloDetail
type: feature
---

## Storno (`StornoTitoloDialog`)
- Disabilitato se stato in `stornato/estinto/sostituito/annullato`.
- Aggiorna titolo originale → `stato='stornato'`, `data_storno`, `causale_storno`, `motivo_storno`.
- Cancella sempre le quietanze future non incassate (stesso pattern di Estinzione: delete in `movimenti_polizza`, `premi_garanzia_polizza`, `titoli`).
- Se il titolo era **già a cassa** (`data_messa_cassa` o stato `incassato`): crea un **titolo speculare negativo** (premio/netto/provvigioni/accessori/tasse invertiti) in stato `attivo` **da_incassare** — verrà incassato in remittance, non subito. Salvato in `titoli.titolo_storno_id`.
- Documento opzionale nel bucket `documenti_titoli`.
- Snapshot in `titoli_storni` (causale, motivo, importo_rimborsato, era_messa_cassa, documento_id).
- Movimento `ST` in `movimenti_polizza`.

## Regolazione Premio (Immissione Polizza in `mode=regolazione`)
- Disabilitato se `titoli.regolazione !== true` (flag anagrafico della polizza nella sezione "Regolazione").
- **Punti di ingresso**: bottone "Regolazione" in TitoloDetail e Tipo=Regolazione nel modale Appendice di Gestione Polizze. Entrambi navigano a `/portafoglio/immissione?mode=regolazione&titoloMadreId=<id>&quietanzaRefId=<id>`.
- Riutilizza `ImmissionePolizzaPage` con stesso form ricco (Compagnia/Rapporto, Ramo/Sottoramo, Periodo/Frazionamento, righe Premio per garanzia, Netto/Accessori/Tasse/SSN, Provvigioni). Importi negativi ammessi.
- Pre-popolazione dalla polizza madre: cliente, numero_titolo, compagnia, rapporto, ramo, prodotto, durate, anni, frazionamento, tacito_rinnovo, AE, ufficio.
- Banner ambra in alto con `SearchableSelect` delle rate (titoli con stesso `numero_titolo`) per scegliere la **quietanza di riferimento** (default: ultima incassata).
- Crea nuovo titolo `RG` con `riga = max(riga)+1`, `sostituisce_polizza`/`sostituisce_riga` puntati alla madre, stato `attivo`.
- Le quietanze future della polizza madre NON vengono toccate.
- Snapshot in `titoli_regolazioni` con `titolo_madre_id`, `titolo_regolazione_id`, **`quietanza_riferimento_id`**, periodo, conguaglio_premio, note.
- Movimento "Regolazione Premio" sul nuovo titolo + movimento `tipo_documento='RG'` sulla polizza madre (timeline).
- Componente `RegolazionePremioDialog` deprecato (file ancora presente ma non importato).

## Note
- Niente calcolo automatico di rateo (regola progetto: importi sempre a mano).
- `isLocked` in TitoloDetail già copre `stornato` (campi non editabili).
- Pagina/route legacy `/portafoglio/storno` + `StornoPolizzaPage.tsx` rimosse.
- Migrazione `titoli_regolazioni.quietanza_riferimento_id` (uuid, FK→titoli, nullable, ON DELETE SET NULL) + indice `idx_titoli_regolazioni_quietanza_ref`.
