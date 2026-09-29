
-- 1) Anti-escalation trigger on profiles
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.ruolo IS DISTINCT FROM OLD.ruolo THEN
    NEW.ruolo := OLD.ruolo;
  END IF;
  IF NEW.ufficio_id IS DISTINCT FROM OLD.ufficio_id THEN
    NEW.ufficio_id := OLD.ufficio_id;
  END IF;
  IF NEW.permessi_json IS DISTINCT FROM OLD.permessi_json THEN
    NEW.permessi_json := OLD.permessi_json;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_privilege_escalation();

-- 2) Restrict chat-participants SELECT to staff
DROP POLICY IF EXISTS "Chat participants visible to each other" ON public.profiles;
CREATE POLICY "Chat participants visible to each other (staff only)"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ufficio'::app_role)
    OR public.has_role(auth.uid(), 'cfo'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.chat_canali_membri m1
    JOIN public.chat_canali_membri m2 ON m2.canale_id = m1.canale_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
  )
);

-- 3) codici_commerciali_cliente: staff-only SELECT
DROP POLICY IF EXISTS "Authenticated can read codici_commerciali" ON public.codici_commerciali_cliente;
CREATE POLICY "Staff can read codici_commerciali"
ON public.codici_commerciali_cliente
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);

-- 4) Missing SELECT policies
CREATE POLICY "Staff read distinte_giornaliere"
ON public.distinte_giornaliere FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

CREATE POLICY "Staff read distinte_giornaliere_righe"
ON public.distinte_giornaliere_righe FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

CREATE POLICY "Staff read chiusure_contabili"
ON public.chiusure_contabili FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'contabilita'::app_role)
);

CREATE POLICY "Staff read clienti_relazioni"
ON public.clienti_relazioni FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);

CREATE POLICY "Staff read nominativi_cliente"
ON public.nominativi_cliente FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cfo'::app_role)
  OR public.has_role(auth.uid(), 'ufficio'::app_role)
  OR public.has_role(auth.uid(), 'backoffice'::app_role)
);

-- 5) Storage upload path ownership for cliente role
DROP POLICY IF EXISTS "Cliente upload documenti_clienti" ON storage.objects;
CREATE POLICY "Cliente upload documenti_clienti"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documenti_clienti'
  AND public.has_role(auth.uid(), 'cliente'::app_role)
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_my_cliente_ids())
);

DROP POLICY IF EXISTS "Cliente upload documenti_titoli" ON storage.objects;
CREATE POLICY "Cliente upload documenti_titoli"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documenti_titoli'
  AND public.has_role(auth.uid(), 'cliente'::app_role)
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_my_cliente_ids())
);

DROP POLICY IF EXISTS "Cliente upload documenti_sinistri" ON storage.objects;
CREATE POLICY "Cliente upload documenti_sinistri"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documenti_sinistri'
  AND public.has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.sinistri s
    WHERE s.id = ((storage.foldername(name))[1])::uuid
      AND s.cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids())
  )
);
