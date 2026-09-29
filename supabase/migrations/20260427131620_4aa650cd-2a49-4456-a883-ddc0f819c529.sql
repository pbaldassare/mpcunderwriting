
-- Snapshot di sicurezza
CREATE TABLE IF NOT EXISTS public.compagnie_snapshot_round2 AS
SELECT *, now() AS snapshot_at FROM public.compagnie WHERE false;

ALTER TABLE public.compagnie_snapshot_round2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshot_round2_admin_only" ON public.compagnie_snapshot_round2;
CREATE POLICY "snapshot_round2_admin_only" ON public.compagnie_snapshot_round2
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Funzione di normalizzazione
CREATE OR REPLACE FUNCTION public._norm_compagnia_round2(_n text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        UPPER(TRIM(LEADING '*' FROM TRIM(COALESCE(_n,'')))),
        '[\.''`,()&/-]', ' ', 'g'
      ),
      '\m(SPA|S P A|SRL|S R L|SA|S A|SE|MUTUA|ASSICURAZIONI|ASSICURAZIONE|ASS NI|ASSNI|ASS|COMPAGNIA|GROUP|GRUPPO|ITALIA|ITALIANA|ITALIANE|LTD|LIMITED|AG|NV|PLC|INSURANCE|VERSICHERUNG|HOLDING)\M',
      ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

DO $$
DECLARE
  v_cluster RECORD;
  v_master_id uuid;
  v_dup RECORD;
  v_total_clusters int := 0;
  v_total_merged int := 0;
BEGIN
  -- Costruisci cluster con almeno 2 elementi
  FOR v_cluster IN
    SELECT public._norm_compagnia_round2(nome) AS norm_key
    FROM public.compagnie
    WHERE attiva = true OR attiva IS NULL
    GROUP BY public._norm_compagnia_round2(nome)
    HAVING COUNT(*) > 1 AND public._norm_compagnia_round2(nome) <> '' AND LENGTH(public._norm_compagnia_round2(nome)) >= 3
  LOOP
    -- Salta cluster troppo generici (es. "VITA", "DANNI")
    IF v_cluster.norm_key IN ('VITA','DANNI','GLOBAL','LIFE','NON LIFE') THEN
      CONTINUE;
    END IF;

    v_total_clusters := v_total_clusters + 1;

    -- Master = quello con più titoli (poi più vecchio)
    SELECT c.id INTO v_master_id
    FROM public.compagnie c
    WHERE public._norm_compagnia_round2(c.nome) = v_cluster.norm_key
    ORDER BY (SELECT COUNT(*) FROM public.titoli t WHERE t.compagnia_id = c.id) DESC,
             c.created_at ASC
    LIMIT 1;

    -- Snapshot dei duplicati
    INSERT INTO public.compagnie_snapshot_round2
    SELECT c.*, now()
    FROM public.compagnie c
    WHERE public._norm_compagnia_round2(c.nome) = v_cluster.norm_key
      AND c.id <> v_master_id;

    -- Itera sui duplicati
    FOR v_dup IN
      SELECT id FROM public.compagnie
      WHERE public._norm_compagnia_round2(nome) = v_cluster.norm_key
        AND id <> v_master_id
    LOOP
      -- Remap FK in tutte le tabelle dipendenti
      UPDATE public.titoli SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.sinistri SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.prodotti SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.flussi_compagnia SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.provvigioni_compagnia_ramo SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.rimessa_premi SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.dettaglio_riparto SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.document_folders SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.anagrafiche_professionali SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;
      UPDATE public.trattative SET compagnia_id = v_master_id WHERE compagnia_id = v_dup.id;

      -- Elimina duplicato
      DELETE FROM public.compagnie WHERE id = v_dup.id;
      v_total_merged := v_total_merged + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Round 2 completato: % cluster, % duplicati uniti', v_total_clusters, v_total_merged;
END $$;

DROP FUNCTION public._norm_compagnia_round2(text);
