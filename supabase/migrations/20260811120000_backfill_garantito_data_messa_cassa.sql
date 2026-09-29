-- Backfill Garantito: data_messa_cassa = data_copertura quando la copertura
-- era stata confermata senza messa a cassa (regola prodotto corretta).
-- Esempio: quietanza 469479370 (AIR CANADA) e titoli analoghi.

UPDATE public.titoli
SET
  data_messa_cassa = data_copertura,
  tipo_pagamento = 'garantito',
  fondi_ricevuti = false,
  updated_at = now()
WHERE conferimento_gestito = true
  AND data_copertura IS NOT NULL
  AND data_messa_cassa IS NULL
  AND COALESCE(fondi_ricevuti, false) = false
  AND stato = 'attivo';
