-- 1. Add new column
ALTER TABLE public.provvigioni_compagnia_ramo
  ADD COLUMN IF NOT EXISTS compagnia_rapporto_id uuid REFERENCES public.compagnia_rapporti(id) ON DELETE CASCADE;

-- 2. Allow compagnia_id to be nullable (it will be auto-filled by trigger)
ALTER TABLE public.provvigioni_compagnia_ramo
  ALTER COLUMN compagnia_id DROP NOT NULL;

-- 3. Drop old unique constraint on (compagnia_id, categoria_id) if it exists
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.provvigioni_compagnia_ramo'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.provvigioni_compagnia_ramo DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

DROP INDEX IF EXISTS public.provvigioni_compagnia_ramo_compagnia_id_categoria_id_idx;
DROP INDEX IF EXISTS public.uniq_provvigione_compagnia_categoria;

-- 4. Unique partial index on (compagnia_rapporto_id, categoria_id) when active
CREATE UNIQUE INDEX IF NOT EXISTS uniq_provvigione_rapporto_categoria
  ON public.provvigioni_compagnia_ramo (compagnia_rapporto_id, categoria_id)
  WHERE attiva = true;

CREATE INDEX IF NOT EXISTS idx_provv_compagnia_rapporto_id
  ON public.provvigioni_compagnia_ramo (compagnia_rapporto_id);

-- 5. Trigger to auto-fill compagnia_id from rapporto
CREATE OR REPLACE FUNCTION public.sync_provvigione_compagnia_from_rapporto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.compagnia_rapporto_id IS NOT NULL THEN
    SELECT compagnia_id INTO NEW.compagnia_id
    FROM public.compagnia_rapporti
    WHERE id = NEW.compagnia_rapporto_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_provvigione_compagnia ON public.provvigioni_compagnia_ramo;
CREATE TRIGGER trg_sync_provvigione_compagnia
  BEFORE INSERT OR UPDATE OF compagnia_rapporto_id
  ON public.provvigioni_compagnia_ramo
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_provvigione_compagnia_from_rapporto();

-- 6. RPC: ensure a default rapporto exists for agenzia/direzione (single-rapporto types)
CREATE OR REPLACE FUNCTION public.ensure_default_rapporto(_compagnia_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_gruppo uuid;
  v_rapporto_id uuid;
  v_count int;
BEGIN
  SELECT tipo, gruppo_compagnia_id INTO v_tipo, v_gruppo
  FROM public.compagnie WHERE id = _compagnia_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Compagnia % non trovata', _compagnia_id;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.compagnia_rapporti
  WHERE compagnia_id = _compagnia_id AND attivo = true;

  IF v_tipo IN ('agenzia','direzione') THEN
    IF v_count = 0 THEN
      IF v_gruppo IS NULL THEN
        RAISE EXCEPTION 'Compagnia % senza gruppo_compagnia_id: impossibile creare rapporto di default', _compagnia_id;
      END IF;
      INSERT INTO public.compagnia_rapporti
        (compagnia_id, gruppo_compagnia_id, codice_rapporto, nome_rapporto, attivo)
      VALUES (_compagnia_id, v_gruppo, 'DEFAULT', 'Rapporto unico', true)
      RETURNING id INTO v_rapporto_id;
      RETURN v_rapporto_id;
    ELSIF v_count = 1 THEN
      SELECT id INTO v_rapporto_id
      FROM public.compagnia_rapporti
      WHERE compagnia_id = _compagnia_id AND attivo = true
      LIMIT 1;
      RETURN v_rapporto_id;
    ELSE
      RAISE EXCEPTION 'Compagnia % di tipo % ha % rapporti attivi: ambiguo', _compagnia_id, v_tipo, v_count;
    END IF;
  ELSE
    -- broker / plurimandataria: il rapporto va scelto esplicitamente
    RAISE EXCEPTION 'Agenzia % è di tipo % : il rapporto deve essere scelto esplicitamente', _compagnia_id, v_tipo;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_rapporto(uuid) TO authenticated;