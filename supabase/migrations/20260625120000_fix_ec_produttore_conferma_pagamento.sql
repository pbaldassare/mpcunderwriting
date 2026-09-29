-- Fix E/C Produttore "Conferma pagamento":
-- 1. RPC referenced non-existent anagrafiche_professionali.user_id (runtime SQL error)
-- 2. documenti_generali storage lacked staff upload/select after broad policy removal
-- 3. documenti INSERT lacked policies for contabilita/backoffice roles

CREATE OR REPLACE FUNCTION public.segna_ec_produttore_pagato(
  p_anagrafica_id uuid,
  p_periodo_da date,
  p_periodo_a date,
  p_documento_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_count int := 0;
  v_totale numeric := 0;
  v_doc RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Utente non autenticato');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'cfo'::app_role)
    OR public.has_role(v_uid, 'contabilita'::app_role)
    OR public.has_role(v_uid, 'ufficio'::app_role)
    OR public.has_role(v_uid, 'backoffice'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permesso negato');
  END IF;

  IF p_periodo_da IS NULL OR p_periodo_a IS NULL OR p_periodo_da > p_periodo_a THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Periodo non valido');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.anagrafiche_professionali
    WHERE id = p_anagrafica_id
      AND tipo IN ('account_executive', 'corrispondente')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produttore non trovato');
  END IF;

  IF p_documento_id IS NOT NULL THEN
    SELECT id, entita_id, categoria INTO v_doc
    FROM public.documenti
    WHERE id = p_documento_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Documento non trovato');
    END IF;

    IF v_doc.categoria IS DISTINCT FROM 'EC Produttore'
       OR v_doc.entita_id IS DISTINCT FROM p_anagrafica_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Documento non valido per questo E/C produttore');
    END IF;
  END IF;

  SELECT
    array_agg(pg.id),
    count(*)::int,
    COALESCE(sum(pg.importo_provvigione), 0)
  INTO v_ids, v_count, v_totale
  FROM public.provvigioni_generate pg
  JOIN public.titoli t ON t.id = pg.titolo_id
  WHERE pg.tipo_destinatario IN ('commerciale', 'ae')
    AND pg.solo_statistico = false
    AND COALESCE(pg.pagata, false) = false
    AND t.data_messa_cassa IS NOT NULL
    AND t.data_messa_cassa >= p_periodo_da
    AND t.data_messa_cassa <= p_periodo_a
    AND (
      COALESCE(pg.anagrafica_commerciale_id, t.anagrafica_commerciale_id) = p_anagrafica_id
      OR pg.user_id IN (
        SELECT pr.id
        FROM public.profiles pr
        INNER JOIN public.anagrafiche_professionali ap
          ON lower(trim(pr.email)) = lower(trim(ap.email))
        WHERE ap.id = p_anagrafica_id
          AND pr.email IS NOT NULL
          AND ap.email IS NOT NULL
      )
    );

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Nessuna provvigione eleggibile da pagare per il periodo selezionato'
    );
  END IF;

  UPDATE public.provvigioni_generate
  SET pagata = true
  WHERE id = ANY(v_ids)
    AND COALESCE(pagata, false) = false;

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES (
    'conferma_pagamento_ec_produttore',
    'anagrafica_professionale',
    p_anagrafica_id,
    'info',
    jsonb_build_object(
      'periodo_da', p_periodo_da,
      'periodo_a', p_periodo_a,
      'provvigioni_count', v_count,
      'totale_provvigioni', v_totale,
      'documento_id', p_documento_id,
      'note', NULLIF(trim(p_note), '')
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'count', v_count,
    'totale', v_totale,
    'provvigioni_ids', to_jsonb(v_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.segna_ec_produttore_pagato(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.segna_ec_produttore_pagato(uuid, date, date, uuid, text) TO service_role;

-- Storage: staff contabilità può archiviare PDF E/C in documenti_generali
DROP POLICY IF EXISTS "Staff write documenti_generali" ON storage.objects;
CREATE POLICY "Staff write documenti_generali" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documenti_generali'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ufficio'::app_role)
      OR public.has_role(auth.uid(), 'contabilita'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
    )
  );

DROP POLICY IF EXISTS "Staff read documenti_generali" ON storage.objects;
CREATE POLICY "Staff read documenti_generali" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documenti_generali'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ufficio'::app_role)
      OR public.has_role(auth.uid(), 'contabilita'::app_role)
      OR public.has_role(auth.uid(), 'backoffice'::app_role)
      OR public.has_role(auth.uid(), 'cfo'::app_role)
    )
  );

-- documenti: INSERT/SELECT per ruoli contabilità operativi
DROP POLICY IF EXISTS "Contabilita insert documenti" ON public.documenti;
CREATE POLICY "Contabilita insert documenti" ON public.documenti
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'contabilita'::app_role));

DROP POLICY IF EXISTS "Backoffice insert documenti" ON public.documenti;
CREATE POLICY "Backoffice insert documenti" ON public.documenti
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'backoffice'::app_role));

DROP POLICY IF EXISTS "Contabilita select documenti" ON public.documenti;
CREATE POLICY "Contabilita select documenti" ON public.documenti
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'contabilita'::app_role));

DROP POLICY IF EXISTS "Backoffice select documenti" ON public.documenti;
CREATE POLICY "Backoffice select documenti" ON public.documenti
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'backoffice'::app_role));
