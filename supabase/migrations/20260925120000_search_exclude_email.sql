-- Ricerca: esclude email/pec dal matching (liste, header, FTS).
-- SECURITY INVOKER invariato: RLS su public.clienti resta quella del chiamante.

CREATE OR REPLACE FUNCTION public.search_clienti_ranked(
  p_search text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH term AS (
    SELECT
      lower(trim(both FROM regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g'))) AS t
  ),
  tokens AS (
    SELECT
      CASE
        WHEN term.t = '' THEN ARRAY[]::text[]
        ELSE regexp_split_to_array(term.t, '\s+')
      END AS toks
    FROM term
  ),
  base AS (
    SELECT
      c.*,
      lower(trim(both FROM regexp_replace(
        coalesce(c.cognome, '') || ' ' ||
        coalesce(c.nome, '') || ' ' ||
        coalesce(c.ragione_sociale, '') || ' ' ||
        coalesce(c.codice_fiscale, '') || ' ' ||
        coalesce(c.codice_fiscale_azienda, '') || ' ' ||
        coalesce(c.partita_iva, '') || ' ' ||
        coalesce(c.telefono, '') || ' ' ||
        coalesce(c.cellulare, '') || ' ' ||
        coalesce(c.codice_ricerca, '') || ' ' ||
        coalesce(c.codice_cliente, '') || ' ' ||
        coalesce(c.indirizzo_residenza, '') || ' ' ||
        coalesce(c.indirizzo_sede, '') || ' ' ||
        coalesce(c.indirizzo_fiscale, '') || ' ' ||
        coalesce(c.indirizzo_alternativo, '') || ' ' ||
        coalesce(c.cap_residenza, '') || ' ' ||
        coalesce(c.cap_sede, '') || ' ' ||
        coalesce(c.cap_fiscale, '') || ' ' ||
        coalesce(c.cap_alternativo, '') || ' ' ||
        coalesce(c.citta_residenza, '') || ' ' ||
        coalesce(c.citta_sede, '') || ' ' ||
        coalesce(c.citta_fiscale, '') || ' ' ||
        coalesce(c.citta_alternativa, '') || ' ' ||
        coalesce(c.provincia_residenza, '') || ' ' ||
        coalesce(c.provincia_sede, '') || ' ' ||
        coalesce(c.provincia_fiscale, '') || ' ' ||
        coalesce(c.provincia_alternativa, '') || ' ' ||
        coalesce((
          SELECT string_agg(
            trim(both FROM coalesce(n.nome, '') || ' ' || coalesce(n.cognome, '')),
            ' '
          )
          FROM public.nominativi_cliente n
          WHERE n.cliente_id = c.id
        ), ''),
        '\s+', ' ', 'g'
      ))) AS search_blob,
      lower(trim(both FROM regexp_replace(
        coalesce(c.cognome, '') || ' ' || coalesce(c.nome, ''),
        '\s+', ' ', 'g'
      ))) AS display_cn,
      lower(trim(both FROM regexp_replace(
        coalesce(c.nome, '') || ' ' || coalesce(c.cognome, ''),
        '\s+', ' ', 'g'
      ))) AS display_nc
    FROM public.clienti c
    WHERE c.merged_into IS NULL
  ),
  matched AS (
    SELECT b.*
    FROM base b
    CROSS JOIN term
    CROSS JOIN tokens
    WHERE term.t <> ''
      AND (
        b.search_blob LIKE '%' || term.t || '%'
        OR (
          cardinality(tokens.toks) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(tokens.toks) AS tok
            WHERE b.search_blob NOT LIKE '%' || tok || '%'
          )
        )
      )
  ),
  scored AS (
    SELECT
      m.*,
      CASE
        WHEN lower(trim(both FROM coalesce(m.citta_residenza, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.citta_sede, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.citta_fiscale, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.citta_alternativa, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.indirizzo_residenza, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.indirizzo_sede, ''))) = term.t
          THEN 1
        WHEN lower(trim(both FROM coalesce(m.ragione_sociale, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.cognome, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.nome, ''))) = term.t
          OR m.display_cn = term.t
          OR m.display_nc = term.t
          THEN 2
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE term.t || '%'
          OR m.display_cn LIKE term.t || '%'
          OR m.display_nc LIKE term.t || '%'
          THEN 3
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE '%' || term.t || '%'
          OR m.display_cn LIKE '%' || term.t || '%'
          OR m.display_nc LIKE '%' || term.t || '%'
          OR m.search_blob LIKE '%' || term.t || '%'
          OR (
            cardinality(tokens.toks) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(tokens.toks) AS tok
              WHERE m.search_blob NOT LIKE '%' || tok || '%'
            )
          )
          THEN 4
        ELSE 5
      END AS relevance_score
    FROM matched m
    CROSS JOIN term
    CROSS JOIN tokens
  ),
  page AS (
    SELECT
      (to_jsonb(s) - 'relevance_score' - 'search_blob' - 'display_cn' - 'display_nc') AS row_data,
      s.relevance_score,
      s.cognome,
      s.ragione_sociale
    FROM scored s
    ORDER BY
      s.relevance_score ASC,
      s.cognome ASC NULLS LAST,
      s.ragione_sociale ASC NULLS LAST
    LIMIT greatest(coalesce(p_limit, 25), 0)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT count(*)::bigint FROM scored),
    'data', coalesce(
      (
        SELECT jsonb_agg(
          p.row_data
          ORDER BY p.relevance_score ASC, p.cognome ASC NULLS LAST, p.ragione_sociale ASC NULLS LAST
        )
        FROM page p
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.search_clienti_ranked(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_clienti_ranked(text, integer, integer) TO authenticated;

-- FTS header / palette: profiles e prospect senza email
CREATE OR REPLACE FUNCTION public.profiles_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.cognome, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_search ON public.profiles;
CREATE TRIGGER trg_profiles_search
  BEFORE INSERT OR UPDATE OF nome, cognome ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_search_trigger();

UPDATE public.profiles
SET search_vector = to_tsvector('italian', coalesce(nome, '') || ' ' || coalesce(cognome, ''));

CREATE OR REPLACE FUNCTION public.prospect_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian',
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.cognome, '') || ' ' ||
    coalesce(NEW.ragione_sociale, '') || ' ' ||
    coalesce(NEW.codice_fiscale, '') || ' ' ||
    coalesce(NEW.partita_iva, '') || ' ' ||
    coalesce(NEW.telefono, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospect_search ON public.prospect;
CREATE TRIGGER trg_prospect_search
  BEFORE INSERT OR UPDATE OF nome, cognome, ragione_sociale, codice_fiscale, partita_iva, telefono ON public.prospect
  FOR EACH ROW EXECUTE FUNCTION public.prospect_search_trigger();

UPDATE public.prospect
SET search_vector = to_tsvector('italian',
  coalesce(nome, '') || ' ' ||
  coalesce(cognome, '') || ' ' ||
  coalesce(ragione_sociale, '') || ' ' ||
  coalesce(codice_fiscale, '') || ' ' ||
  coalesce(partita_iva, '') || ' ' ||
  coalesce(telefono, '')
);
