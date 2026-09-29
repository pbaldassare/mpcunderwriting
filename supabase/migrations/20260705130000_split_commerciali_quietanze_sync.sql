-- Propaga titoli_split_commerciali dalla polizza madre alle quietanze figlie
-- e aggiunge produttori_display alla vista portafoglio.

-- ---------------------------------------------------------------------------
-- 1) Helper: copia split da titolo sorgente a titolo destinazione
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.copy_titoli_split_commerciali(p_source uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_source IS NULL OR p_target IS NULL OR p_source = p_target THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.titoli_split_commerciali WHERE titolo_id = p_source) THEN
    RETURN;
  END IF;
  -- Non sovrascrivere split già configurati sul figlio
  IF EXISTS (SELECT 1 FROM public.titoli_split_commerciali WHERE titolo_id = p_target) THEN
    RETURN;
  END IF;

  INSERT INTO public.titoli_split_commerciali (
    titolo_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
  )
  SELECT
    p_target, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, note
  FROM public.titoli_split_commerciali
  WHERE titolo_id = p_source
  ORDER BY ordine;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Sync: propaga split madre → tutte le quietanze figlie (sovrascrive)
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
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_titoli_split_commerciali(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_split_commerciali_to_children(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Trigger AFTER INSERT: quietanza figlia eredita split dalla madre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_copy_split_on_child_titolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_madre_id uuid;
BEGIN
  IF NEW.sostituisce_polizza IS NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_regolazione, false) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_appendice_modifica, false) OR COALESCE(NEW.is_proroga, false) THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO v_madre_id
  FROM public.titoli t
  WHERE t.numero_titolo = NEW.sostituisce_polizza
    AND COALESCE(t.riga, 1) = COALESCE(NEW.sostituisce_riga, 1)
    AND t.sostituisce_polizza IS NULL
  ORDER BY t.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_madre_id IS NOT NULL THEN
    PERFORM public.copy_titoli_split_commerciali(v_madre_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_split_on_child_titolo ON public.titoli;
CREATE TRIGGER trg_copy_split_on_child_titolo
  AFTER INSERT ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_copy_split_on_child_titolo();

-- ---------------------------------------------------------------------------
-- 4) Vista portafoglio: produttori_display (multi-produttore)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_portafoglio_quietanze CASCADE;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  q.titolo_id                                         AS id,
  q.id                                                AS quietanza_id,
  p.id                                                AS polizza_id,
  q.titolo_id                                         AS titolo_legacy_id,
  COALESCE(p.numero_polizza, q.numero_polizza_snapshot, t.numero_titolo) AS numero_titolo,
  q.numero_polizza_snapshot,
  p.cig_rif,
  p.appendice_corrente,
  p.cliente_anagrafica_id,
  COALESCE(
    cli.ragione_sociale,
    NULLIF(TRIM(COALESCE(cli.cognome, '') || ' ' || COALESCE(cli.nome, '')), ''),
    '—'
  )                                                   AS cliente_nome_display,
  cli.codice_cliente                                  AS cliente_codice,
  p.compagnia_id,
  comp.nome                                           AS compagnia_nome,
  p.ramo_id,
  r.descrizione                                       AS ramo_nome,
  r.codice                                            AS ramo_codice,
  COALESCE(t.stato::text, p.stato::text)              AS stato,
  q.stato                                             AS stato_quietanza,
  p.stato                                             AS stato_polizza,
  q.garanzia_da,
  q.garanzia_a,
  q.data_competenza,
  q.data_scadenza,
  q.premio_lordo,
  q.premio_netto,
  q.tasse,
  q.addizionali,
  q.ssn,
  q.provvigioni_firma,
  q.provvigioni_quietanza,
  q.importo_incassato,
  t.rate,
  p.frazionamento,
  p.targa_telaio,
  t.ae_nome,
  t.specialist,
  t.produttore_nome,
  COALESCE(
    (
      SELECT string_agg(
        COALESCE(
          NULLIF(TRIM(a.ragione_sociale), ''),
          NULLIF(TRIM(COALESCE(a.cognome, '') || ' ' || COALESCE(a.nome, '')), ''),
          '—'
        ) || ' (' || TRIM(to_char(s.percentuale, 'FM999990.00')) || '%)',
        ', ' ORDER BY s.ordine, s.created_at
      )
      FROM public.titoli_split_commerciali s
      JOIN public.anagrafiche_professionali a ON a.id = s.anagrafica_commerciale_id
      WHERE s.titolo_id = q.titolo_id
    ),
    t.produttore_nome
  )                                                   AS produttori_display,
  p.descrizione_polizza,
  p.tipo_portafoglio,
  p.tacito_rinnovo,
  p.regolazione,
  p.durata_da,
  p.durata_a,
  q.data_messa_cassa,
  q.data_pagamento,
  q.data_incasso,
  COALESCE(t.data_copertura, q.data_copertura)        AS data_copertura,
  t.data_decorrenza_rinnovo,
  t.conferimento_gestito,
  t.fondi_ricevuti,
  p.data_sospensione,
  p.data_riattivazione,
  t.limite_riattivazione,
  t.sostituisce_polizza,
  t.is_regolazione,
  t.regolazione_quietanza_id,
  q.numero_rata,
  q.numero_rate_totali,
  p.ufficio_id,
  p.account_executive_anagrafica_id                   AS ae_anagrafica_id,
  p.anagrafica_commerciale_id,
  p.produttore_anagrafica_id                          AS produttore_id
FROM quietanze q
JOIN polizze   p    ON p.id = q.polizza_id
LEFT JOIN titoli    t   ON t.id  = q.titolo_id
LEFT JOIN clienti   cli ON cli.id = p.cliente_anagrafica_id
LEFT JOIN compagnie comp ON comp.id = p.compagnia_id
LEFT JOIN rami      r   ON r.id  = p.ramo_id
WHERE q.titolo_id IS NOT NULL;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT SELECT ON public.v_portafoglio_quietanze TO anon;
GRANT SELECT ON public.v_portafoglio_quietanze TO service_role;
