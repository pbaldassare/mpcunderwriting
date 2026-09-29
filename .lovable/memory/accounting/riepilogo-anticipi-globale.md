---
name: Riepilogo Anticipi globale
description: Pagina /contabilita/anticipi-clienti, vista globale di tutti gli anticipi cliente, riusa hook/dialog della card cliente
type: feature
---
# Riepilogo Anticipi Clienti

Route `/contabilita/anticipi-clienti` (vecchia `/contabilita/stampa-sospesi` → redirect automatico). Sostituisce la pagina "Polizze Sospese" (rimossa).

## Componenti riusati
- `NuovoAnticipoDialog` — esteso: senza prop `clienteId` mostra `SearchableSelect` cliente (cerca per nome/ragione_sociale/CF/P.IVA, min 2 chars) e usa una mutation locale che invalida le query del cliente target + `anticipi-globale`.
- `AnticipoUtilizziDrawer` — riusato as-is per il dettaglio utilizzi.
- `useEliminaAnticipo` / `statoAnticipo` da `useAnticipiCliente`.

## Nuovo hook
`useAnticipiGlobale.ts` con filtri: clienteId, ufficioId, contoId, stato (tutti/disponibili/parziali/esauriti), dataDa, dataAl, search. Filtri server-side dove possibile; ufficioId e stato 'parziali' filtrati lato client perché su campi correlati/derivati.

## Sincronizzazione messa a cassa
Tutti i punti che modificano residuo invalidano la queryKey `anticipi-globale`:
- `useAnticipiCliente.useCreaAnticipo` / `useEliminaAnticipo` (anche la card cliente)
- `MessaCassaDialog` (creazione utilizzi)
- Trigger DB `trg_anticipi_utilizzi_residuo` aggiorna `importo_residuo` su INSERT/UPDATE/DELETE
- `annullaMessaACassa` esegue DELETE cascade su `cliente_anticipi_utilizzi` → residuo torna disponibile (refetch a query attiva)
- Cascade `annullaPolizza` via FK ON DELETE CASCADE su `titolo_id`

## UI
- KPI: Totale Disponibile (verde), Totale Versato filtrato, Anticipi Attivi count
- Filtri: Sede, Conto Bancario, Stato, Data Da/Al, ricerca libera (debounce 350ms)
- Tabella zebra: Data | Cliente (link a /clienti/:id) | Conto | Importo | Residuo | Stato | Note | azione elimina (solo se mai usato)
- Click riga → drawer utilizzi

## Sidebar / Breadcrumb
- Sidebar voce "Riepilogo Anticipi" icona `Wallet` in gruppo Contabilità
- PageBreadcrumb: sia `stampa-sospesi` che `anticipi-clienti` → "Riepilogo Anticipi"
