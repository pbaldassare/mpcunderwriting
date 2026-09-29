---
name: Policy commission split
description: Split provvigioni titolo tra Produttori, Account Executive e Consulbrokers SPA (residuo). AE = secondo intermediario provvigionato.
type: feature
---

## Regola

Quando un titolo passa a `incassato`, l'edge function `calcola-provvigioni` genera righe in `provvigioni_generate` partendo da `titoli.provvigioni_quietanza`:

- **Produttori** (da `titoli_split_commerciali` o fallback singolo `anagrafica_commerciale_id` + `percentuale_commerciale`) → righe `tipo_destinatario = 'commerciale'`.
- **Account Executive** (`titoli.ae_anagrafica_id` + `titoli.percentuale_ae`, se > 0) → riga `tipo_destinatario = 'ae'`, `anagrafica_commerciale_id = ae_anagrafica_id`.
- **Consulbrokers SPA (admin)** → riga `tipo_destinatario = 'admin'` con il **residuo** `100 − Σ% produttori − % AE`.

Vincolo: `Σ% produttori + % AE ≤ 100` (validato in UI: Immissione + TitoloDetail editor).

## Caso speciale: produttore o AE = admin

Se `anagrafica_commerciale_id` (produttore o AE) == `admin_anagrafica_id` (da `impostazioni_sistema.admin_anagrafica_id`):
- La riga del soggetto viene marcata `solo_statistico = true` (NON va nei totali economici/pagamenti).
- La sua quota economica viene **sommata alla riga admin** (residuo + statistiche).

## Filtro report/pagamenti

Usare sempre `solo_statistico = false`. L'AE è pagabile come destinatario al pari del Produttore (badge "AE" distinto in UI).

## Schema

- `titoli.percentuale_ae numeric DEFAULT 0` (migrazione 2026-05-26).
- `provvigioni_generate.tipo_destinatario` CHECK include `'ae'`.

## File chiave

- `supabase/functions/calcola-provvigioni/index.ts` — generazione righe (produttori + AE + admin).
- `src/pages/ImmissionePolizzaPage.tsx` — input "% AE" accanto a "% Produttore".
- `src/pages/TitoloDetail.tsx` — editor Commerciale con riga AE + display card "Account Executive".
- `src/pages/ProvvigioniMaturatePage.tsx` — badge "Account Executive" (indigo) + filtro Tipo include `ae`.
- `src/components/provvigioni/ProvvigioniFiltersBar.tsx` — opzione filtro Tipo `ae`.
- `src/pages/contabilita/ECProduttoriContabPage.tsx` — E/C Produttori include sia `commerciale` che `ae` (AE riceve E/C come Produttore).


