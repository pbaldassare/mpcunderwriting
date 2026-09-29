---
name: TitoloDetail allineato a ImmissionePolizzaPage
description: TitoloDetail usa PolizzaSection (wrapper) e PremiGaranziaCardShell (stesso componente della pagina di immissione) per la sezione Importi/Composizione Premio. SSN per riga via rami.ssn_attivo; lock quando messa a cassa/stornata.
type: feature
---

## Look & feel sezioni

`SectionCollapsible` interno in `src/pages/TitoloDetail.tsx` è un thin wrapper sopra `PolizzaSection`. Tutte le sezioni (Contratto, Periodo, Regolazione, Importi, Provvigioni, Veicolo) hanno bordo teal, header e collapsible identici a `ImmissionePolizzaPage`.

## Composizione Premio (Firma + Quietanza)

Il blocco "Composizione Premio" in TitoloDetail è incapsulato in **`src/components/polizze/TitoloImportiPremiBlock.tsx`** e usa **`PremiGaranziaCardShell`** — esattamente lo stesso componente della pagina di immissione.

- Carica le righe da `premi_garanzia_polizza` (tipo_premio firma/quietanza) e arricchisce ogni riga con i metadata del sottoramo (`rami.id`, `ssn_attivo`, `aliquota_ssn`, `aliquota_tasse_ramo`) tramite una query sul gruppo ramo del titolo.
- Salvataggio: delete+insert per tipo, debounce 700 ms; aggiorna `titoli.premio_netto/tasse/ssn_firma/premio_lordo` (Firma) e i corrispettivi `_quietanza`. `premio_lordo = netto + tasse + ssn + addizionali`.
- SSN per riga: visibile se il sottoramo ha `ssn_attivo=true`. Override manuale rilevato con tolleranza 0,01 €.
- Provvigioni: il footer della shell mostra `Totale Provvigione` formattato con `toFixed(2)` e la `% Agenzia` su netto; salva `titoli.provvigioni_firma` (e `percentuale_provvigione`) / `provvigioni_quietanza`.
- Buttons "Copia / Sincronizza da Firma" nella card Quietanza; badge "Sincronizzata" quando le righe coincidono.

Legacy `VociRcaCard` non è più usato in TitoloDetail (il file resta nel repo ma è deprecato per questa sezione).

## Lock messa-a-cassa

```ts
const isLocked = !!t.data_messa_cassa || t.stato === "incassato" || t.stato === "stornato";
```

Quando true:
- Banner ambra in cima alla pagina.
- Pulsanti **Modifica** delle sezioni `disabled` con tooltip.
- In `TitoloImportiPremiBlock`: pulsanti "Copia / Sincronizza" disabilitati e nessuna persistenza onChange.

Restano disponibili le operazioni dedicate (Annulla Messa a Cassa, Annulla Incasso, Rinnovo, Storno, Sospensione/Riattivazione).

## File

- `src/pages/TitoloDetail.tsx` — usa `TitoloImportiPremiBlock` nella sezione Importi.
- `src/components/polizze/TitoloImportiPremiBlock.tsx` — wrapper di `PremiGaranziaCardShell` con caricamento/save su `premi_garanzia_polizza` e aggregati su `titoli`.
- `src/components/polizze/PremiGaranziaCardShell.tsx` — componente condiviso con `ImmissionePolizzaPage`.
