-- Backfill idempotente: riallinea titoli appendice (AM/PR/RG) il cui
-- baseNumero(numero_titolo) non matcha la polizza/quietanza madre, usando
-- il link univoco in appendici_polizza (titolo_modifica_id / _proroga_id /
-- _regolazione_id → quietanza_id | titolo_id).
--
-- - Aggiorna solo numero_titolo → '{base}/{AM|PR|RG}{n}'
-- - NON tocca quietanze, premi, stati, né sostituisce_polizza
-- - Skip se link assente/ambiguo o se il nuovo numero collide con altra appendice
-- - Seconda esecuzione: 0 update (idempotente)
--
-- Dry-run (solo SELECT): vedi commento in coda al file.

DO $$
DECLARE
  r RECORD;
  v_updated int := 0;
  v_skipped int := 0;
  v_new_numero text;
  v_suffix text;
  v_target_base text;
  v_link_count int;
  v_collision boolean;
  v_old_base text;
  v_ancora_numero text;
  v_numero_appendice text;
BEGIN
  FOR r IN
    SELECT t.id AS titolo_id,
           t.numero_titolo AS old_numero,
           t.is_appendice_modifica,
           t.is_proroga,
           t.is_regolazione
    FROM public.titoli t
    WHERE COALESCE(t.is_appendice_modifica, false)
       OR COALESCE(t.is_proroga, false)
       OR COALESCE(t.is_regolazione, false)
  LOOP
    SELECT count(*)::int INTO v_link_count
    FROM public.appendici_polizza ap
    WHERE ap.titolo_modifica_id = r.titolo_id
       OR ap.titolo_proroga_id = r.titolo_id
       OR ap.titolo_regolazione_id = r.titolo_id;

    IF v_link_count = 0 THEN
      RAISE NOTICE 'SKIP appendice % (%) — nessun link appendici_polizza',
        r.titolo_id, r.old_numero;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_link_count <> 1 THEN
      RAISE NOTICE 'SKIP appendice % (%) — link_count=% (ambiguo)',
        r.titolo_id, r.old_numero, v_link_count;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT
      COALESCE(qm.numero_titolo, tm.numero_titolo),
      ap.numero_appendice
    INTO v_ancora_numero, v_numero_appendice
    FROM public.appendici_polizza ap
    LEFT JOIN public.titoli qm ON qm.id = ap.quietanza_id
    LEFT JOIN public.titoli tm ON tm.id = ap.titolo_id
    WHERE ap.titolo_modifica_id = r.titolo_id
       OR ap.titolo_proroga_id = r.titolo_id
       OR ap.titolo_regolazione_id = r.titolo_id
    LIMIT 1;

    v_target_base := trim(COALESCE(v_ancora_numero, ''));
    IF v_target_base = '' THEN
      RAISE NOTICE 'SKIP appendice % (%) — ancora senza numero_titolo',
        r.titolo_id, r.old_numero;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_old_base := regexp_replace(trim(COALESCE(r.old_numero, '')), '/(AM|PR|RG)\d+$', '', 'i');
    IF v_old_base = v_target_base THEN
      CONTINUE; -- già allineata
    END IF;

    v_suffix := (regexp_match(trim(COALESCE(r.old_numero, '')), '/((?:AM|PR|RG)\d+)$', 'i'))[1];
    IF v_suffix IS NULL THEN
      v_suffix := CASE
        WHEN COALESCE(r.is_appendice_modifica, false) THEN
          'AM' || COALESCE(NULLIF(regexp_replace(trim(COALESCE(v_numero_appendice, '')), '[^0-9]', '', 'g'), ''), '1')
        WHEN COALESCE(r.is_proroga, false) THEN
          'PR' || COALESCE(NULLIF(regexp_replace(trim(COALESCE(v_numero_appendice, '')), '[^0-9]', '', 'g'), ''), '1')
        WHEN COALESCE(r.is_regolazione, false) THEN
          'RG' || COALESCE(NULLIF(regexp_replace(trim(COALESCE(v_numero_appendice, '')), '[^0-9]', '', 'g'), ''), '1')
        ELSE NULL
      END;
    ELSE
      v_suffix := upper(substring(v_suffix from 1 for 2)) || substring(v_suffix from 3);
    END IF;

    IF v_suffix IS NULL THEN
      RAISE NOTICE 'SKIP appendice % (%) — suffix non determinabile', r.titolo_id, r.old_numero;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_new_numero := v_target_base || '/' || v_suffix;
    IF v_new_numero IS NOT DISTINCT FROM r.old_numero THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.titoli x
      WHERE x.id <> r.titolo_id
        AND x.numero_titolo = v_new_numero
        AND (
          COALESCE(x.is_appendice_modifica, false)
          OR COALESCE(x.is_proroga, false)
          OR COALESCE(x.is_regolazione, false)
        )
    ) INTO v_collision;

    IF v_collision THEN
      RAISE NOTICE 'SKIP appendice % (%) — collisione su %',
        r.titolo_id, r.old_numero, v_new_numero;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE public.titoli
    SET numero_titolo = v_new_numero
    WHERE id = r.titolo_id;

    RAISE NOTICE 'UPDATE appendice %: % → %', r.titolo_id, r.old_numero, v_new_numero;
    v_updated := v_updated + 1;
  END LOOP;

  RAISE NOTICE 'Backfill appendici numero_titolo: updated=%, skipped=%', v_updated, v_skipped;
END $$;

-- Dry-run (non modifica dati): elenca candidati che il DO aggiornerebbe.
-- SELECT
--   t.id,
--   t.numero_titolo AS old_numero,
--   trim(COALESCE(qm.numero_titolo, tm.numero_titolo))
--     || '/' || upper(substring(suf from 1 for 2)) || substring(suf from 3) AS new_numero
-- FROM titoli t
-- JOIN appendici_polizza ap ON (
--   ap.titolo_modifica_id = t.id OR ap.titolo_proroga_id = t.id OR ap.titolo_regolazione_id = t.id
-- )
-- LEFT JOIN titoli qm ON qm.id = ap.quietanza_id
-- LEFT JOIN titoli tm ON tm.id = ap.titolo_id
-- CROSS JOIN LATERAL (
--   SELECT (regexp_match(trim(t.numero_titolo), '/((?:AM|PR|RG)\d+)$', 'i'))[1] AS suf
-- ) s
-- WHERE (COALESCE(t.is_appendice_modifica,false) OR COALESCE(t.is_proroga,false) OR COALESCE(t.is_regolazione,false))
--   AND regexp_replace(trim(t.numero_titolo), '/(AM|PR|RG)\d+$', '', 'i')
--       IS DISTINCT FROM trim(COALESCE(qm.numero_titolo, tm.numero_titolo));
