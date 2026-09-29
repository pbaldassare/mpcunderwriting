
BEGIN;

-- Backup compagnie e gruppi
INSERT INTO public._backup_compagnie_cleanup_20260516 (source_table, payload)
SELECT 'compagnie', to_jsonb(c.*) FROM public.compagnie c
WHERE c.stato = 'Non operativo'
   OR c.gruppo_compagnia_id IN (SELECT id FROM public.gruppi_compagnia WHERE descrizione='PLURIMANDATARIO');

INSERT INTO public._backup_compagnie_cleanup_20260516 (source_table, payload)
SELECT 'gruppi_compagnia', to_jsonb(g.*) FROM public.gruppi_compagnia g
WHERE g.codice IN ('GC063','GC004','GC056','GC061','GC113','GC124','GC125','GC130')
   OR g.descrizione IN ('PLURIMANDATARIO','BROKER');

INSERT INTO public._backup_compagnie_cleanup_20260516 (source_table, payload)
SELECT 'compagnia_rapporti', to_jsonb(r.*) FROM public.compagnia_rapporti r
WHERE r.gruppo_compagnia_id IN (
  SELECT id FROM public.gruppi_compagnia
  WHERE codice IN ('GC063','GC004','GC056','GC061','GC113','GC124','GC125','GC130')
     OR descrizione IN ('PLURIMANDATARIO','BROKER')
);

-- MERGE 8 coppie
WITH pairs(old_code, new_code) AS (
  VALUES ('GC063','GC070'),('GC004','GC015'),('GC056','GC059'),('GC061','GC065'),
         ('GC113','GC117'),('GC124','GC127'),('GC125','GC128'),('GC130','GC132')
), remap AS (
  SELECT go.id AS old_id, gn.id AS new_id
  FROM pairs p
  JOIN public.gruppi_compagnia go ON go.codice=p.old_code
  JOIN public.gruppi_compagnia gn ON gn.codice=p.new_code
)
UPDATE public.compagnie c SET gruppo_compagnia_id = r.new_id
  FROM remap r WHERE c.gruppo_compagnia_id = r.old_id;

WITH pairs(old_code, new_code) AS (
  VALUES ('GC063','GC070'),('GC004','GC015'),('GC056','GC059'),('GC061','GC065'),
         ('GC113','GC117'),('GC124','GC127'),('GC125','GC128'),('GC130','GC132')
), remap AS (
  SELECT go.id AS old_id, gn.id AS new_id
  FROM pairs p
  JOIN public.gruppi_compagnia go ON go.codice=p.old_code
  JOIN public.gruppi_compagnia gn ON gn.codice=p.new_code
)
UPDATE public.compagnia_rapporti cr SET gruppo_compagnia_id = r.new_id
  FROM remap r WHERE cr.gruppo_compagnia_id = r.old_id;

DELETE FROM public.gruppi_compagnia
 WHERE codice IN ('GC063','GC004','GC056','GC061','GC113','GC124','GC125','GC130');

-- Agenzie da eliminare
CREATE TEMP TABLE _to_delete_compagnie ON COMMIT DROP AS
SELECT DISTINCT c.id FROM public.compagnie c
  LEFT JOIN public.gruppi_compagnia g ON g.id = c.gruppo_compagnia_id
 WHERE c.stato = 'Non operativo' OR g.descrizione = 'PLURIMANDATARIO';

INSERT INTO public._backup_compagnie_cleanup_20260516 (source_table, payload)
SELECT 'compagnia_rapporti', to_jsonb(r.*) FROM public.compagnia_rapporti r
WHERE r.compagnia_id IN (SELECT id FROM _to_delete_compagnie);

INSERT INTO public._backup_compagnie_cleanup_20260516 (source_table, payload)
SELECT 'provvigioni_compagnia_ramo', to_jsonb(p.*) FROM public.provvigioni_compagnia_ramo p
WHERE p.compagnia_id IN (SELECT id FROM _to_delete_compagnie);

UPDATE public.titoli                    SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.sinistri                  SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.trattative                SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.flussi_compagnia          SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.rimessa_premi             SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.dettaglio_riparto         SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.prodotti                  SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.anagrafiche_professionali SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
UPDATE public.document_folders          SET compagnia_id=NULL WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);

DELETE FROM public.compagnia_rapporti          WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
DELETE FROM public.provvigioni_compagnia_ramo  WHERE compagnia_id IN (SELECT id FROM _to_delete_compagnie);
DELETE FROM public.compagnie                   WHERE id           IN (SELECT id FROM _to_delete_compagnie);

-- BROKER → tipo='broker'
UPDATE public.compagnie SET tipo='broker', gruppo_compagnia_id=NULL
 WHERE gruppo_compagnia_id = (SELECT id FROM public.gruppi_compagnia WHERE descrizione='BROKER');

DELETE FROM public.compagnia_rapporti
 WHERE gruppo_compagnia_id IN (SELECT id FROM public.gruppi_compagnia WHERE descrizione IN ('PLURIMANDATARIO','BROKER'));

DELETE FROM public.gruppi_compagnia WHERE descrizione IN ('PLURIMANDATARIO','BROKER');

COMMIT;
