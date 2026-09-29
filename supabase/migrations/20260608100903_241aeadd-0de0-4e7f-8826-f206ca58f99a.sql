
-- 1) Tabella ponte
CREATE TABLE IF NOT EXISTS public.profilo_sedi (
  profilo_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ufficio_id uuid NOT NULL REFERENCES public.uffici(id) ON DELETE CASCADE,
  primaria boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profilo_id, ufficio_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS profilo_sedi_one_primary
  ON public.profilo_sedi (profilo_id) WHERE primaria = true;
CREATE INDEX IF NOT EXISTS profilo_sedi_ufficio_idx ON public.profilo_sedi(ufficio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profilo_sedi TO authenticated;
GRANT ALL ON public.profilo_sedi TO service_role;

ALTER TABLE public.profilo_sedi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profilo_sedi self select" ON public.profilo_sedi FOR SELECT TO authenticated
  USING (profilo_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'cfo'));
CREATE POLICY "profilo_sedi admin manage" ON public.profilo_sedi FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2) Funzione array
CREATE OR REPLACE FUNCTION public.get_my_ufficio_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(ARRAY(SELECT ufficio_id FROM public.profilo_sedi WHERE profilo_id = auth.uid()), '{}'::uuid[]),
    (SELECT ARRAY[ufficio_id] FROM public.profiles WHERE id = auth.uid() AND ufficio_id IS NOT NULL),
    '{}'::uuid[]
  )
$$;

-- 3) Backfill
INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
SELECT p.id, p.ufficio_id, true FROM public.profiles p WHERE p.ufficio_id IS NOT NULL
ON CONFLICT (profilo_id, ufficio_id) DO UPDATE SET primaria = true;

-- 4) Trigger di sync
CREATE OR REPLACE FUNCTION public.sync_profile_ufficio_to_sedi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ufficio_id IS NOT NULL THEN
    UPDATE public.profilo_sedi SET primaria = false WHERE profilo_id = NEW.id;
    INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
    VALUES (NEW.id, NEW.ufficio_id, true)
    ON CONFLICT (profilo_id, ufficio_id) DO UPDATE SET primaria = true;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_profile_ufficio_to_sedi ON public.profiles;
CREATE TRIGGER trg_sync_profile_ufficio_to_sedi
  AFTER INSERT OR UPDATE OF ufficio_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_ufficio_to_sedi();

CREATE OR REPLACE FUNCTION public.sync_sedi_primaria_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.primaria = true THEN
    UPDATE public.profiles SET ufficio_id = NEW.ufficio_id
      WHERE id = NEW.profilo_id AND COALESCE(ufficio_id,'00000000-0000-0000-0000-000000000000') <> NEW.ufficio_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_sedi_primaria_to_profile ON public.profilo_sedi;
CREATE TRIGGER trg_sync_sedi_primaria_to_profile
  AFTER INSERT OR UPDATE OF primaria, ufficio_id ON public.profilo_sedi
  FOR EACH ROW EXECUTE FUNCTION public.sync_sedi_primaria_to_profile();

-- 5) Riscrittura policy: pattern IS NULL prima, poi = scalar()
DO $$
DECLARE
  pol record;
  new_qual text;
  new_chk text;
  sql text;
BEGIN
  FOR pol IN
    SELECT pp.schemaname, pp.tablename, pp.policyname, pp.cmd, pp.permissive, pp.roles,
           pg_get_expr(p.polqual, p.polrelid) AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policies pp
    JOIN pg_class c ON c.relname = pp.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = pp.schemaname
    JOIN pg_policy p ON p.polname = pp.policyname AND p.polrelid = c.oid
    WHERE pp.schemaname = 'public'
      AND (pp.qual ILIKE '%get_my_ufficio_id()%' OR pp.qual ILIKE '%current_ufficio_id()%'
        OR pp.with_check ILIKE '%get_my_ufficio_id()%' OR pp.with_check ILIKE '%current_ufficio_id()%')
  LOOP
    new_qual := pol.qual;
    new_chk := pol.with_check;

    -- IS NULL → utente senza sedi
    FOR i IN 1..2 LOOP NULL; END LOOP; -- placeholder

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'get_my_ufficio_id() IS NULL', 'cardinality(get_my_ufficio_ids()) = 0');
      new_qual := replace(new_qual, 'current_ufficio_id() IS NULL', 'cardinality(get_my_ufficio_ids()) = 0');
      new_qual := replace(new_qual, 'get_my_ufficio_id() IS NOT NULL', 'cardinality(get_my_ufficio_ids()) > 0');
      new_qual := replace(new_qual, 'current_ufficio_id() IS NOT NULL', 'cardinality(get_my_ufficio_ids()) > 0');
      new_qual := replace(new_qual, 'get_my_ufficio_id()', 'ANY(get_my_ufficio_ids())');
      new_qual := replace(new_qual, 'current_ufficio_id()', 'ANY(get_my_ufficio_ids())');
    END IF;
    IF new_chk IS NOT NULL THEN
      new_chk := replace(new_chk, 'get_my_ufficio_id() IS NULL', 'cardinality(get_my_ufficio_ids()) = 0');
      new_chk := replace(new_chk, 'current_ufficio_id() IS NULL', 'cardinality(get_my_ufficio_ids()) = 0');
      new_chk := replace(new_chk, 'get_my_ufficio_id() IS NOT NULL', 'cardinality(get_my_ufficio_ids()) > 0');
      new_chk := replace(new_chk, 'current_ufficio_id() IS NOT NULL', 'cardinality(get_my_ufficio_ids()) > 0');
      new_chk := replace(new_chk, 'get_my_ufficio_id()', 'ANY(get_my_ufficio_ids())');
      new_chk := replace(new_chk, 'current_ufficio_id()', 'ANY(get_my_ufficio_ids())');
    END IF;

    IF (new_qual IS DISTINCT FROM pol.qual) OR (new_chk IS DISTINCT FROM pol.with_check) THEN
      EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
        pol.policyname, pol.schemaname, pol.tablename,
        CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        pol.cmd,
        array_to_string(pol.roles, ', '));
      IF new_qual IS NOT NULL THEN sql := sql || ' USING (' || new_qual || ')'; END IF;
      IF new_chk IS NOT NULL THEN sql := sql || ' WITH CHECK (' || new_chk || ')'; END IF;
      EXECUTE sql;
    END IF;
  END LOOP;
END $$;
