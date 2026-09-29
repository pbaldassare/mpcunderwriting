
-- documenti: client can see visible documents linked to their entities
CREATE POLICY "cliente_select_own_documenti" ON public.documenti
FOR SELECT TO authenticated
USING (
  visibile_al_cliente = true
  AND (
    (entita_tipo = 'cliente' AND entita_id::uuid IN (SELECT public.get_my_cliente_ids()))
    OR (entita_tipo = 'titolo' AND entita_id::uuid IN (
      SELECT t.id FROM titoli t WHERE t.cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids())
    ))
  )
);

-- notifiche: client can see and update their own notifications
CREATE POLICY "cliente_select_own_notifiche" ON public.notifiche
FOR SELECT TO authenticated
USING (destinatario_id = auth.uid());

CREATE POLICY "cliente_update_own_notifiche" ON public.notifiche
FOR UPDATE TO authenticated
USING (destinatario_id = auth.uid())
WITH CHECK (destinatario_id = auth.uid());

-- documenti: client can insert documents (upload)
CREATE POLICY "cliente_insert_documenti" ON public.documenti
FOR INSERT TO authenticated
WITH CHECK (
  entita_tipo = 'cliente'
  AND entita_id::uuid IN (SELECT public.get_my_cliente_ids())
);
