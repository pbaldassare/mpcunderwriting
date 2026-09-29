---
name: Storico Gare Pubbliche
description: Modulo Storico Gare (tabella storico_gare + vista v_storico_gare) per intelligence di mercato, separato dalle trattative attive
type: feature
---

# Storico Gare Pubbliche

Tabella **`storico_gare`** + vista **`v_storico_gare`** (calcola `stato_mandato` dinamicamente). UI in `/trattative/storico-gare`.

## Distinzione critica
- `trattative` = pipeline commerciale **attiva** (KPI vinte/perse correnti).
- `storico_gare` = **dataset di intelligence di mercato** (chi gestiva quel cliente PA, scadenze mandato, broker incumbent storici). NON inquinare i KPI delle trattative con questi dati.

## Campi categorizzati (filtri + AI)
- `anno_riferimento` (int), `provincia` (text 2), `tipologia` (manifestazione|gara|affidamento_diretto|altro)
- `esito` (vinta|persa|non_partecipato|annullata|in_corso|non_classificato) — derivato dal parsing NOTE
- `broker_incumbent` (text normalizzato: B&S ITALIA, INTERMEDIA, AON, MARSH, WILLIS, MAG JLT…)
- `categoria_ente` (comune|provincia|regione|azienda_sanitaria|universita|consorzio|societa_partecipata|altro_ente) — derivata dal nome ente via regex nel trigger `storico_gare_normalize`
- `stato_mandato` (attivo|in_scadenza_12m|scaduto|sconosciuto) — colonna **calcolata nella vista** confrontando `data_fine_mandato` con `CURRENT_DATE`
- 4 flag bool: `flag_cauzione`, `flag_referenze_bancarie`, `flag_accesso_atti`, `flag_offerta_tecnica`
- `opzione_rinnovo_anni` (int derivato da regex su `opzione_rinnovo` libero)

## Import
Edge function **`import-storico-gare`** (verify_jwt=true, ruolo richiesto admin/responsabile_sede). Parsa Excel multi-foglio "ELENCO GARE GENERALE", estrae anno dal nome del foglio, salta righe di riepilogo (`TOT`, `PERCENTUALE`, ecc.), normalizza date in formati misti (dd/mm/yyyy, dd.mm.yyyy, serial Excel), auto-link a `clienti` su `ente_nome` ILIKE prefix.

## Accesso (RLS)
- SELECT: tutti i ruoli interni (admin, cfo, responsabile_sede, ufficio, backoffice, account_executive, specialist, produttore, executive)
- INSERT/UPDATE/DELETE: solo admin e responsabile_sede
- Clienti e prospect: nessun accesso
