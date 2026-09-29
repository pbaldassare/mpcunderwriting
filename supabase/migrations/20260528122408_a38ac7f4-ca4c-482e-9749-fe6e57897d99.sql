DELETE FROM public.documenti d
USING (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY bucket_name, path_storage ORDER BY created_at DESC) AS rn
  FROM public.documenti
  WHERE bucket_name = 'rimesse-pdf'
) ranked
WHERE d.id = ranked.id AND ranked.rn > 1;