
CREATE OR REPLACE FUNCTION public.cfo_drill_titoli(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _produttore_nome text DEFAULT NULL,
  _mese text DEFAULT NULL,
  _ramo text DEFAULT NULL,
  _cliente_id uuid DEFAULT NULL,
  _stato text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_titolo text,
  data_incasso date,
  cliente text,
  cliente_id uuid,
  ramo text,
  compagnia text,
  sede text,
  produttore text,
  premio_lordo numeric,
  importo_incassato numeric,
  provvigioni numeric,
  stato text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.numero_titolo,
    t.data_incasso,
    COALESCE(NULLIF(cl.ragione_sociale, ''), TRIM(COALESCE(cl.cognome,'') || ' ' || COALESCE(cl.nome,'')), '—') AS cliente,
    t.cliente_anagrafica_id AS cliente_id,
    COALESCE(t.gruppo_ramo, '—') AS ramo,
    COALESCE(c.nome, '—') AS compagnia,
    COALESCE(u.nome_ufficio, '—') AS sede,
    COALESCE(t.produttore_nome, '—') AS produttore,
    t.premio_lordo,
    t.importo_incassato,
    COALESCE(t.provvigioni_firma, 0) + COALESCE(t.provvigioni_quietanza, 0) AS provvigioni,
    t.stato
  FROM public.titoli t
  LEFT JOIN public.clienti cl ON cl.id = t.cliente_anagrafica_id
  LEFT JOIN public.compagnie c ON c.id = t.compagnia_id
  LEFT JOIN public.uffici u ON u.id = t.ufficio_id
  WHERE
    (_data_da IS NULL OR t.data_incasso >= _data_da)
    AND (_data_a IS NULL OR t.data_incasso <= _data_a)
    AND (_ufficio_id IS NULL OR t.ufficio_id = _ufficio_id)
    AND (_compagnia_id IS NULL OR t.compagnia_id = _compagnia_id)
    AND (_produttore_nome IS NULL OR t.produttore_nome = _produttore_nome)
    AND (_mese IS NULL OR to_char(t.data_incasso, 'YYYY-MM') = _mese)
    AND (_ramo IS NULL OR t.gruppo_ramo = _ramo)
    AND (_cliente_id IS NULL OR t.cliente_anagrafica_id = _cliente_id)
    AND (_stato IS NULL OR t.stato = _stato)
  ORDER BY t.data_incasso DESC NULLS LAST
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.cfo_drill_sinistri(
  _data_da date DEFAULT NULL,
  _data_a date DEFAULT NULL,
  _ufficio_id uuid DEFAULT NULL,
  _compagnia_id uuid DEFAULT NULL,
  _ramo text DEFAULT NULL,
  _stato text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_sinistro text,
  data_apertura date,
  data_evento date,
  cliente text,
  ramo text,
  compagnia text,
  sede text,
  importo_liquidato numeric,
  importo_riserva numeric,
  stato text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.numero_sinistro,
    s.data_apertura,
    s.data_evento,
    COALESCE(NULLIF(cl.ragione_sociale, ''), TRIM(COALESCE(cl.cognome,'') || ' ' || COALESCE(cl.nome,'')), '—') AS cliente,
    COALESCE(s.ramo_sinistro, '—') AS ramo,
    COALESCE(c.nome, '—') AS compagnia,
    COALESCE(u.nome_ufficio, '—') AS sede,
    s.importo_liquidato,
    s.importo_riserva,
    s.stato
  FROM public.sinistri s
  LEFT JOIN public.clienti cl ON cl.id = s.cliente_anagrafica_id
  LEFT JOIN public.compagnie c ON c.id = s.compagnia_id
  LEFT JOIN public.uffici u ON u.id = s.ufficio_id
  WHERE
    (_data_da IS NULL OR s.data_apertura >= _data_da)
    AND (_data_a IS NULL OR s.data_apertura <= _data_a)
    AND (_ufficio_id IS NULL OR s.ufficio_id = _ufficio_id)
    AND (_compagnia_id IS NULL OR s.compagnia_id = _compagnia_id)
    AND (_ramo IS NULL OR s.ramo_sinistro = _ramo)
    AND (_stato IS NULL OR s.stato = _stato)
  ORDER BY s.data_apertura DESC NULLS LAST
  LIMIT 500;
$$;
