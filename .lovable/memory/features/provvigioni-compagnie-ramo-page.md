---
name: Provvigioni Compagnie/Ramo page
description: Pagina dedicata `/provvigioni-compagnie-ramo` ora unificata su matrice Rapporto × Ramo × Sottoramo con inserimento manuale, IA e CSV
type: feature
---

## Pagina
File: `src/pages/ProvvigioniCompagnieRamoPage.tsx`
Route: `/provvigioni-compagnie-ramo`
Sidebar: gruppo "Provvigioni" → voce "Provvigioni Compagnie/Ramo".

## Architettura
La pagina ora è un wrapper di `src/components/compagnie/ProvvigioniRapportiTab.tsx` (lo stesso componente usato nel dialog rapporti).
KPI in testa: rapporti attivi, configurati, mancanti.

## Modello dati
- `compagnia_rapporti` (rapporto agenzia↔compagnia)
- `compagnia_rapporto_rami` (rami abilitati per rapporto)
- `provvigioni_compagnia_ramo (compagnia_rapporto_id, gruppo_ramo_id, ramo_id, percentuale_provvigione, attiva)` — soft delete
- `provvigioni_default_tipo (tipo_rapporto, gruppo_ramo_id, ramo_id, percentuale)` — fallback per tipo

## Inserimento dati (3 canali)
1. **Manuale** — matrice inline con % per ogni Ramo (default) + ogni Sottoramo
2. **Import IA** — `parse-tariffario-rami` edge function (PDF/immagine → righe ramo/sottoramo/%)
3. **CSV** — `PasteDialog` supporta sia incolla testuale sia upload file (`.csv`/`.txt`), header opzionale, separatori `; , tab`
4. **Copia da altro rapporto** — clona tutte le righe di un altro rapporto

## Catena di risoluzione (5 livelli)
Helper: `src/lib/resolveProvvigione.ts` → `resolvePercentualeProvvigione({ compagnia_rapporto_id, gruppo_ramo_id, ramo_id })`.
1. Match esatto Rapporto+Ramo+Sottoramo
2. Default Ramo del Rapporto (ramo_id NULL)
3. % globale del Rapporto (`compagnia_rapporti.percentuale_provvigione`)
4. Default per Tipo rapporto (`provvigioni_default_tipo`)
5. 0% + warning

## Legacy
La vecchia logica basata su `categoria_id` (categorie_prodotto) NON è più la UI principale. Le righe storiche restano in DB con `attiva=true` ma non vengono più inserite.
