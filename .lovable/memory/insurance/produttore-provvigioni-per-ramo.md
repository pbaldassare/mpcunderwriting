---
name: Produttore provvigioni per ramo
description: Sede opzionale per Produttori (Consul) e tabella produttori_provvigioni_ramo per provvigioni differenziate per ramo
type: feature
---

## Sede Produttori
Per i Produttori (`anagrafiche_professionali.tipo='corrispondente'`) la **Sede (`ufficio_id`) è OPZIONALE**.
Non è opzionale per AE e Responsabile Sede.

## Provvigioni per Ramo
Tabella `produttori_provvigioni_ramo`:
- FK: `anagrafica_id` → `anagrafiche_professionali`, `ramo_codice` → `rami(codice)`
- Campi: `percentuale_provvigione`, `percentuale_consulenza`, `percentuale_ra`
- UNIQUE (anagrafica_id, ramo_codice)

**Gerarchia di lookup**: ramo-specifica → fallback su `anagrafiche_professionali.percentuale_base/consulenza/ra` (default produttore).

UI: tab "Provvigioni" del Produttore mostra la sezione default + tabella di tutti i rami attivi con:
- copia codice/label ramo (clipboard)
- fill colonna con default (con o senza override solo vuoti)
- paste multiriga compat. Excel (split su \n e \t)
- filtro testo + toggle "solo personalizzati"
- reset riga (svuota i 3 campi → torna al fallback)

Componente: `src/components/anagrafiche/ProduttoreProvvigioniRamoTab.tsx`.
Salvataggio indipendente (bottone "Salva provvigioni ramo") perché richiede `editingId`.
