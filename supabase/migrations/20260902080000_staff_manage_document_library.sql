-- Archivio Documentale: sede/ufficio (e staff operativo) possono creare cartelle,
-- caricare e cancellare come gli admin. La consultazione anon resta in sola lettura.

CREATE OR REPLACE FUNCTION public.is_documentale_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'ufficio', 'backoffice', 'contabilita', 'cfo')
  );
$$;

DROP POLICY IF EXISTS "Admins can manage documents" ON public.document_library;
DROP POLICY IF EXISTS "Staff can manage documents" ON public.document_library;
CREATE POLICY "Staff can manage documents"
  ON public.document_library FOR ALL TO authenticated
  USING (public.is_documentale_staff())
  WITH CHECK (public.is_documentale_staff());

DROP POLICY IF EXISTS "Admins can manage folders" ON public.document_folders;
DROP POLICY IF EXISTS "Staff can manage folders" ON public.document_folders;
CREATE POLICY "Staff can manage folders"
  ON public.document_folders FOR ALL TO authenticated
  USING (public.is_documentale_staff())
  WITH CHECK (public.is_documentale_staff());

DROP POLICY IF EXISTS "Admins can upload to document-library" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload to document-library" ON storage.objects;
CREATE POLICY "Staff can upload to document-library"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-library'
    AND public.is_documentale_staff()
  );

DROP POLICY IF EXISTS "Admins can update document-library" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update document-library" ON storage.objects;
CREATE POLICY "Staff can update document-library"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-library'
    AND public.is_documentale_staff()
  )
  WITH CHECK (
    bucket_id = 'document-library'
    AND public.is_documentale_staff()
  );

DROP POLICY IF EXISTS "Admins can delete from document-library" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete from document-library" ON storage.objects;
CREATE POLICY "Staff can delete from document-library"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-library'
    AND public.is_documentale_staff()
  );
