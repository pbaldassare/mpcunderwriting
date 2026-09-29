-- Stato sinistro `archiviato`: check constraint + RLS portale cliente + report.

ALTER TABLE public.sinistri DROP CONSTRAINT IF EXISTS sinistri_stato_check;
ALTER TABLE public.sinistri ADD CONSTRAINT sinistri_stato_check
  CHECK (stato IN (
    'bozza',
    'in_valutazione',
    'aperto',
    'in_lavorazione',
    'in_attesa_documenti',
    'in_liquidazione',
    'chiuso',
    'respinto',
    'archiviato'
  ));

COMMENT ON CONSTRAINT sinistri_stato_check ON public.sinistri IS
  'Stati pratica: bozza…respinto + archiviato (nascosto a cliente, elenco default ed estrazioni)';

-- Staff invariato. Il ruolo cliente non vede (né può scrivere) pratiche archiviate.
DROP POLICY IF EXISTS "Authenticated full access sinistri" ON public.sinistri;
CREATE POLICY "Authenticated full access sinistri" ON public.sinistri
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      NOT public.has_role(auth.uid(), 'cliente'::app_role)
      OR stato IS DISTINCT FROM 'archiviato'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      NOT public.has_role(auth.uid(), 'cliente'::app_role)
      OR stato IS DISTINCT FROM 'archiviato'
    )
  );

DROP POLICY IF EXISTS "Cliente select own sinistri" ON public.sinistri;
CREATE POLICY "Cliente select own sinistri"
ON public.sinistri
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids())
  AND stato IS DISTINCT FROM 'archiviato'
);

-- Estrazioni/report: di default esclude gli archiviati; _stato esplicito li può includere.
CREATE OR REPLACE FUNCTION public.report_sinistri(
  _data_da date DEFAULT NULL, _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL, _stato text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO result FROM (
    SELECT s.id, s.numero_sinistro, s.stato, s.data_apertura, s.data_chiusura, s.descrizione,
      c.nome AS compagnia, u.nome_ufficio AS ufficio,
      cli.cognome || ' ' || cli.nome AS cliente,
      resp.cognome || ' ' || resp.nome AS responsabile,
      (SELECT COUNT(*) FROM sinistro_eventi se WHERE se.sinistro_id = s.id AND se.stato = 'scaduto') AS eventi_scaduti
    FROM sinistri s
    LEFT JOIN compagnie c ON c.id = s.compagnia_id
    LEFT JOIN uffici u ON u.id = s.ufficio_id
    LEFT JOIN profiles cli ON cli.id = s.cliente_id
    LEFT JOIN profiles resp ON resp.id = s.responsabile_id
    WHERE (_data_da IS NULL OR s.data_apertura >= _data_da)
      AND (_data_a IS NULL OR s.data_apertura <= _data_a)
      AND (_ufficio_id IS NULL OR s.ufficio_id = _ufficio_id)
      AND (
        CASE
          WHEN _stato IS NULL THEN s.stato IS DISTINCT FROM 'archiviato'
          ELSE s.stato = _stato
        END
      )
    ORDER BY s.data_apertura DESC
    LIMIT 500
  ) r;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
