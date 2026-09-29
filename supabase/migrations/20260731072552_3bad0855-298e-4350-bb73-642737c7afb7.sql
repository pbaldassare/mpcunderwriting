-- 1. Functions: no anonymous execution
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- 2. Views run with the caller's permissions
ALTER VIEW public.v_storico_gare SET (security_invoker = true);
ALTER VIEW public.v_portafoglio_titoli SET (security_invoker = true);

-- 3. libro_matricola_mezzi: staff-only writes
DROP POLICY IF EXISTS "lmm_delete_auth" ON public.libro_matricola_mezzi;
DROP POLICY IF EXISTS "lmm_insert_auth" ON public.libro_matricola_mezzi;
DROP POLICY IF EXISTS "lmm_update_auth" ON public.libro_matricola_mezzi;

CREATE POLICY "Staff manage libro_matricola_mezzi" ON public.libro_matricola_mezzi
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR public.has_role(auth.uid(),'ufficio') OR public.has_role(auth.uid(),'backoffice')
);

-- 5. Storage: public buckets are no longer listable
DROP POLICY IF EXISTS "Authenticated can list avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list branding" ON storage.objects;