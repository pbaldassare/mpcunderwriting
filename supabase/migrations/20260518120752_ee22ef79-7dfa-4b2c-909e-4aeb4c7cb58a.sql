-- Tabella ponte: rami/sottorami abilitati per ogni rapporto compagnia
CREATE TABLE IF NOT EXISTS public.compagnia_rapporto_rami (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapporto_id uuid NOT NULL REFERENCES public.compagnia_rapporti(id) ON DELETE CASCADE,
  gruppo_ramo_id uuid NOT NULL REFERENCES public.gruppi_ramo(id) ON DELETE RESTRICT,
  ramo_id uuid REFERENCES public.rami(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS compagnia_rapporto_rami_unique
  ON public.compagnia_rapporto_rami (rapporto_id, gruppo_ramo_id, COALESCE(ramo_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS compagnia_rapporto_rami_rapporto_idx
  ON public.compagnia_rapporto_rami (rapporto_id);

-- Trigger di coerenza: se ramo_id valorizzato, deve appartenere al gruppo_ramo_id
CREATE OR REPLACE FUNCTION public.validate_compagnia_rapporto_rami()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_gruppo uuid;
BEGIN
  IF NEW.ramo_id IS NOT NULL THEN
    SELECT gruppo_ramo_id INTO v_gruppo FROM public.rami WHERE id = NEW.ramo_id;
    IF v_gruppo IS NULL OR v_gruppo <> NEW.gruppo_ramo_id THEN
      RAISE EXCEPTION 'Il sottoramo selezionato non appartiene al gruppo ramo indicato';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_compagnia_rapporto_rami ON public.compagnia_rapporto_rami;
CREATE TRIGGER trg_validate_compagnia_rapporto_rami
BEFORE INSERT OR UPDATE ON public.compagnia_rapporto_rami
FOR EACH ROW EXECUTE FUNCTION public.validate_compagnia_rapporto_rami();

-- RLS allineato a compagnia_rapporti (lettura authenticated, scrittura admin/responsabile_sede)
ALTER TABLE public.compagnia_rapporto_rami ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compagnia_rapporto_rami_select" ON public.compagnia_rapporto_rami;
CREATE POLICY "compagnia_rapporto_rami_select" ON public.compagnia_rapporto_rami
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "compagnia_rapporto_rami_write" ON public.compagnia_rapporto_rami;
CREATE POLICY "compagnia_rapporto_rami_write" ON public.compagnia_rapporto_rami
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede','Executive')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede','Executive')));