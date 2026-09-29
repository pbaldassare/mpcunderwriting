-- Grant execute su sync_quietanza_da_firma per chiamata RPC dal client
GRANT EXECUTE ON FUNCTION public.sync_quietanza_da_firma(uuid) TO authenticated, service_role;

-- Backfill: per ogni titolo che ha una riga RCA Firma ma manca la riga RCA Quietanza, sincronizza
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT f.titolo_id
    FROM public.premi_garanzia_polizza f
    WHERE f.tipo_premio = 'firma'
      AND NOT EXISTS (
        SELECT 1 FROM public.premi_garanzia_polizza q
        WHERE q.titolo_id = f.titolo_id AND q.tipo_premio = 'quietanza'
      )
  LOOP
    PERFORM public.sync_quietanza_da_firma(r.titolo_id);
  END LOOP;
END$$;