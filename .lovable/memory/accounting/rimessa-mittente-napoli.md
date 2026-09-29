---
name: Rimessa / Sede mittente E/C Agenzia
description: Sede default nell'intestazione E/C Agenzia = ufficio più frequente fra i titoli inclusi; Napoli solo come fallback. Popup Paga Rimessa usa conti Consulbrokers tipo 'generico'.
type: feature
---

## Sede Mittente (E/C Agenzia PDF)

In `src/pages/contabilita/ECAgenziaPdfPage.tsx` la sezione "Sede Mittente (intestazione)" viene pre-popolata in automatico con la **Sede collegata ai titoli inclusi**:

- Si conta `ufficio_id` su tutti i titoli caricati e si sceglie quello più frequente.
- Se nessun titolo ha `ufficio_id`, fallback alla prima sede attiva che contenga "napoli" in `nome_ufficio` o `citta` (storicamente tutte le rimesse partivano da lì).
- L'utente può sempre sovrascrivere tramite il dropdown "Carica dati da una Sede esistente" o editando i campi.

## Paga Rimessa

Il popup "Paga Rimessa" mostra una select dei conti bancari Consulbrokers di tipo `generico` (attivi) per scegliere da quale conto effettuare il pagamento.
