---
name: Contributo SSN per sottoramo
description: Flag `rami.ssn_attivo` + `aliquota_ssn` (default 10.50%) abilita il contributo SSN sulle righe garanzia. Calcolo su LORDO (netto+tasse), riga per riga, editabile, sommato al premio. Aggregato in titoli.ssn_firma/ssn_quietanza.
type: feature
---

**Schema DB**
- `rami.ssn_attivo boolean DEFAULT false`, `rami.aliquota_ssn numeric(5,2)`. Seed: tutti i sottorami del gruppo `ZQ - R.C.A.` hanno `ssn_attivo=true`, `aliquota_ssn=10.50`.
- `titoli.ssn_firma`, `titoli.ssn_quietanza` (numeric, default 0): totali aggregati paralleli a tasse/addizionali.
- `premi_garanzia_polizza.ssn` (numeric): importo SSN per singola riga garanzia.
- `rami.aliquota_tasse_ard` resta sul DB ma è **nascosto in UI** (Tabelle di Base → Rami).

**Formula**: `ssn_riga = round((netto + tasse) * aliquota_ssn / 100, 2)`. Lordo riga = `netto + tasse + ssn`. Premio lordo polizza include la somma SSN.

**UI**
- `TabelleBasePage` (RamiTab): toggle "SSN" + input "% SSN" (default 10.50) nel dialog. Colonna ARD rimossa dalla tabella; nuova colonna SSN mostra `aliquota_ssn%` o `—`.
- `PremiGaranziaCardShell`: query rami include `ssn_attivo`/`aliquota_ssn`. Colonna "SSN €" appare solo se almeno una riga ha sottoramo con flag. Calcolo automatico al cambio di netto/tasse/sottoramo; manuale override possibile (flag `ssnManualOverride` client-side). Footer totale "Totale SSN".
- `ImmissionePolizzaPage`: aggrega `ssnFirmaNum`/`ssnQuietanzaNum` in `titoli.ssn_firma`/`ssn_quietanza`; insert in `premi_garanzia_polizza` include `ssn` per riga. `totFirma`/`totQuietanza` includono SSN.
- `TitoloDetail` (savePremiMutation): persiste `ssn` per riga in upsert.

**AI parser**: `parse-polizza-completa` e `parse-polizza-rca` espongono campo opzionale `ssn` per voce garanzia (estratto dal PDF se presente, altrimenti calcolato lato app dal flag sottoramo).

**Ambito tipico**: RCA Auto/Natanti (gruppo ZQ). Il flag è disponibile su qualunque sottoramo per flessibilità futura.
