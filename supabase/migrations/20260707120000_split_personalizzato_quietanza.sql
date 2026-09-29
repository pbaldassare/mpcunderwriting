-- ---------------------------------------------------------------------------
-- Provvigioni produttore personalizzabili per singola quietanza.
--
-- Flag `titoli.split_personalizzato`: quando true su una quietanza figlia,
-- i suoi split commerciali NON vengono più sovrascritti dalla sincronizzazione
-- della polizza madre. Alla disattivazione la quietanza torna ad ereditare
-- gli split della madre (re-sync).
-- ---------------------------------------------------------------------------

ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS split_personalizzato boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.titoli.split_personalizzato IS
  'Quietanza con provvigioni produttore personalizzate: esclusa dal sync split della polizza madre.';

-- ---------------------------------------------------------------------------
-- Sync madre → figlie: salta le quietanze con split personalizzato
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_split_commerciali_to_children(p_madre_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero text;
  v_riga int;
  v_child_id uuid;
BEGIN
  SELECT numero_titolo, COALESCE(riga, 1)
    INTO v_numero, v_riga
  FROM public.titoli
  WHERE id = p_madre_id;

  IF v_numero IS NULL THEN
    RETURN;
  END IF;

  FOR v_child_id IN
    SELECT t.id
    FROM public.titoli t
    WHERE t.sostituisce_polizza = v_numero
      AND COALESCE(t.sostituisce_riga, 1) = v_riga
      AND COALESCE(t.is_regolazione, false) = false
      AND COALESCE(t.is_appendice_modifica, false) = false
      AND COALESCE(t.is_proroga, false) = false
      AND COALESCE(t.split_personalizzato, false) = false
  LOOP
    DELETE FROM public.titoli_split_commerciali WHERE titolo_id = v_child_id;

    INSERT INTO public.titoli_split_commerciali (
      titolo_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
    )
    SELECT
      v_child_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
    FROM public.titoli_split_commerciali
    WHERE titolo_id = p_madre_id
    ORDER BY ordine;

    -- Allinea anche i campi legacy sul titolo figlio (primo split = principale)
    UPDATE public.titoli c SET
      anagrafica_commerciale_id = m.anagrafica_commerciale_id,
      commerciale_id = m.commerciale_id,
      percentuale_commerciale = m.percentuale_commerciale,
      produttore_nome = m.produttore_nome,
      ae_anagrafica_id = m.ae_anagrafica_id,
      ae_nome = m.ae_nome,
      percentuale_ae = m.percentuale_ae
    FROM public.titoli m
    WHERE c.id = v_child_id AND m.id = p_madre_id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Re-sync di una singola quietanza figlia dalla madre (usato alla
-- disattivazione del flag split_personalizzato).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resync_split_commerciali_from_madre(p_child_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_madre_id uuid;
  v_numero text;
  v_riga int;
BEGIN
  SELECT sostituisce_polizza, COALESCE(sostituisce_riga, 1)
    INTO v_numero, v_riga
  FROM public.titoli
  WHERE id = p_child_id;

  IF v_numero IS NULL THEN
    RETURN;
  END IF;

  SELECT t.id INTO v_madre_id
  FROM public.titoli t
  WHERE t.numero_titolo = v_numero
    AND COALESCE(t.riga, 1) = v_riga
    AND t.sostituisce_polizza IS NULL
  ORDER BY t.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_madre_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.titoli_split_commerciali WHERE titolo_id = p_child_id;

  INSERT INTO public.titoli_split_commerciali (
    titolo_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
  )
  SELECT
    p_child_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
  FROM public.titoli_split_commerciali
  WHERE titolo_id = v_madre_id
  ORDER BY ordine;

  UPDATE public.titoli c SET
    anagrafica_commerciale_id = m.anagrafica_commerciale_id,
    commerciale_id = m.commerciale_id,
    percentuale_commerciale = m.percentuale_commerciale,
    produttore_nome = m.produttore_nome,
    ae_anagrafica_id = m.ae_anagrafica_id,
    ae_nome = m.ae_nome,
    percentuale_ae = m.percentuale_ae
  FROM public.titoli m
  WHERE c.id = p_child_id AND m.id = v_madre_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_split_commerciali_to_children(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resync_split_commerciali_from_madre(uuid) TO authenticated;
