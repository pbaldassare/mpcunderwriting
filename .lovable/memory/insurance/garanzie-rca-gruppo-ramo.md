---
name: Catalogo Garanzie per Gruppo Ramo
description: rca_garanzie funge da catalogo garanzie generico legato a gruppi_ramo (NOT NULL). VociRcaCard e PremiGaranziaCardShell filtrano la lista per gruppo del ramo del titolo, su tutti i rami (non solo RCA).
type: feature
---

`rca_garanzie.gruppo_ramo_id` (uuid NOT NULL → `gruppi_ramo.id` ON DELETE RESTRICT) collega ogni garanzia a un gruppo ramo. La tabella, nata per RCA, è ora **catalogo generico** per tutti i gruppi (Corpi, Incendio, Infortuni, RCT, Vita, ecc.). Seed minimo: una garanzia principale per ogni gruppo non-RCA, espandibile dall'utente.

**UI Tabelle di Base** → tab "Catalogo Garanzie" (`TabelleBasePage.tsx` → `RcaGaranzieTab`): editor con `SearchableSelect` "Gruppo Ramo" obbligatorio.

**Polizze esistenti** (`TitoloDetail.tsx`): le due card `VociRcaCard` (Firma + Quietanza) sono mostrate **per tutti i rami** (non più gated da `isRamoAuto`). Per non-auto: `useAutoTaxFormula={false}` (lordo = netto × (1 + aliquota%)), `aliquotaDefault={ramo.aliquota_tasse_ramo}`, `addizionaliValue/onAddizionaliChange` su `titoli.addizionali`/`addizionali_quietanza`. Per auto/natanti: formula IPT+SSN attiva con riga RCA principale obbligatoria.

**Polizze in immissione** (`ImmissionePolizzaPage.tsx` → `PremiGaranziaCardShell`): la cella "Voce" è ora un `SearchableSelect` filtrato su `rca_garanzie.gruppo_ramo_id = (selectedRamoData.gruppo_ramo_id)`. Selezionando una garanzia, l'aliquota tasse del catalogo pre-popola il campo Tasse se il netto è valorizzato. Quando il `gruppoRamoId` è null mostra il fallback statico (`mainLabel`).

Il catalogo è derivato via join `titoli.ramo_id → rami.gruppo_ramo_id → gruppi_ramo` per le polizze esistenti, o direttamente dalla selezione `RamoSottoramoSelect` per le nuove.
