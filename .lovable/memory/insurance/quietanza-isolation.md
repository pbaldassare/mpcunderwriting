---
name: Isolamento quietanze (rate)
description: Ogni quietanza è un record titoli indipendente; salvataggi scoped per id; banner UI esplicito
type: feature
---

# Isolamento per quietanza

Ogni rata di una polizza è una riga `titoli` distinta (chiave `numero_titolo` + `riga`, link via `sostituisce_polizza`).

## Garanzie

- Tutte le mutation di `TitoloDetail` (importi, periodo, contratto, regolazione, split commerciali) usano `.eq("id", titolo.id)` e chiamano `assertSameTitolo(id, titolo.id, ctx)` come guard difensivo prima dell'UPDATE.
- `premi_garanzia_polizza` è scoped per `titolo_id` + `tipo_premio` (firma|quietanza); nessuna sincronizzazione cross-record.
- Sync automatica **Firma → Quietanza** in `saveImportiMutation`: attiva solo sulla **polizza madre**, disattivata se `isQuietanza(t)` è true (su una rata i campi firma sono lo storico originale, non vanno propagati).
- Il trigger DB `genera_quietanza_su_messa_cassa` crea la rata successiva SOLO al passaggio a `incassato`; non aggiorna mai i fratelli a posteriori.

## UI

- Badge nell'header: "Polizza originale" oppure "Quietanza · dal … al …".
- Banner sky sopra le sezioni quando la catena ha più di 1 record:
  - su rata: "Stai modificando la Rata N di M … le modifiche valgono solo per questa quietanza".
  - su madre: "Polizza madre — questa polizza ha N rate successive".
- Pannello collapsible "Quietanze di questa polizza" elenca tutte le righe con stesso `numero_titolo`, evidenzia la corrente, ognuna cliccabile verso `/titoli/:id`.
- Helpers: `groupTitoliByPolizza`, `isQuietanza` da `src/lib/quietanze.ts`.
