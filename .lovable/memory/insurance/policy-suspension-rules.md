---
name: Sospensione polizza — regole
description: Sospensione cancella quietanze future non incassate; rata sospesa resta in Polizze Attive; campi modificabili; limite_riattivazione default +10 mesi
type: feature
---

## Form Sospensione

- `data_sospensione` default = oggi.
- `limite_riattivazione` default = `data_sospensione + 10 mesi`; si auto-aggiorna finché l'utente non lo modifica manualmente.
- `motivo` default precompilato: "Sospensione su richiesta cliente" (modificabile).
- `oneri_sospensione` (€) default `0` — usato come `premio_lordo` del titolo SO.

## Effetti

- Update `titoli` (solo rata target): `stato='sospeso'`, `data_sospensione`, `limite_riattivazione`, `motivo_sospensione`.
- **Cancellazione quietanze future**: tutte le righe `titoli` con stesso `numero_titolo`, `riga > rata sospesa`, `stato != 'incassato'` e `data_messa_cassa IS NULL` vengono eliminate (con pulizia preventiva di `movimenti_polizza` e `premi_garanzia_polizza` collegati). Le rate già messe a cassa / incassate restano intatte (la sospensione è prospettica).
- **Titolo di sospensione (sempre creato, anche con importo 0 €)**: insert in `titoli` con `numero_titolo` corrente, `riga = max(riga)+1`, `note='Sospensione polizza: <motivo>'`, `premio_lordo = oneri`, `frazionamento='Unica'`, `garanzia_da/a = data_decorrenza = data_scadenza = data_sospensione`, `sostituisce_polizza = numero_titolo`, `sostituisce_riga = riga madre`, `stato='attivo'`, `data_messa_cassa = NULL`. Split commerciale (cliente/compagnia/ramo/ufficio/AE/anagrafica_commerciale/percentuali/tipo_portafoglio/tipo_mandatario) copiato 1:1 dalla madre. Entra in **Carico del Mese** ed E/C cliente/agenzia/produttore, anche a 0 €.
- Insert `movimenti_polizza` con `tipo_documento='SO'`, `stato='sospeso'`, `titolo_id` puntato al nuovo titolo SO (non più alla madre).
- `logAttivita('sospensione_polizza', 'titolo', id, { ..., oneri_sospensione, titolo_sospensione_id, quietanze_eliminate: [ids] })`.

## UI

- TitoloDetail: `stato='sospeso'` NON entra in `isLocked` → i campi (contratto, periodo, importi, ecc.) restano editabili. Compare la card gialla "Polizza Sospesa" con CTA Riattivazione.
- **Polizze Attive**: la rata sospesa resta visibile (filtro `stato IN (attivo, sospeso)`), con badge "Sospesa" accanto al badge Tipo.
- **Storico Polizze**: NON mostra più le sospese (rimosso `sospeso` dal filtro "tutti" e dal dropdown stato).
- **Carico del Mese**: invariato (le sospese non vi appaiono).

## Riattivazione

Modale `RiattivazionePolizzaDialog` (speculare a Sospensione, niente pagina dedicata) aperto dalla card gialla in `TitoloDetail` o dalla CTA "Riattivazione" della card Operazioni.

Campi modale: data riattivazione (default oggi), oneri a carico cliente (€, default 0), motivo (default "Riattivazione su richiesta cliente"), documento allegato opzionale (nome editabile, max 10 MB). Preview tabellare delle quietanze che verranno ricreate.

Effetti mutation (in ordine):
1. Update rata sospesa: `stato='attivo'`, `data_riattivazione` set, azzera `data_sospensione/limite_riattivazione/motivo_sospensione`.
2. **Ricrea quietanze future** dal periodo successivo a `garanzia_a` rata sospesa fino a `durata_a` (o `data_scadenza`), usando `frazionamentoMesi()` di `src/lib/frazionamento.ts`. Importo per rata = `premio_lordo / rate_per_anno`. Ogni insert con `sostituisce_polizza = numero_titolo`, `sostituisce_riga` incrementale, stesso `numero_titolo`. Skip se Poliennale.
3. **Se oneri > 0**: insert titolo separato "Oneri di Riattivazione" (stesso `numero_titolo`, `note='Oneri di riattivazione'`, `premio_lordo=oneri`, split provvigioni/commerciale copiato 1:1 dalla rata madre), `stato='attivo'`, `data_messa_cassa NULL` → da contabilizzare normalmente in Carico del Mese.
4. Upload documento opzionale in `documenti_titoli/titolo/{id}/riattivazione_{ts}_{safeName}` + riga `documenti` con nome editabile (pattern identico a Sospensione, no folder).
5. Insert `movimenti_polizza` con `tipo_documento='RA'`, descrizione composta (oneri + motivo + allegato), `stato='attivo'`.
6. `logAttivita('riattivazione_polizza', 'titolo', id, { data_riattivazione, oneri, motivo, quietanze_ricreate:[ids], titolo_oneri_id, documento_id, documento_nome })`.
7. Invalidate query: titolo, movimenti-polizza, timeline, documenti, portafoglio (attive/storico/carico).

## File

- `src/components/polizze/SospensionePolizzaDialog.tsx`
- `src/components/polizze/RiattivazionePolizzaDialog.tsx`
- `src/pages/TitoloDetail.tsx`
- `src/pages/PortafoglioAttivePage.tsx`
- `src/pages/PortafoglioStoricoPage.tsx`
