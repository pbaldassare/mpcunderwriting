-- 1. Replacement scoped policies for tables that would lose write coverage
CREATE POLICY "Staff manage cliente_anticipi" ON public.cliente_anticipi
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'contabilita')
  OR public.has_role(auth.uid(),'backoffice')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'contabilita')
  OR public.has_role(auth.uid(),'backoffice')
);

CREATE POLICY "Staff manage giroconti_cliente" ON public.giroconti_cliente
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'contabilita')
  OR public.has_role(auth.uid(),'backoffice')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'contabilita')
  OR public.has_role(auth.uid(),'backoffice')
);

-- 2. Drop every blanket "authenticated = full access" policy
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public' AND cmd='ALL' AND qual='(auth.uid() IS NOT NULL)'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 3. Snapshot table: enable RLS, admin only
ALTER TABLE public._snapshot_campobasso_titoli ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._snapshot_campobasso_titoli FROM anon;
GRANT SELECT ON public._snapshot_campobasso_titoli TO authenticated;
GRANT ALL ON public._snapshot_campobasso_titoli TO service_role;
CREATE POLICY "Admins read snapshot campobasso" ON public._snapshot_campobasso_titoli
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- 4. titoli_modalita_incasso: remove open policy, scope to staff
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='titoli_modalita_incasso'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.titoli_modalita_incasso', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Staff read titoli_modalita_incasso" ON public.titoli_modalita_incasso
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'contabilita')
  OR public.has_role(auth.uid(),'backoffice')
);

CREATE POLICY "Accounting manage titoli_modalita_incasso" ON public.titoli_modalita_incasso
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'contabilita')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'contabilita')
);

-- 5. bandi_pubblici: remove open write/read
DROP POLICY IF EXISTS "Authenticated users can insert bandi" ON public.bandi_pubblici;
DROP POLICY IF EXISTS "Authenticated users can update bandi" ON public.bandi_pubblici;
DROP POLICY IF EXISTS "Authenticated users can read bandi" ON public.bandi_pubblici;

CREATE POLICY "Staff read bandi_pubblici" ON public.bandi_pubblici
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
  OR public.has_role(auth.uid(),'produttore')
);

CREATE POLICY "Staff insert bandi_pubblici" ON public.bandi_pubblici
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
);

CREATE POLICY "Staff update bandi_pubblici" ON public.bandi_pubblici
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
);

-- 6. Fix mutable search_path on remaining functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

-- 7. Revoke function execution from anonymous callers
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- 8. Materialized view not exposed to the Data API
REVOKE ALL ON public.cfo_kpi_mensili FROM anon, authenticated;

-- 9. Storage: public buckets no longer listable by anonymous clients
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view branding files" ON storage.objects;

CREATE POLICY "Authenticated can list avatars" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated can list branding" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'branding');