
-- 1. Drop overly permissive "Authenticated true" policies (scoped Ufficio policies already exist)
DROP POLICY IF EXISTS "Authenticated full access" ON public.appendici_polizza;
DROP POLICY IF EXISTS "Authenticated users can manage chiusure" ON public.chiusure_contabili;
DROP POLICY IF EXISTS "Authenticated users can view clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Authenticated users can insert clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Authenticated users can update clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Authenticated users can delete clienti_relazioni" ON public.clienti_relazioni;
DROP POLICY IF EXISTS "Authenticated users can read dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can insert dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can update dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can delete dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can manage distinte" ON public.distinte_giornaliere;
DROP POLICY IF EXISTS "Authenticated users can manage distinte righe" ON public.distinte_giornaliere_righe;
DROP POLICY IF EXISTS "Authenticated users can manage documenti_utenti" ON public.documenti_utenti;
DROP POLICY IF EXISTS "Authenticated users can manage nominativi" ON public.nominativi_cliente;
DROP POLICY IF EXISTS "Authenticated can read trattativa_documenti" ON public.trattativa_documenti;
DROP POLICY IF EXISTS "Authenticated can insert trattativa_documenti" ON public.trattativa_documenti;
DROP POLICY IF EXISTS "Authenticated can update trattativa_documenti" ON public.trattativa_documenti;
DROP POLICY IF EXISTS "Authenticated can delete trattativa_documenti" ON public.trattativa_documenti;
DROP POLICY IF EXISTS "Authenticated can read trattativa_eventi" ON public.trattativa_eventi;
DROP POLICY IF EXISTS "Authenticated can insert trattativa_eventi" ON public.trattativa_eventi;
DROP POLICY IF EXISTS "Authenticated can update trattativa_eventi" ON public.trattativa_eventi;
DROP POLICY IF EXISTS "Authenticated can delete trattativa_eventi" ON public.trattativa_eventi;
DROP POLICY IF EXISTS "Authenticated can read trattativa_scadenze" ON public.trattativa_scadenze;
DROP POLICY IF EXISTS "Authenticated can insert trattativa_scadenze" ON public.trattativa_scadenze;
DROP POLICY IF EXISTS "Authenticated can update trattativa_scadenze" ON public.trattativa_scadenze;
DROP POLICY IF EXISTS "Authenticated can delete trattativa_scadenze" ON public.trattativa_scadenze;

-- 2. provvigioni_compagnia_ramo: replace 'true' policies with admin/ufficio scoped + authenticated read
DROP POLICY IF EXISTS "Authenticated users can read provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo;
DROP POLICY IF EXISTS "Authenticated users can insert provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo;
DROP POLICY IF EXISTS "Authenticated users can update provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo;
DROP POLICY IF EXISTS "Authenticated users can delete provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo;
CREATE POLICY "Staff can read provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ufficio'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  );
CREATE POLICY "Admin/Ufficio insert provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "Admin/Ufficio update provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role));
CREATE POLICY "Admin/Ufficio delete provvigioni_compagnia_ramo" ON public.provvigioni_compagnia_ramo
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role));

-- 3. conti_bancari: drop broad SELECT, add restricted SELECT
DROP POLICY IF EXISTS "Authenticated read conti_bancari" ON public.conti_bancari;
CREATE POLICY "Staff read conti_bancari" ON public.conti_bancari
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ufficio'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
  );

-- 4. compagnia_rapporti: tighten broad SELECT
DROP POLICY IF EXISTS "Authenticated can view rapporti" ON public.compagnia_rapporti;
CREATE POLICY "Staff view compagnia_rapporti" ON public.compagnia_rapporti
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ufficio'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  );

-- 5. titoli_split_commerciali: tighten policies to verify access to underlying titolo
DROP POLICY IF EXISTS split_select_via_titolo ON public.titoli_split_commerciali;
DROP POLICY IF EXISTS split_insert_via_titolo ON public.titoli_split_commerciali;
DROP POLICY IF EXISTS split_update_via_titolo ON public.titoli_split_commerciali;
DROP POLICY IF EXISTS split_delete_via_titolo ON public.titoli_split_commerciali;
CREATE POLICY split_select_via_titolo ON public.titoli_split_commerciali
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'contabilita'::app_role)
    OR (has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.titoli t WHERE t.id = titoli_split_commerciali.titolo_id
        AND (t.ufficio_id = get_my_ufficio_id() OR get_my_ufficio_id() IS NULL)
    ))
  );
CREATE POLICY split_insert_via_titolo ON public.titoli_split_commerciali
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.titoli t WHERE t.id = titoli_split_commerciali.titolo_id
        AND (t.ufficio_id = get_my_ufficio_id() OR get_my_ufficio_id() IS NULL)
    ))
  );
CREATE POLICY split_update_via_titolo ON public.titoli_split_commerciali
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.titoli t WHERE t.id = titoli_split_commerciali.titolo_id
        AND (t.ufficio_id = get_my_ufficio_id() OR get_my_ufficio_id() IS NULL)
    ))
  );
CREATE POLICY split_delete_via_titolo ON public.titoli_split_commerciali
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'ufficio'::app_role) AND EXISTS (
      SELECT 1 FROM public.titoli t WHERE t.id = titoli_split_commerciali.titolo_id
        AND (t.ufficio_id = get_my_ufficio_id() OR get_my_ufficio_id() IS NULL)
    ))
  );

-- 6. Profiles: prevent privilege escalation via self-update
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.ruolo IS DISTINCT FROM OLD.ruolo
       OR NEW.ufficio_id IS DISTINCT FROM OLD.ufficio_id
       OR NEW.permessi_json IS DISTINCT FROM OLD.permessi_json THEN
      RAISE EXCEPTION 'Non puoi modificare ruolo, ufficio o permessi del tuo profilo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 7. Storage: drop overly broad authenticated policies
DROP POLICY IF EXISTS "Authenticated select own" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;

-- 8. Storage documenti_utenti: enforce path-based ownership (first folder = auth.uid())
DROP POLICY IF EXISTS "Auth users can read documenti_utenti" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload to documenti_utenti" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete from documenti_utenti" ON storage.objects;
CREATE POLICY "Users can read own documenti_utenti" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documenti_utenti'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY "Users can upload own documenti_utenti" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documenti_utenti'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can delete own documenti_utenti" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documenti_utenti'
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );

-- 9. documenti_utenti: scope by user_id for non-admin/non-ufficio users
CREATE POLICY "Users manage own documenti_utenti" ON public.documenti_utenti
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
