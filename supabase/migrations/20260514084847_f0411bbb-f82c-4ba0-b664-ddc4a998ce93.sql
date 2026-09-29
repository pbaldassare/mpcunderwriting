UPDATE titoli
SET frazionamento = CASE rate
  WHEN 1 THEN CASE WHEN COALESCE(anni_durata, 1) > 1 THEN 'Poliennale' ELSE 'Annuale' END
  WHEN 2 THEN 'Semestrale'
  WHEN 3 THEN 'Quadrimestrale'
  WHEN 4 THEN 'Trimestrale'
  WHEN 12 THEN 'Mensile'
  ELSE 'Annuale'
END
WHERE frazionamento IS NULL AND rate IS NOT NULL;