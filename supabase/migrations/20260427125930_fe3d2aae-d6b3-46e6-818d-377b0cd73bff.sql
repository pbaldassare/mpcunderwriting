DO $$
DECLARE
  v_master_id uuid;
  v_dup_id uuid;
  cluster_rec RECORD;
  v_total_merged int := 0;
  v_total_clusters int := 0;
BEGIN
  FOR cluster_rec IN
    WITH base AS (
      SELECT c.id, c.nome, c.codice,
        UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(c.nome), '^\*+', ''), '\s+', ' ', 'g')) AS norm,
        (SELECT COUNT(*) FROM public.titoli t WHERE t.compagnia_id = c.id) AS n_titoli
      FROM public.compagnie c
      WHERE c.nome IS NOT NULL AND TRIM(c.nome) <> ''
    ),
    ranked AS (
      SELECT id, norm, codice, n_titoli,
        ROW_NUMBER() OVER (PARTITION BY norm ORDER BY n_titoli DESC, codice ASC) AS rn,
        COUNT(*) OVER (PARTITION BY norm) AS cluster_size
      FROM base
    )
    SELECT norm,
      (ARRAY_AGG(id ORDER BY rn) FILTER (WHERE rn = 1))[1] AS master_id,
      ARRAY_AGG(id ORDER BY rn) FILTER (WHERE rn > 1) AS dup_ids
    FROM ranked
    WHERE cluster_size > 1
    GROUP BY norm
  LOOP
    v_master_id := cluster_rec.master_id;
    v_total_clusters := v_total_clusters + 1;

    FOREACH v_dup_id IN ARRAY cluster_rec.dup_ids LOOP
      UPDATE public.titoli                     SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.sinistri                   SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.prodotti                   SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.flussi_compagnia           SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.provvigioni_compagnia_ramo SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.rimessa_premi              SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.dettaglio_riparto          SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.document_folders           SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.anagrafiche_professionali  SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;
      UPDATE public.trattative                 SET compagnia_id = v_master_id WHERE compagnia_id = v_dup_id;

      DELETE FROM public.compagnie WHERE id = v_dup_id;
      v_total_merged := v_total_merged + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Aggregazione: % cluster, % record fusi', v_total_clusters, v_total_merged;
END $$;