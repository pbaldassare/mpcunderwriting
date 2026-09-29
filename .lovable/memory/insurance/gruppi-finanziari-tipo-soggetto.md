---
name: Gruppi Finanziari - Tipo Soggetto
description: Il flag tipo_soggetto su gruppi_finanziari (privato/azienda/ente) governa dinamicamente i campi anagrafica cliente; tipo_cliente è derivato automaticamente dal Gruppo Finanziario. Modal "Nuovo Cliente" condiviso in `src/components/clienti/NuovoClienteDialog.tsx` e usato sia in ClientiList sia in ImmissionePolizzaPage (QuickClienteDialog deprecato).
type: feature
---

## Schema
- `gruppi_finanziari.tipo_soggetto` text CHECK IN ('privato','azienda','ente')
- `clienti.codice_cig` text (nullable a DB, obbligatorio lato form solo per ENTE)

## Derivazione automatica
- **Nuovo Cliente** (`ClientiList.tsx`): in cima al modal il primo campo è **Gruppo Finanziario** (SearchableSelect). Selezionandolo, `tipoCliente` viene impostato automaticamente da `gruppo.tipo_soggetto` e mostrato come **badge read-only** con suffisso "(auto)". Non esiste più un selettore Tipo Cliente modificabile manualmente.
- **Cliente Detail** (`ClienteDetail.tsx`): stessa logica — cambiando `gruppo_finanziario_id` viene aggiornato `tipo_cliente`.
- Il duplicato Gruppo Finanziario nella sezione "Dati Statistici" del modal è ora **read-only** (Input disabled): l'unico punto di selezione è in cima.

## Campi per tipologia (ClienteDetail.tsx)
- **PRIVATO**: nome, cognome, CF (16 char, validato e con auto-fill di sesso/data/luogo nascita via `parseCF`), data/luogo nascita, indirizzo residenza.
- **AZIENDA**: ragione sociale, P.IVA, CF azienda (11 cifre → auto copia in P.IVA), forma giuridica, SDI, indirizzo sede.
- **ENTE**: come azienda + **Codice CIG obbligatorio**.

## Clienti esistenti
Nessuna modifica retroattiva ai dati. Le nuove regole si applicano solo a inserimenti/modifiche manuali.
