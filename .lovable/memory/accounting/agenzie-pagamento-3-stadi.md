---
name: Flusso pagamento agenzie a 3 stadi
description: E/C Agenzie → Agenzie in Pagamento (XML SEPA) → Storico Rimesse
type: feature
---

Solo per le agenzie (path `/contabilita/ec-agenzia`), non per compagnie.

**Stadi:**
1. **E/C Agenzie**: CTA "Metti in pagamento" (action `metti_in_pagamento`) crea `rimessa_premi` con `stato='in_pagamento'`, `data_messa_in_pagamento`, senza IBAN/conto/importo. Dialog ridotto a Note.
2. **Agenzie in Pagamento** (`/contabilita/ec-agenzia/in-pagamento`): bozze raggruppate per `conto_bancario_mittente_id`. Azioni: `assegna_mittente`, `rimuovi_titolo`, `annulla`, `genera_xml_sepa` (pain.001.001.03 multi-tx per gruppo, salvato in bucket `rimesse-pdf/flussi-sepa/` + `documenti` cat. "Flusso SEPA" + `flusso_xml_id`), `conferma_pagamento` (stato `pagata`, genera PDF E/C automatico per ogni rimessa).
3. **Storico**: stato `pagata` (vista invariata, riusa PDF in `documenti` cat. "EC Agenzia").

**Edge function `gestione-rimessa`** azioni: `metti_in_pagamento`, `assegna_mittente`, `rimuovi_titolo`, `genera_xml_sepa`, `conferma_pagamento`, `crea` (legacy compagnie), `annulla`, `genera_xml` (legacy).

**DB**: `rimessa_premi.data_messa_in_pagamento date`, `flusso_xml_id uuid → documenti(id)`. Stati: `in_pagamento|pronta|pagata|annullata`. La query "titoli usati" filtra `rimessa_premi.stato != 'annullata'` via inner join.
