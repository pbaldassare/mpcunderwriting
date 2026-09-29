-- 1. Estende fn_polizza_genera_quietanze: poliennale = 1 quietanza per anno (era 1 sola)
CREATE OR REPLACE FUNCTION public.fn_polizza_genera_quietanze(_polizza_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  rate_anno integer;
  mesi_per_rata integer;
  mesi_totali integer;
  n_rate integer;
  i integer;
  rata_da date;
  rata_a date;
  inserted integer := 0;
  imp_lordo numeric; imp_netto numeric; imp_tasse numeric; imp_addiz numeric; imp_ssn numeric;
  imp_provf numeric; imp_provq numeric;
  anni_durata integer;
  is_poliennale boolean;
BEGIN
  SELECT * INTO p FROM public.polizze WHERE id = _polizza_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF p.durata_da IS NULL OR p.durata_a IS NULL THEN RETURN 0; END IF;

  is_poliennale := lower(coalesce(p.frazionamento,'annuale')) = 'poliennale';
  mesi_totali := GREATEST(1, ((EXTRACT(YEAR FROM age(p.durata_a, p.durata_da))*12)
                            + EXTRACT(MONTH FROM age(p.durata_a, p.durata_da)))::int + 1);
  anni_durata := GREATEST(1, COALESCE(p.anni_durata, ROUND(mesi_totali::numeric / 12.0)::int));

  IF is_poliennale THEN
    -- Poliennale: 1 quietanza annuale per ogni anno della durata
    mesi_per_rata := 12;
    n_rate := anni_durata;
  ELSE
    rate_anno := public.fn_rate_per_anno(p.frazionamento);
    mesi_per_rata := GREATEST(1, 12 / rate_anno);
    n_rate := GREATEST(1, mesi_totali / mesi_per_rata);
  END IF;

  -- Importo per singola rata: poliennale ora rata annuale (lordo/n_rate); altri come prima
  IF is_poliennale THEN
    imp_lordo := round(coalesce(p.premio_annuo_lordo,0), 2);
    imp_netto := round(coalesce(p.premio_annuo_netto,0), 2);
    imp_tasse := round(coalesce(p.tasse_annue,0), 2);
    imp_addiz := round(coalesce(p.addizionali_annue,0), 2);
    imp_ssn   := round(coalesce(p.ssn_annuo,0), 2);
    imp_provf := round(coalesce(p.provvigioni_annue_firma,0), 2);
    imp_provq := round(coalesce(p.provvigioni_annue_quietanza,0), 2);
  ELSE
    imp_lordo := round(coalesce(p.premio_annuo_lordo,0) * mesi_per_rata::numeric / 12.0, 2);
    imp_netto := round(coalesce(p.premio_annuo_netto,0) * mesi_per_rata::numeric / 12.0, 2);
    imp_tasse := round(coalesce(p.tasse_annue,0)        * mesi_per_rata::numeric / 12.0, 2);
    imp_addiz := round(coalesce(p.addizionali_annue,0)  * mesi_per_rata::numeric / 12.0, 2);
    imp_ssn   := round(coalesce(p.ssn_annuo,0)          * mesi_per_rata::numeric / 12.0, 2);
    imp_provf := round(coalesce(p.provvigioni_annue_firma,0)     * mesi_per_rata::numeric / 12.0, 2);
    imp_provq := round(coalesce(p.provvigioni_annue_quietanza,0) * mesi_per_rata::numeric / 12.0, 2);
  END IF;

  FOR i IN 1..n_rate LOOP
    rata_da := (p.durata_da + ((i-1)*mesi_per_rata) * interval '1 month')::date;
    rata_a  := ((p.durata_da + (i*mesi_per_rata) * interval '1 month') - interval '1 day')::date;
    IF NOT is_poliennale AND rata_a > p.durata_a THEN rata_a := p.durata_a; END IF;

    INSERT INTO public.quietanze(
      polizza_id, numero_rata, numero_rate_totali,
      garanzia_da, garanzia_a, data_competenza, data_scadenza,
      premio_lordo, premio_netto, tasse, addizionali, ssn,
      provvigioni_firma, provvigioni_quietanza,
      stato, numero_polizza_snapshot
    ) VALUES (
      _polizza_id, i, n_rate,
      rata_da, rata_a, rata_da, rata_a,
      imp_lordo, imp_netto, imp_tasse, imp_addiz, imp_ssn,
      imp_provf, imp_provq,
      'da_incassare', p.numero_polizza
    )
    ON CONFLICT (polizza_id, numero_rata) DO NOTHING;
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END $function$;

-- 2. Backfill: per ogni polizza attiva, genera le quietanze mancanti.
-- Skip annullate/sostituite. Usa la funzione aggiornata. Idempotente (ON CONFLICT).
DO $$
DECLARE
  pol RECORD;
  tot_pre integer;
  tot_post integer;
BEGIN
  SELECT COUNT(*) INTO tot_pre FROM public.quietanze;
  RAISE NOTICE 'Quietanze pre-backfill: %', tot_pre;

  FOR pol IN
    SELECT id, numero_polizza, stato, frazionamento, anni_durata
    FROM public.polizze
    WHERE stato NOT IN ('annullata','sostituita')
  LOOP
    PERFORM public.fn_polizza_genera_quietanze(pol.id);
  END LOOP;

  SELECT COUNT(*) INTO tot_post FROM public.quietanze;
  RAISE NOTICE 'Quietanze post-backfill: % (delta: %)', tot_post, tot_post - tot_pre;
END $$;

-- 3. Aggiorna numero_rate_totali sulle quietanze esistenti
-- (potrebbero avere numero_rate_totali=1 vecchio mentre ora ne esistono di piu')
UPDATE public.quietanze q
SET numero_rate_totali = sub.tot
FROM (
  SELECT polizza_id, COUNT(*) AS tot
  FROM public.quietanze
  GROUP BY polizza_id
) sub
WHERE q.polizza_id = sub.polizza_id
  AND q.numero_rate_totali IS DISTINCT FROM sub.tot;