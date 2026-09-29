-- Fix PL/pgSQL: SELECT senza INTO/RETURN in _titoli_chain_ids
-- Errore: "query has no destination for result data"

CREATE OR REPLACE FUNCTION public._titoli_chain_ids(p_titolo_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_madre_id uuid;
  v_numero text;
  v_riga int;
BEGIN
  SELECT id, numero_titolo, riga, sostituisce_polizza
    INTO v_madre_id, v_numero, v_riga, v_numero
  FROM public.titoli
  WHERE id = p_titolo_id;

  IF NOT FOUND THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  IF (SELECT sostituisce_polizza FROM public.titoli WHERE id = p_titolo_id) IS NOT NULL THEN
    SELECT id INTO v_madre_id
    FROM public.titoli
    WHERE numero_titolo = (SELECT numero_titolo FROM public.titoli WHERE id = p_titolo_id)
      AND sostituisce_polizza IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_madre_id IS NULL THEN
      v_madre_id := p_titolo_id;
    END IF;
  END IF;

  RETURN (
    WITH RECURSIVE chain AS (
      SELECT id FROM public.titoli WHERE id = v_madre_id
      UNION
      SELECT f.id
      FROM public.titoli f
      JOIN chain c ON f.sostituisce_polizza = (SELECT numero_titolo FROM public.titoli WHERE id = c.id)
                 AND (
                   (SELECT riga FROM public.titoli WHERE id = c.id) IS NULL AND f.sostituisce_riga IS NULL
                   OR f.sostituisce_riga = (SELECT riga FROM public.titoli WHERE id = c.id)
                 )
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) FROM chain
  );
END;
$$;
