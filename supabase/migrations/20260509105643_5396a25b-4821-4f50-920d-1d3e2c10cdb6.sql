
-- Cliente: DELETE su documenti caricati da sé
CREATE POLICY "cliente_delete_own_documenti"
ON public.documenti FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND caricato_da_cliente = true
  AND (
    (entita_tipo = 'cliente' AND entita_id IN (SELECT get_my_cliente_ids()))
    OR (entita_tipo = 'titolo' AND entita_id IN (SELECT t.id FROM titoli t WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
    OR (entita_tipo = 'sinistro' AND entita_id IN (SELECT s.id FROM sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
  )
);

-- Storage: documenti_clienti — upload/read/delete per cliente
CREATE POLICY "Cliente upload documenti_clienti"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documenti_clienti' AND has_role(auth.uid(), 'cliente'::app_role));

CREATE POLICY "Cliente read documenti_clienti"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documenti_clienti'
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.documenti d
    WHERE d.bucket_name = 'documenti_clienti'
      AND d.path_storage = objects.name
      AND d.visibile_al_cliente = true
      AND d.entita_tipo = 'cliente'
      AND d.entita_id IN (SELECT get_my_cliente_ids())
  )
);

CREATE POLICY "Cliente delete documenti_clienti"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documenti_clienti'
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.documenti d
    WHERE d.bucket_name = 'documenti_clienti'
      AND d.path_storage = objects.name
      AND d.caricato_da_cliente = true
      AND d.entita_tipo = 'cliente'
      AND d.entita_id IN (SELECT get_my_cliente_ids())
  )
);

CREATE POLICY "Cliente delete documenti_titoli"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documenti_titoli'
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.documenti d
    WHERE d.bucket_name = 'documenti_titoli'
      AND d.path_storage = objects.name
      AND d.caricato_da_cliente = true
      AND d.entita_tipo = 'titolo'
      AND d.entita_id IN (SELECT t.id FROM titoli t WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids()))
  )
);

CREATE POLICY "Cliente delete documenti_sinistri"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documenti_sinistri'
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.documenti d
    WHERE d.bucket_name = 'documenti_sinistri'
      AND d.path_storage = objects.name
      AND d.caricato_da_cliente = true
      AND d.entita_tipo = 'sinistro'
      AND d.entita_id IN (SELECT s.id FROM sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids()))
  )
);
