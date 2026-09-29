ALTER TABLE uffici ADD COLUMN IF NOT EXISTS indirizzo text;
ALTER TABLE uffici ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE uffici ADD COLUMN IF NOT EXISTS telefono text;

UPDATE uffici SET 
  indirizzo = CASE nome_ufficio
    WHEN 'Milano' THEN 'Via Torino 15, 20123 Milano (MI)'
    WHEN 'Roma' THEN 'Via del Corso 112, 00186 Roma (RM)'
    WHEN 'Napoli' THEN 'Corso Umberto I 45, 80138 Napoli (NA)'
    WHEN 'Torino' THEN 'Via Roma 28, 10121 Torino (TO)'
    WHEN 'Bologna' THEN 'Via Indipendenza 33, 40121 Bologna (BO)'
    WHEN 'Firenze' THEN 'Via Calzaiuoli 7, 50122 Firenze (FI)'
    WHEN 'Genova' THEN 'Via XX Settembre 40, 16121 Genova (GE)'
    WHEN 'Palermo' THEN 'Via Maqueda 100, 90133 Palermo (PA)'
    WHEN 'Bari' THEN 'Corso Cavour 18, 70121 Bari (BA)'
    WHEN 'Venezia' THEN 'San Marco 1234, 30124 Venezia (VE)'
    ELSE 'Via Garibaldi 1, 00100 Italia'
  END,
  email = CASE 
    WHEN nome_ufficio IS NOT NULL THEN 'sede-' || lower(replace(nome_ufficio, ' ', '')) || '@consulnet.it'
    ELSE 'sede@consulnet.it'
  END,
  telefono = CASE nome_ufficio
    WHEN 'Milano' THEN '02 9876543'
    WHEN 'Roma' THEN '06 1234567'
    WHEN 'Napoli' THEN '081 7654321'
    WHEN 'Torino' THEN '011 2345678'
    WHEN 'Bologna' THEN '051 3456789'
    WHEN 'Firenze' THEN '055 4567890'
    WHEN 'Genova' THEN '010 5678901'
    WHEN 'Palermo' THEN '091 6789012'
    WHEN 'Bari' THEN '080 7890123'
    WHEN 'Venezia' THEN '041 8901234'
    ELSE '02 0000000'
  END
WHERE indirizzo IS NULL;