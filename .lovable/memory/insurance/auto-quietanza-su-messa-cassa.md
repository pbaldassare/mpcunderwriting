---
name: Polizza disaccoppiata dalla quietanza (rata 1 sempre separata)
description: Trigger DB genera SEMPRE rate 1..N alla creazione polizza madre, anche su Annuale rata unica; la madre non viene mai messa a cassa
type: feature
---

# Regola

**Polizza madre = solo contratto.** Non si mette mai a cassa, non ha
`data_messa_cassa` né `data_incasso`. Stati: `attivo | sospeso | scaduto | annullato`.

**Quietanze (rate) = sempre record `titoli` separati dalla madre.** Anche per
polizze Annuali "rata unica": madre + 1 quietanza (1/1). La messa a cassa
avviene SOLO sulla quietanza.

## Trigger

`trg_genera_quietanze_su_insert_madre` (AFTER INSERT su `titoli`, funzione
`public.genera_quietanze_su_insert_madre`):

- Scatta solo su madre (`sostituisce_polizza IS NULL`, non regolazione, con
  `numero_titolo`, `garanzia_da`, `garanzia_a`).
- `n_rate = (12 / mesi_rata) * anni_durata` da `frazionamento + anni_durata`.
  - Mensile=1, Trimestrale=3, Quadrimestrale=4, Semestrale=6, Annuale=12.
  - **Poliennale** o frazionamento sconosciuto → nessuna quietanza generata.
- Loop **1..N** (la rata 1 ha date identiche alla madre; rate 2..N traslate).
- Inserisce le rate concatenate via `sostituisce_polizza`/`sostituisce_riga`,
  stato `attivo`, importi clonati dalla madre (preferendo `*_quietanza`).
- Idempotente: se esiste già una quietanza per quella polizza, esce.

Esempi:
- Annuale 1y → madre + **1** quietanza (1/1).
- Annuale 3y → madre + **3** quietanze annuali.
- Semestrale 1y → madre + **2**.
- Trimestrale 1y → madre + **4**.
- Mensile 1y → madre + **12**.
- Poliennale → solo madre.

## Vincolo unique anti-duplicato-rinnovo

`titoli_no_duplicati_rinnovo` (UNIQUE su `numero_titolo, compagnia_id,
data_scadenza`) è ristretto alle sole **madri** (`sostituisce_polizza IS NULL`),
così la rata-1 con stessa scadenza della madre non collide.

## Trigger di rinnovo (legacy fallback)

`genera_quietanza_su_messa_cassa` resta attivo: alla messa a cassa di una
quietanza genera l'eventuale rata successiva (per polizze frazionate) o il
rinnovo annuale. Idempotente: skip se la successiva esiste già.

## UI

- Pannello "Quietanze di questa polizza" su `PolizzaDetail`/`TitoloDetail` mostra
  sempre almeno la rata 1/1.
- Toolbar azioni sulla polizza chiede di selezionare la quietanza target
  (preselezionata se è unica).
- `src/lib/quietanzePlan.ts` `computeQuietanzePlan` ritorna già le rate 1..N e
  alimenta l'anteprima in `ImmissionePolizzaPage`.

## Backfill (giugno 2026)

Eseguito una tantum:
- Per ogni madre senza rata-1 figlia: creata clonando date/importi.
- Madri precedentemente `incassato`/con `data_messa_cassa` (incluse quelle che
  avevano già la quietanza di rinnovo dal trigger legacy): dati di cassa
  migrati sulla rata-1 ricostruita, madre riportata a `attivo`/`scaduto`.

## Cosa NON è cambiato

- `quietanza-isolation`: ogni rata resta record indipendente, modificabile.
- `annulla_polizza_cascade`: continua a cancellare madre + catena.
- Importi: editabili per singola rata.
- Trigger di rinnovo: invariato.
