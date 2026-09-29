---
name: Produttori e AE - lookup source
description: Le tendine Produttore (corrispondente) e Account Executive in Immissione/Polizze attingono da anagrafiche_professionali. Salvataggio su titoli.anagrafica_commerciale_id (Produttore) e titoli.ae_anagrafica_id (AE). Hook canonici: useProduttoriLookup, useAccountExecutivesLookup. Eredità da cliente via codici_commerciali_cliente.anagrafica_id (con fallback per nome alle anagrafiche).
type: feature
---

## Sorgenti dati

- **Produttore** → `anagrafiche_professionali` `tipo='corrispondente'`, `attivo=true` — hook `useProduttoriLookup`.
- **Account Executive** → `anagrafiche_professionali` `tipo='account_executive'`, `attivo=true` — hook `useAccountExecutivesLookup`.

Le tendine sono **identiche per ogni tipo cliente** (privato/azienda/ente).

## Persistenza

- `titoli.anagrafica_commerciale_id` → Produttore selezionato.
- `titoli.ae_anagrafica_id` → AE selezionato.
- `titoli.produttore_nome` / `titoli.ae_nome` continuano a salvare il testo leggibile.
- `codici_commerciali_cliente.anagrafica_id` → assegnazione AE/Produttore lato scheda cliente.

Le colonne legacy (`titoli.commerciale_id`, `titoli.produttore_id`, `codici_commerciali_cliente.profilo_id` per ruoli AE/Produttore) restano per compatibilità ma non vanno più valorizzate per nuovi record.

## Eredità da cliente in Immissione

`ImmissionePolizzaPage` legge `codici_commerciali_cliente` per il cliente:
1. Prima usa `anagrafica_id` come valore preselezionato.
2. Fallback retro-compatibile: se NULL ma esiste `profilo_id`, prova match per nome (cognome+nome) verso le anagrafiche.
3. Se nessun match, lascia vuoto: l'utente deve riassegnare nella scheda cliente per linkare l'anagrafica corretta.
