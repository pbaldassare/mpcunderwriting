
-- 1) Funzioni helper SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.current_ufficio_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_global_viewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','cfo')
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_ufficio_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_viewer() TO authenticated;

-- 2) Aggiorna email uffici
UPDATE public.uffici SET email = 'catania@consulbrokers.it'      WHERE id = 'd2c47452-4bb2-4b3b-8a24-a1606357e909';
UPDATE public.uffici SET email = 'milano@consulbrokers.it'       WHERE id = '193e0821-4105-4ad6-a72e-0ebb6c116797';
UPDATE public.uffici SET email = 'sandona@consulbrokers.it'      WHERE id = '327e92f7-64f0-48b9-9e48-73611d8cb406';
UPDATE public.uffici SET email = 'campobasso@consulbrokers.it'   WHERE id = 'ebd881c6-cc52-4fbe-a423-2bf1f8498e5c';
UPDATE public.uffici SET email = 'segreteria@consulbrokers.it'   WHERE id = 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a';

-- 3) Policy additive di scoping per ufficio su titoli/clienti/sinistri/movimenti_contabili
-- (mantiene policy esistenti; aggiunge accesso per ruolo 'ufficio' limitato al proprio ufficio_id)

DROP POLICY IF EXISTS sede_scope_titoli ON public.titoli;
CREATE POLICY sede_scope_titoli ON public.titoli
  FOR ALL TO authenticated
  USING (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id())
  WITH CHECK (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id());

DROP POLICY IF EXISTS sede_scope_clienti ON public.clienti;
CREATE POLICY sede_scope_clienti ON public.clienti
  FOR ALL TO authenticated
  USING (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id())
  WITH CHECK (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id());

DROP POLICY IF EXISTS sede_scope_sinistri ON public.sinistri;
CREATE POLICY sede_scope_sinistri ON public.sinistri
  FOR ALL TO authenticated
  USING (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id())
  WITH CHECK (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id());

DROP POLICY IF EXISTS sede_scope_movimenti_contabili ON public.movimenti_contabili;
CREATE POLICY sede_scope_movimenti_contabili ON public.movimenti_contabili
  FOR ALL TO authenticated
  USING (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id())
  WITH CHECK (public.is_global_viewer() OR ufficio_id = public.current_ufficio_id());
