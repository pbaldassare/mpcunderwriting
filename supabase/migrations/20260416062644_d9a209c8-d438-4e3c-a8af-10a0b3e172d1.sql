UPDATE titoli
SET importo_incassato = premio_lordo
WHERE stato = 'incassato'
  AND importo_incassato IS NULL;