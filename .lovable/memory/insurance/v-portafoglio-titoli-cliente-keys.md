---
name: Titoli cliente keys
description: titoli.cliente_anagrafica_id contiene clienti.id (legacy naming); filtrare titoli/v_portafoglio_titoli per cliente con OR su cliente_id E cliente_anagrafica_id
type: feature
---
Su `titoli` (e `v_portafoglio_titoli`) il legame al cliente è doppio:
- `cliente_id` → `clienti.id` (~29/102 righe)
- `cliente_anagrafica_id` → **anch'esso `clienti.id`** (~76/102 righe), nonostante il nome. Verificato 76/76 match in `clienti`, 0/76 in `anagrafiche_professionali`.

Per filtrare titoli per cliente usare SEMPRE OR su entrambe le colonne:
```ts
q.or(`cliente_id.eq.${id},cliente_anagrafica_id.eq.${id}`)
```
Filtrare solo su `cliente_id` esclude il 75% dei titoli (legacy). NON rinominare la colonna senza migrazione dati.
