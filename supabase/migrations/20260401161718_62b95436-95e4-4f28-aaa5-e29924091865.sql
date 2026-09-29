UPDATE titoli
SET stato = 'incassato',
    importo_incassato = premio_lordo,
    data_incasso = data_scadenza
WHERE data_scadenza <= '2026-02-28'
  AND stato IN ('attivo', 'sospeso');