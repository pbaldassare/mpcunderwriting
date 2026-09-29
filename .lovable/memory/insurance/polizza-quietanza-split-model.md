---
name: Modello Polizza/Quietanza (Fase 1)
description: Nuove tabelle polizze + quietanze, separazione contratto/rata, sync legacy via trigger su titoli
type: feature
---

# Separazione Polizza ↔ Quietanza — stato Fase 1

## Modello

- **`polizze`** = il **contratto assicurativo**. Dura quanto il contratto, NON si mette mai a cassa, NON ha `data_messa_cassa`/`data_incasso`. Stati: `attiva | sospesa | annullata | scaduta | sostituita`.
- **`quietanze`** = la **rata pagabile**. È questa che si incassa, finisce in rimesse/EC/provvigioni maturate. Stati: `da_incassare | incassato | sospesa | annullata | stornata`. UNIQUE `(polizza_id, numero_rata)`.
- 1 polizza → N quietanze. Frazionamento (Mensile..Poliennale) determina N e date delle rate.

## Sync legacy bidirezionale (Fase 1)

Durante la transizione `titoli` resta la fonte canonica per portafoglio/contabilità. I trigger mantengono i due modelli allineati:

1. **`tg_titolo_after_insert_crea_polizza`** (AFTER INSERT su `titoli`): tutto il codice esistente (ImmissionePolizza, Rinnovi, Appendici, dialoghi) continua a scrivere su `titoli` come oggi. Il trigger:
   - se `sostituisce_polizza IS NULL` → crea `polizze` + prima `quietanze`, valorizza `titoli.polizza_id`.
   - se `sostituisce_polizza` valorizzato → trova la polizza della madre (via `numero_polizza`), aggiunge una quietanza progressiva.
2. **`tg_quietanza_sync_to_titoli`** (AFTER INSERT su `quietanze`): se UI nuove scriveranno direttamente su `polizze`, il trigger crea il `titoli` corrispondente. Guard: `app.skip_legacy_sync='on'` durante l'esecuzione di (1) per evitare loop.

## RPC

- `fn_rate_per_anno(frazionamento)` → numero rate/anno.
- `fn_polizza_genera_quietanze(_polizza_id)` → genera le N quietanze. Chiamata automaticamente da `tg_polizza_after_insert_genera_quietanze` su INSERT polizza. Salta se quietanze già presenti o se `app.skip_genera_quietanze='on'`.

## FK transizione

- `titoli.polizza_id` → `polizze.id` (nullable, ON DELETE SET NULL).
- `premi_garanzia_polizza.polizza_id` e `.quietanza_id` (nullable, ON DELETE CASCADE).
- `appendici_polizza.polizza_id` (nullable, ON DELETE CASCADE).
- `polizze.titolo_madre_id` → `titoli.id`.
- `quietanze.titolo_id` → `titoli.id`.

## Backfill iniziale

Migrazione del 18/06/2026 ha riscritto tutti i 108 titoli esistenti come 100 polizze + 108 quietanze. Quadratura validata: stesso numero record, somma premio_lordo, somma provvigioni, count incassati identici. Le 5 catene anomale (`TEST-*` multi-madre) sono diventate polizze indipendenti col suffisso `#<8charId>`.

## Fuori scope Fase 1

NON ancora fatto, da Fase 2+:
- UI dettaglio polizza (`/polizze/:id`) e dettaglio quietanza.
- Pagine portafoglio/contabilità/rimesse/EC puntate direttamente su `quietanze` (oggi continuano a leggere `titoli`).
- Trigger di update_premio polizza → quietanze future, cascade annullamento polizza → quietanze non incassate, genera quietanza successiva al rinnovo.
- Dismissione tabella `titoli`.

## File chiave

- Migrazioni: `polizze` + `quietanze` + trigger + backfill (18/06/2026).
- `src/pages/ImmissionePolizzaPage.tsx` — header con banner informativo modello attivo; onSubmit invariato (il trigger gestisce la creazione polizza+quietanza).
