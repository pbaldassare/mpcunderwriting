
-- Add new columns to trattative
ALTER TABLE public.trattative 
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clienti(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ramo_id uuid REFERENCES public.rami(id),
  ADD COLUMN IF NOT EXISTS compagnia_id uuid REFERENCES public.compagnie(id),
  ADD COLUMN IF NOT EXISTS note text;

-- Add CHECK: at least one of prospect_id or cliente_id must be set
ALTER TABLE public.trattative
  ADD CONSTRAINT trattative_soggetto_check 
  CHECK (prospect_id IS NOT NULL OR cliente_id IS NOT NULL);

-- Update RLS policies to also allow access via cliente_id
-- Drop old restrictive policies and recreate them

DROP POLICY IF EXISTS "Produttore select own trattative" ON public.trattative;
DROP POLICY IF EXISTS "Produttore insert own trattative" ON public.trattative;
DROP POLICY IF EXISTS "Produttore update own trattative" ON public.trattative;
DROP POLICY IF EXISTS "Ufficio select own trattative" ON public.trattative;
DROP POLICY IF EXISTS "Ufficio insert own trattative" ON public.trattative;
DROP POLICY IF EXISTS "Ufficio update own trattative" ON public.trattative;

-- Produttore: can access trattative linked to their prospects OR their office clients
CREATE POLICY "Produttore select own trattative" ON public.trattative
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'produttore'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE assegnato_a = auth.uid())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );

CREATE POLICY "Produttore insert own trattative" ON public.trattative
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'produttore'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE assegnato_a = auth.uid())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );

CREATE POLICY "Produttore update own trattative" ON public.trattative
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'produttore'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE assegnato_a = auth.uid())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );

-- Ufficio: can access trattative linked to their office prospects OR office clients
CREATE POLICY "Ufficio select own trattative" ON public.trattative
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ufficio'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE ufficio_id = get_my_ufficio_id())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );

CREATE POLICY "Ufficio insert own trattative" ON public.trattative
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'ufficio'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE ufficio_id = get_my_ufficio_id())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );

CREATE POLICY "Ufficio update own trattative" ON public.trattative
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'ufficio'::app_role) AND (
      prospect_id IN (SELECT id FROM prospect WHERE ufficio_id = get_my_ufficio_id())
      OR cliente_id IN (SELECT id FROM clienti WHERE ufficio_id = get_my_ufficio_id())
    )
  );
