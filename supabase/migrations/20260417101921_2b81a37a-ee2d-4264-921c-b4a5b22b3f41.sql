-- Ripristina i 2 titoli del carico aprile 2026 erroneamente annullati
-- (lo stato è stato cambiato a 'annullato' invece che a 'attivo' tramite il vecchio handler "Annulla incasso")
UPDATE titoli 
SET stato = 'attivo',
    data_messa_cassa = NULL,
    data_pagamento = NULL,
    data_decorrenza_rinnovo = NULL,
    data_incasso = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    fondi_ricevuti = true,
    data_conferimento_gestito = NULL,
    updated_at = now()
WHERE id IN (
  'd046ffeb-2ed1-43cc-ba03-a07cfb838804',
  '41feab18-7d73-4818-aff8-8a343e6780e9'
)
AND stato = 'annullato';