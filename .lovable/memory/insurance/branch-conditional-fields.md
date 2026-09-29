---
name: Branch Conditional Fields (Immissione Polizza)
description: I campi specifici per ramo (es. Targa/Telaio, sezioni Veicolo/Garanzie/Conducente RCA) appaiono solo se il ramo lo richiede; resettati altrimenti
type: feature
---

In `src/pages/ImmissionePolizzaPage.tsx`:

- `isRCA = polizzaAuto || gruppo_ramo contiene "RCA"|"AUTO"`.
- Quando `isRCA === true`: nel blocco "Contratto" viene mostrato il campo **Targa/Telaio** (auto-uppercase) e in fondo al form appaiono 3 fieldset con icone lucide (`Car`, `Receipt`, `User`) precedute da un banner "SEZIONE RCA AUTO".
- Quando `isRCA === false`: un `useEffect([isRCA])` azzera tutti gli stati `targaTelaio`, `v*` (veicolo), `c*` (conducente) e ripristina `premiGaranzia` ai default — così non vengono mai salvati dati veicolo per polizze non-auto.
- Il salvataggio in tabella `rca_dati` resta condizionato a `if (isRCA)`.

Pattern estendibile ad altri rami (Vita → beneficiari, Trasporti → tratta/merce, ecc.).
