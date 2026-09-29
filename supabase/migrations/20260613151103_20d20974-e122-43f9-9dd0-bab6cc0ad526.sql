DROP POLICY IF EXISTS "cliente_select_own_documenti" ON public.documenti;
CREATE POLICY "cliente_select_own_documenti" ON public.documenti
FOR SELECT USING (
  visibile_al_cliente = true AND (
    (entita_tipo = 'cliente'  AND entita_id IN (SELECT get_my_cliente_ids()))
 OR (entita_tipo = 'titolo'   AND entita_id IN (SELECT t.id FROM titoli t   WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
 OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT s.id FROM sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
  )
);