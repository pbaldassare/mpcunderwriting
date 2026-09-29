-- Sincronizza dettaglio_riparto (coassicurazione) su quietanze e ricalcola importi
-- quando cambiano i premi del titolo. Template quote/compagnie dalla madre o dal
-- riparto esistente; importi ricalcolati sui totali del titolo corrente.

CREATE OR REPLACE FUNCTION public.sync_riparto_coassicurazione_titolo(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_t public.titoli%ROWTYPE;
  v_madre_id uuid;
  v_template_titolo_id uuid;
  v_should_sync boolean := false;
  v_tpl record;
  v_rows jsonb := '[]'::jsonb;
  v_n int;
  v_i int := 0;
  v_tot_netto numeric;
  v_tot_add numeric;
  v_tot_tasse numeric;
  v_tot_lordo numeric;
  v_provv_tot numeric;
  v_provv_n numeric;
  v_provv_a numeric;
  v_perc_n numeric;
  v_perc_a numeric;
  v_acc_netto numeric := 0;
  v_acc_add numeric := 0;
  v_acc_tasse numeric := 0;
  v_acc_lordo numeric := 0;
  v_acc_pvn numeric := 0;
  v_acc_pva numeric := 0;
  v_quota numeric;
  v_is_last boolean;
  v_row_netto numeric;
  v_row_add numeric;
  v_row_tasse numeric;
  v_row_lordo numeric;
  v_row_pvn numeric;
  v_row_pva numeric;
BEGIN
  SELECT * INTO v_t FROM public.titoli WHERE id = p_titolo_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Polizza madre (stesso numero, senza sostituisce_polizza)
  IF v_t.sostituisce_polizza IS NOT NULL AND v_t.numero_titolo IS NOT NULL THEN
    SELECT m.id INTO v_madre_id
    FROM public.titoli m
    WHERE trim(m.numero_titolo) = trim(v_t.numero_titolo)
      AND m.sostituisce_polizza IS NULL
      AND COALESCE(m.is_regolazione, false) = false
      AND COALESCE(m.is_appendice_modifica, false) = false
      AND COALESCE(m.is_proroga, false) = false
    ORDER BY COALESCE(m.riga, 0) ASC
    LIMIT 1;
  END IF;

  v_should_sync := COALESCE(v_t.coassicurazione, false);
  IF NOT v_should_sync AND v_madre_id IS NOT NULL THEN
    SELECT COALESCE(m.coassicurazione, false) INTO v_should_sync
    FROM public.titoli m WHERE m.id = v_madre_id;
  END IF;

  IF NOT v_should_sync THEN
    RETURN;
  END IF;

  -- Template struttura: riparto proprio (se >=2 righe) altrimenti madre
  IF (SELECT count(*) FROM public.dettaglio_riparto WHERE titolo_id = p_titolo_id) >= 2 THEN
    v_template_titolo_id := p_titolo_id;
  ELSIF v_madre_id IS NOT NULL
    AND (SELECT count(*) FROM public.dettaglio_riparto WHERE titolo_id = v_madre_id) >= 1 THEN
    v_template_titolo_id := v_madre_id;
  ELSIF (SELECT count(*) FROM public.dettaglio_riparto WHERE titolo_id = p_titolo_id) >= 1 THEN
    v_template_titolo_id := p_titolo_id;
  ELSE
    RETURN;
  END IF;

  SELECT count(*) INTO v_n
  FROM public.dettaglio_riparto
  WHERE titolo_id = v_template_titolo_id;

  IF v_n < 2 THEN
    IF v_template_titolo_id <> p_titolo_id THEN
      RETURN;
    END IF;
  END IF;

  v_tot_netto := COALESCE(v_t.premio_netto, 0);
  v_tot_add := COALESCE(v_t.addizionali, 0);
  v_tot_tasse := COALESCE(v_t.tasse, 0);
  v_tot_lordo := COALESCE(v_t.premio_lordo, 0);
  v_provv_tot := COALESCE(v_t.provvigioni_quietanza, v_t.provvigioni_firma, 0);

  SELECT
    COALESCE(dr.perc_provv_netto, 0),
    COALESCE(dr.perc_provv_addizionali, 0)
  INTO v_perc_n, v_perc_a
  FROM public.dettaglio_riparto dr
  WHERE dr.titolo_id = v_template_titolo_id
  ORDER BY dr.created_at NULLS LAST, dr.id
  LIMIT 1;

  v_provv_n := v_provv_tot;
  v_provv_a := 0;

  -- Snapshot template prima del delete (evita di cancellare il proprio template)
  DROP TABLE IF EXISTS _tpl_riparto_coass;
  CREATE TEMP TABLE _tpl_riparto_coass ON COMMIT DROP AS
  SELECT *
  FROM public.dettaglio_riparto
  WHERE titolo_id = v_template_titolo_id
  ORDER BY created_at NULLS LAST, id;

  DELETE FROM public.dettaglio_riparto WHERE titolo_id = p_titolo_id;

  FOR v_tpl IN SELECT * FROM _tpl_riparto_coass
  LOOP
    v_i := v_i + 1;
    v_is_last := (v_i = v_n);
    v_quota := COALESCE(v_tpl.quota_percentuale, 0) / 100.0;

    IF v_is_last THEN
      v_row_netto := round(v_tot_netto - v_acc_netto, 2);
      v_row_add := round(v_tot_add - v_acc_add, 2);
      v_row_tasse := round(v_tot_tasse - v_acc_tasse, 2);
      v_row_lordo := round(v_tot_lordo - v_acc_lordo, 2);
      v_row_pvn := round(v_provv_n - v_acc_pvn, 2);
      v_row_pva := round(v_provv_a - v_acc_pva, 2);
    ELSE
      v_row_netto := round(v_tot_netto * v_quota, 2);
      v_row_add := round(v_tot_add * v_quota, 2);
      v_row_tasse := round(v_tot_tasse * v_quota, 2);
      v_row_lordo := round(v_tot_lordo * v_quota, 2);
      v_row_pvn := round(v_provv_n * v_quota, 2);
      v_row_pva := round(v_provv_a * v_quota, 2);
      v_acc_netto := v_acc_netto + v_row_netto;
      v_acc_add := v_acc_add + v_row_add;
      v_acc_tasse := v_acc_tasse + v_row_tasse;
      v_acc_lordo := v_acc_lordo + v_row_lordo;
      v_acc_pvn := v_acc_pvn + v_row_pvn;
      v_acc_pva := v_acc_pva + v_row_pva;
    END IF;

    INSERT INTO public.dettaglio_riparto (
      titolo_id,
      compagnia_id,
      gruppo_compagnia_id,
      compagnia_rapporto_id,
      quota_percentuale,
      perc_provv_netto,
      perc_provv_addizionali,
      netto,
      addizionali,
      tasse,
      totale,
      provv_netto,
      provv_addizionali,
      tipo_pagamento
    ) VALUES (
      p_titolo_id,
      v_tpl.compagnia_id,
      v_tpl.gruppo_compagnia_id,
      v_tpl.compagnia_rapporto_id,
      v_tpl.quota_percentuale,
      COALESCE(v_tpl.perc_provv_netto, v_perc_n),
      COALESCE(v_tpl.perc_provv_addizionali, v_perc_a),
      v_row_netto,
      v_row_add,
      v_row_tasse,
      v_row_lordo,
      v_row_pvn,
      v_row_pva,
      COALESCE(v_tpl.tipo_pagamento, 'C')
    );
  END LOOP;

  UPDATE public.titoli
  SET coassicurazione = true,
      updated_at = now()
  WHERE id = p_titolo_id
    AND COALESCE(coassicurazione, false) = false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_riparto_coassicurazione_titolo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_riparto_coassicurazione_titolo(uuid) TO service_role;

COMMENT ON FUNCTION public.sync_riparto_coassicurazione_titolo(uuid) IS
  'Rigenera dettaglio_riparto per un titolo coassicurato usando quote/template dalla madre e importi dai totali del titolo.';

-- Dopo salvataggio premi: allinea riparto coass
CREATE OR REPLACE FUNCTION public.salva_premi_garanzia_titolo(
  p_titolo_id uuid,
  p_tipo_premio text,
  p_rows jsonb,
  p_titolo_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticazione richiesta';
  END IF;

  IF p_tipo_premio NOT IN ('firma', 'quietanza') THEN
    RAISE EXCEPTION 'tipo_premio non valido: %', p_tipo_premio;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.titoli WHERE id = p_titolo_id) THEN
    RAISE EXCEPTION 'Titolo % non trovato', p_titolo_id;
  END IF;

  PERFORM id FROM public.titoli WHERE id = p_titolo_id FOR UPDATE;

  DELETE FROM public.premi_garanzia_polizza
  WHERE titolo_id = p_titolo_id
    AND tipo_premio = p_tipo_premio;

  IF p_rows IS NOT NULL AND jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO public.premi_garanzia_polizza (
      titolo_id, tipo_premio, garanzia, codice_garanzia,
      capitale, tasso, firma, rata, accessori, annuo, ordine,
      aliquota_tasse_pct, ssn, tasse_rettifica,
      provvigione_netto_pct, provvigione_accessori_pct, quietanza_personalizzata
    )
    SELECT
      p_titolo_id,
      p_tipo_premio,
      COALESCE(r.garanzia, 'Premio'),
      NULLIF(r.codice_garanzia, ''),
      COALESCE(r.capitale, 0),
      COALESCE(r.tasso, 0),
      COALESCE(r.firma, 0),
      COALESCE(r.rata, 0),
      COALESCE(r.accessori, 0),
      COALESCE(r.annuo, 0),
      COALESCE(r.ordine, 0),
      r.aliquota_tasse_pct,
      COALESCE(r.ssn, 0),
      COALESCE(r.tasse_rettifica, 0),
      r.provvigione_netto_pct,
      r.provvigione_accessori_pct,
      COALESCE(r.quietanza_personalizzata, false)
    FROM jsonb_to_recordset(p_rows) AS r(
      garanzia text,
      codice_garanzia text,
      capitale numeric,
      tasso numeric,
      firma numeric,
      rata numeric,
      accessori numeric,
      annuo numeric,
      ordine int,
      aliquota_tasse_pct numeric,
      ssn numeric,
      tasse_rettifica numeric,
      provvigione_netto_pct numeric,
      provvigione_accessori_pct numeric,
      quietanza_personalizzata boolean
    );
  END IF;

  UPDATE public.titoli SET
    premio_netto = CASE WHEN p_titolo_updates ? 'premio_netto' THEN (p_titolo_updates->>'premio_netto')::numeric ELSE premio_netto END,
    addizionali = CASE WHEN p_titolo_updates ? 'addizionali' THEN (p_titolo_updates->>'addizionali')::numeric ELSE addizionali END,
    tasse = CASE WHEN p_titolo_updates ? 'tasse' THEN (p_titolo_updates->>'tasse')::numeric ELSE tasse END,
    ssn_firma = CASE WHEN p_titolo_updates ? 'ssn_firma' THEN (p_titolo_updates->>'ssn_firma')::numeric ELSE ssn_firma END,
    premio_lordo = CASE WHEN p_titolo_updates ? 'premio_lordo' THEN (p_titolo_updates->>'premio_lordo')::numeric ELSE premio_lordo END,
    provvigioni_firma = CASE WHEN p_titolo_updates ? 'provvigioni_firma' THEN (p_titolo_updates->>'provvigioni_firma')::numeric ELSE provvigioni_firma END,
    premio_netto_quietanza = CASE WHEN p_titolo_updates ? 'premio_netto_quietanza' THEN (p_titolo_updates->>'premio_netto_quietanza')::numeric ELSE premio_netto_quietanza END,
    addizionali_quietanza = CASE WHEN p_titolo_updates ? 'addizionali_quietanza' THEN (p_titolo_updates->>'addizionali_quietanza')::numeric ELSE addizionali_quietanza END,
    tasse_quietanza = CASE WHEN p_titolo_updates ? 'tasse_quietanza' THEN (p_titolo_updates->>'tasse_quietanza')::numeric ELSE tasse_quietanza END,
    ssn_quietanza = CASE WHEN p_titolo_updates ? 'ssn_quietanza' THEN (p_titolo_updates->>'ssn_quietanza')::numeric ELSE ssn_quietanza END,
    provvigioni_quietanza = CASE WHEN p_titolo_updates ? 'provvigioni_quietanza' THEN (p_titolo_updates->>'provvigioni_quietanza')::numeric ELSE provvigioni_quietanza END,
    updated_at = now()
  WHERE id = p_titolo_id;

  PERFORM public.sync_riparto_coassicurazione_titolo(p_titolo_id);
END;
$function$;

-- Nuove quietanze: propaga coass dalla madre appena create
CREATE OR REPLACE FUNCTION public.trg_titoli_sync_riparto_coass_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NEW.sostituisce_polizza IS NOT NULL THEN
    PERFORM public.sync_riparto_coassicurazione_titolo(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_titoli_sync_riparto_coass_after_insert ON public.titoli;
CREATE TRIGGER trg_titoli_sync_riparto_coass_after_insert
  AFTER INSERT ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_titoli_sync_riparto_coass_after_insert();

-- Backfill quietanze esistenti con madre coassicurata
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT q.id
    FROM public.titoli q
    JOIN public.titoli m ON trim(m.numero_titolo) = trim(q.numero_titolo)
      AND m.sostituisce_polizza IS NULL
      AND COALESCE(m.coassicurazione, false) = true
    WHERE q.sostituisce_polizza IS NOT NULL
      AND COALESCE(q.is_regolazione, false) = false
      AND COALESCE(q.is_appendice_modifica, false) = false
      AND COALESCE(q.is_proroga, false) = false
  LOOP
    PERFORM public.sync_riparto_coassicurazione_titolo(r.id);
  END LOOP;
END;
$$;
