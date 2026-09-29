-- Staff access ai bucket documenti_titoli e documenti_clienti (stesso pattern di documenti_sinistri)
CREATE POLICY "Staff read documenti_titoli" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documenti_titoli'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role) OR has_role(auth.uid(), 'produttore'::app_role)
      OR has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

CREATE POLICY "Staff write documenti_titoli" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documenti_titoli'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role) OR has_role(auth.uid(), 'produttore'::app_role)
      OR has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

CREATE POLICY "Staff delete documenti_titoli" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documenti_titoli'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role)
    )
  );

CREATE POLICY "Staff read documenti_clienti" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documenti_clienti'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role) OR has_role(auth.uid(), 'produttore'::app_role)
      OR has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

CREATE POLICY "Staff write documenti_clienti" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documenti_clienti'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role) OR has_role(auth.uid(), 'produttore'::app_role)
      OR has_role(auth.uid(), 'corrispondente'::app_role)
    )
  );

CREATE POLICY "Staff delete documenti_clienti" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documenti_clienti'
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ufficio'::app_role)
      OR has_role(auth.uid(), 'backoffice'::app_role) OR has_role(auth.uid(), 'contabilita'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role)
    )
  );