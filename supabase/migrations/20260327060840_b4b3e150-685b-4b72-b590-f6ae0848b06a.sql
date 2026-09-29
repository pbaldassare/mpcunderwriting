
WITH napoli_clients AS (
  SELECT id, 
    ROW_NUMBER() OVER (ORDER BY id) as rn,
    COUNT(*) OVER () as total
  FROM clienti 
  WHERE ufficio_id = '68506cb3-3662-4967-bc88-8f5992f8efdc'
)
UPDATE clienti SET ufficio_id = CASE
  WHEN nc.rn <= (nc.total / 4) THEN '5d5ddfa7-2df7-4234-ae1b-38487574b4c2'::uuid
  WHEN nc.rn <= (nc.total / 4) * 2 THEN '05d27a37-124d-4bef-bff4-91e4ac082df1'::uuid
  WHEN nc.rn <= (nc.total / 4) * 3 THEN '6f59040c-2955-4f85-aafd-358c9a7ccb75'::uuid
  ELSE '13a4d099-d57f-4759-9ed1-72180b24069f'::uuid
END
FROM napoli_clients nc
WHERE clienti.id = nc.id;
