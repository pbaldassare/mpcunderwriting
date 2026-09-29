
-- 1) Tabella split commerciali
CREATE TABLE public.titoli_split_commerciali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  anagrafica_commerciale_id uuid NOT NULL REFERENCES public.anagrafiche_professionali(id) ON DELETE RESTRICT,
  commerciale_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  percentuale numeric(5,2) NOT NULL CHECK (percentuale > 0 AND percentuale <= 100),
  ordine int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (titolo_id, anagrafica_commerciale_id)
);

CREATE INDEX idx_tsc_titolo ON public.titoli_split_commerciali(titolo_id);
CREATE INDEX idx_tsc_anagrafica ON public.titoli_split_commerciali(anagrafica_commerciale_id);

-- 2) Trigger: somma % per titolo <= 100
CREATE OR REPLACE FUNCTION public.validate_titoli_split_sum()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_titolo_id uuid;
  v_sum numeric;
BEGIN
  v_titolo_id := COALESCE(NEW.titolo_id, OLD.titolo_id);
  SELECT COALESCE(SUM(percentuale), 0) INTO v_sum
    FROM public.titoli_split_commerciali
   WHERE titolo_id = v_titolo_id
     AND (TG_OP <> 'UPDATE' OR id <> NEW.id);
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_sum := v_sum + COALESCE(NEW.percentuale, 0);
  END IF;
  IF v_sum > 100.001 THEN
    RAISE EXCEPTION 'Somma percentuali split commerciali per titolo % è %, supera 100', v_titolo_id, v_sum;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_titoli_split_sum
BEFORE INSERT OR UPDATE OR DELETE ON public.titoli_split_commerciali
FOR EACH ROW EXECUTE FUNCTION public.validate_titoli_split_sum();

-- 3) updated_at + audit user
CREATE OR REPLACE FUNCTION public.titoli_split_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_titoli_split_audit
BEFORE INSERT OR UPDATE ON public.titoli_split_commerciali
FOR EACH ROW EXECUTE FUNCTION public.titoli_split_set_audit();

-- 4) RLS
ALTER TABLE public.titoli_split_commerciali ENABLE ROW LEVEL SECURITY;

CREATE POLICY "split_select_via_titolo"
ON public.titoli_split_commerciali FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id));

CREATE POLICY "split_insert_via_titolo"
ON public.titoli_split_commerciali FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id));

CREATE POLICY "split_update_via_titolo"
ON public.titoli_split_commerciali FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id));

CREATE POLICY "split_delete_via_titolo"
ON public.titoli_split_commerciali FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = titolo_id));

-- 5) Migrazione dati: copia singolo commerciale → riga split
INSERT INTO public.titoli_split_commerciali
  (titolo_id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine)
SELECT
  t.id,
  t.anagrafica_commerciale_id,
  t.commerciale_id,
  COALESCE(t.percentuale_commerciale, 100),
  0
FROM public.titoli t
WHERE t.anagrafica_commerciale_id IS NOT NULL
  AND COALESCE(t.percentuale_commerciale, 100) > 0
  AND COALESCE(t.percentuale_commerciale, 100) <= 100
ON CONFLICT (titolo_id, anagrafica_commerciale_id) DO NOTHING;
