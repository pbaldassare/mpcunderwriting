-- Salva sedi abilitate (N:N) in un'unica transazione per evitare che il trigger
-- enforce_conto_consul_min_sedi fallisca tra DELETE e INSERT separati dal client.

CREATE OR REPLACE FUNCTION public.save_conti_bancari_uffici(
  p_conto_id uuid,
  p_ufficio_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_unique uuid[];
BEGIN
  SELECT tipo INTO v_tipo
  FROM public.conti_bancari
  WHERE id = p_conto_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Conto bancario non trovato';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_unique
  FROM unnest(COALESCE(p_ufficio_ids, ARRAY[]::uuid[])) AS x;

  IF v_tipo IN ('incasso_clienti', 'provvigioni', 'generico') THEN
    IF cardinality(v_unique) = 0 THEN
      RAISE EXCEPTION 'I conti Consulbrokers devono avere almeno una sede abilitata.';
    END IF;
  END IF;

  DELETE FROM public.conti_bancari_uffici
  WHERE conto_bancario_id = p_conto_id
    AND NOT (ufficio_id = ANY (v_unique));

  INSERT INTO public.conti_bancari_uffici (conto_bancario_id, ufficio_id)
  SELECT p_conto_id, u
  FROM unnest(v_unique) AS u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conti_bancari_uffici cbu
    WHERE cbu.conto_bancario_id = p_conto_id
      AND cbu.ufficio_id = u
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_conti_bancari_uffici(uuid, uuid[]) TO authenticated;
