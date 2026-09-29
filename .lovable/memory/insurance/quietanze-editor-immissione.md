---
name: Editor Quietanze in Immissione Polizza
description: Form Nuova Polizza con sezione Quietanze separata, editabile rata-per-rata; backfill quietanze su polizze esistenti
type: feature
---

# Polizza vs Quietanza: separazione nel form di immissione

Dal 19/06/2026 il form `ImmissionePolizzaPage` espone una sezione dedicata
**"Quietanze (rate da pagare)"** sotto la sezione Periodo. Il principio:

- **Polizza** = contratto (durata, frazionamento, anagrafica, prodotto)
- **Quietanza** = rata pagabile (garanzia, premio, provvigioni, scadenze)

Annuale 1y → 1 quietanza 1/1. Semestrale 1y → 2. Mensile 1y → 12.
**Poliennale 3y → 3 quietanze annuali** (era 1 sola fino al 18/06).

## UI

`src/components/polizze/QuietanzeEditor.tsx`:
- Calcola N rate da `frazionamento + anni_durata + garanzia_da/a` (helper
  `computeQuietanzePlan`).
- Renderizza una card per ogni rata con: Garanzia Da/A, Competenza, Scadenza,
  Netto, Tasse, SSN, Addizionali, Premio Lordo (auto), Provv. Firma, Provv. Quietanza.
- Prima rata pre-compilata dai valori globali del form (premio netto, tasse, ecc.).
- Pulsante **"Applica rata 1 a tutte"** per propagare gli importi (utile semestrali/mensili
  con rate uguali).
- KPI in cima: totale lordo, totale provvigioni firma, totale provvigioni quietanza.

## Flusso salvataggio

1. `INSERT INTO titoli` come oggi (form padre).
2. Trigger `tg_titolo_after_insert_crea_polizza` crea la riga `polizze`.
3. Trigger `tg_polizza_after_insert_genera_quietanze` crea le N quietanze
   con importi calcolati pro-quota dai `premio_annuo_*` della polizza.
4. **Post-insert** la pagina applica i drafts del `QuietanzeEditor`:
   ```ts
   SELECT polizza_id FROM titoli WHERE id = newTitolo.id
   FOR each draft: UPDATE quietanze SET ... WHERE polizza_id=$1 AND numero_rata=$2
   ```
   Così l'utente può differenziare importi/date per rata già in creazione.

In modalità regolazione (`?mode=regolazione`) la sezione Quietanze e l'apply
vengono saltati (il titolo RG è one-shot collegato a una quietanza esistente).

## Backfill 19/06/2026

Migrazione one-shot per le polizze esistenti:
- `fn_polizza_genera_quietanze` aggiornata: poliennale ora genera N quietanze
  annuali invece di 1 sola.
- Loop su tutte le `polizze` con stato ≠ annullata/sostituita → invoca
  `fn_polizza_genera_quietanze`. `ON CONFLICT (polizza_id,numero_rata) DO NOTHING`
  rende l'operazione idempotente.
- `UPDATE quietanze.numero_rate_totali` riallineato al count reale per polizza.

Risultato verificato: 104 polizze attive ⇒ 125 quietanze (delta +14 dal backfill).

## Badge Carico

`PortafoglioCaricoPage` ora mostra sempre `Quietanza N/M` (mai più "Polizza"):
- `numero_rata`, `numero_rate_totali` aggiunti al `select` della view.
- Badge: regolazione → "Regolazione" arancio; tutti gli altri → `<TipoPolizzaBadge
  tipo="quietanza" numero={p.numero_rata} totale={p.numero_rate_totali}/>`.

## File chiave

- `src/lib/quietanzePlan.ts` — helper puro + supporto poliennale.
- `src/lib/__tests__/quietanzePlan.test.ts` — 11 test coprono tutti i frazionamenti.
- `src/components/polizze/QuietanzeEditor.tsx` — UI editor.
- `src/pages/ImmissionePolizzaPage.tsx` — sezione "Quietanze (rate da pagare)" +
  apply post-insert.
- `src/pages/PortafoglioCaricoPage.tsx` — badge unificato.
- Migrazione DB del 19/06/2026 (`fn_polizza_genera_quietanze` + backfill).
