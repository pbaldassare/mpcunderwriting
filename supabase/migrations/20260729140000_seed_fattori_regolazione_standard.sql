-- Seed/upsert dei 5 fattori di regolazione standard (sempre disponibili in UI polizza).
-- Non collega a sottorami: le associazioni custom restano opzionali in sottoramo_fattori_regolazione.
-- `altro` (se già seedato) resta in catalogo ma non fa parte dei 5 standard UI.

INSERT INTO public.fattori_regolazione (codice, descrizione, attivo)
VALUES
  ('fatturato', 'Fatturato', true),
  ('num_dipendenti', 'N° dipendenti', true),
  ('retribuzioni', 'Retribuzioni', true),
  ('superficie', 'Superficie (mq)', true),
  ('valore_assicurato', 'Valore assicurato', true)
ON CONFLICT (codice) DO UPDATE SET
  descrizione = EXCLUDED.descrizione,
  attivo = true;
