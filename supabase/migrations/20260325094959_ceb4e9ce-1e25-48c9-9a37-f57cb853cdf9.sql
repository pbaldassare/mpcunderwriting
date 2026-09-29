
-- Drop old conflicting RLS policies that use auth.uid() directly for clients
DROP POLICY IF EXISTS "Cliente select own documenti" ON public.documenti;
DROP POLICY IF EXISTS "Cliente select own titoli" ON public.titoli;

-- cliente_insert_documenti needs fix: add proper check
DROP POLICY IF EXISTS "cliente_insert_documenti" ON public.documenti;
CREATE POLICY "cliente_insert_documenti" ON public.documenti
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND entita_tipo = 'cliente'
  AND entita_id IN (SELECT get_my_cliente_ids())
);
