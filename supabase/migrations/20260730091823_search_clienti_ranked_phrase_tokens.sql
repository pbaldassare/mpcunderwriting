-- Fix ricerca clienti: match su cognome||nome / nome||cognome e token AND.
-- Es. "de gobbi" trova cognome=DE, nome=GOBBI MARCO.
-- SECURITY INVOKER: rispetta le policy RLS su public.clienti del chiamante.

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
  matched AS (
    SELECT c.*
    FROM public.clienti c
    CROSS JOIN term
    CROSS JOIN tokens
    WHERE c.merged_into IS NULL
      AND term.t <> ''
      AND (
        -- Frase intera su campi singoli
        lower(coalesce(c.nome, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.cognome, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.ragione_sociale, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.codice_fiscale, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.codice_fiscale_azienda, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.partita_iva, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.email, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.pec, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.telefono, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.citta_residenza, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.citta_sede, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.codice_ricerca, '')) LIKE '%' || term.t || '%'
        OR lower(coalesce(c.codice_cliente, '')) LIKE '%' || term.t || '%'
        -- Frase intera su concatenazioni anagrafiche
        OR lower(trim(both FROM regexp_replace(
             coalesce(c.cognome, '') || ' ' || coalesce(c.nome, ''),
             '\s+', ' ', 'g'
           ))) LIKE '%' || term.t || '%'
        OR lower(trim(both FROM regexp_replace(
             coalesce(c.nome, '') || ' ' || coalesce(c.cognome, ''),
             '\s+', ' ', 'g'
           ))) LIKE '%' || term.t || '%'
        -- Token AND: ogni token deve comparire nel blob ricercabile
        OR (
          cardinality(tokens.toks) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(tokens.toks) AS tok
            WHERE lower(
              coalesce(c.cognome, '') || ' ' ||
              coalesce(c.nome, '') || ' ' ||
              coalesce(c.ragione_sociale, '') || ' ' ||
              coalesce(c.codice_fiscale, '') || ' ' ||
              coalesce(c.codice_fiscale_azienda, '') || ' ' ||
              coalesce(c.partita_iva, '') || ' ' ||
              coalesce(c.email, '') || ' ' ||
              coalesce(c.pec, '') || ' ' ||
              coalesce(c.telefono, '') || ' ' ||
              coalesce(c.citta_residenza, '') || ' ' ||
              coalesce(c.citta_sede, '') || ' ' ||
              coalesce(c.codice_ricerca, '') || ' ' ||
              coalesce(c.codice_cliente, '')
            ) NOT LIKE '%' || tok || '%'
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
          THEN 1
        WHEN lower(trim(both FROM coalesce(m.ragione_sociale, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.cognome, ''))) = term.t
          OR lower(trim(both FROM coalesce(m.nome, ''))) = term.t
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.cognome, '') || ' ' || coalesce(m.nome, ''),
               '\s+', ' ', 'g'
             ))) = term.t
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.nome, '') || ' ' || coalesce(m.cognome, ''),
               '\s+', ' ', 'g'
             ))) = term.t
          THEN 2
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE term.t || '%'
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.cognome, '') || ' ' || coalesce(m.nome, ''),
               '\s+', ' ', 'g'
             ))) LIKE term.t || '%'
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.nome, '') || ' ' || coalesce(m.cognome, ''),
               '\s+', ' ', 'g'
             ))) LIKE term.t || '%'
          THEN 3
        WHEN lower(coalesce(m.ragione_sociale, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.cognome, '')) LIKE '%' || term.t || '%'
          OR lower(coalesce(m.nome, '')) LIKE '%' || term.t || '%'
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.cognome, '') || ' ' || coalesce(m.nome, ''),
               '\s+', ' ', 'g'
             ))) LIKE '%' || term.t || '%'
          OR lower(trim(both FROM regexp_replace(
               coalesce(m.nome, '') || ' ' || coalesce(m.cognome, ''),
               '\s+', ' ', 'g'
             ))) LIKE '%' || term.t || '%'
          -- Token AND su anagrafica = contains-like
          OR (
            cardinality(tokens.toks) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(tokens.toks) AS tok
              WHERE lower(
                coalesce(m.cognome, '') || ' ' ||
                coalesce(m.nome, '') || ' ' ||
                coalesce(m.ragione_sociale, '')
              ) NOT LIKE '%' || tok || '%'
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
      (to_jsonb(s) - 'relevance_score') AS row_data,
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
