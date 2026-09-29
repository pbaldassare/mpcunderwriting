-- Import storico gare - parte 1/5 (anni 2009-2016 da foglio INTERMEDIA, ~400 righe)
-- Il contenuto SQL è in /tmp/insert_part_1.sql sul sandbox
-- Esegui leggendo il file
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.storico_gare;
  RAISE NOTICE 'storico_gare attualmente: % righe', v_count;
END $$;