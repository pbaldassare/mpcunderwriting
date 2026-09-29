-- 8) Backfill appendici esistenti + pulizia polizze fantasma
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_phantom record;
BEGIN
  FOR r IN
    SELECT id FROM public.titoli
    WHERE COALESCE(is_appendice_modifica, false)
       OR COALESCE(is_proroga, false)
       OR COALESCE(is_regolazione, false)
  LOOP
    PERFORM public.fn_collega_quietanza_appendice(r.id);
  END LOOP;

  FOR v_phantom IN
    SELECT p.id AS polizza_id
    FROM public.polizze p
    WHERE p.numero_polizza ~ '/(AM|PR|RG)[0-9]+$'
      AND NOT EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.polizza_id = p.id
          AND NOT (
            COALESCE(t.is_appendice_modifica, false)
            OR COALESCE(t.is_proroga, false)
            OR COALESCE(t.is_regolazione, false)
          )
      )
  LOOP
    DELETE FROM public.quietanze WHERE polizza_id = v_phantom.polizza_id;
    DELETE FROM public.polizze WHERE id = v_phantom.polizza_id;
  END LOOP;
END;
$$;