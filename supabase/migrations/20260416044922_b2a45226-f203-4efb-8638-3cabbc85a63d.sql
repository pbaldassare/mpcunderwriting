UPDATE titoli
SET stato = 'attivo',
    data_messa_cassa = NULL
WHERE stato = 'incassato'
  AND data_messa_cassa = '2026-03-31';