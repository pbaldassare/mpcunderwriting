
-- ============================================================
-- Security hardening: restrict overly permissive RLS policies
-- ============================================================

-- compagnia_rapporto_documenti: only ufficio/admin
DROP POLICY IF EXISTS "Authenticated read rapporto documenti" ON public.compagnia_rapporto_documenti;
DROP POLICY IF EXISTS "Authenticated insert rapporto documenti" ON public.compagnia_rapporto_documenti;
DROP POLICY IF EXISTS "Authenticated update rapporto documenti" ON public.compagnia_rapporto_documenti;
DROP POLICY IF EXISTS "Authenticated delete rapporto documenti" ON public.compagnia_rapporto_documenti;

CREATE POLICY "Ufficio admin read rapporto documenti" ON public.compagnia_rapporto_documenti
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Ufficio admin insert rapporto documenti" ON public.compagnia_rapporto_documenti
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Ufficio admin update rapporto documenti" ON public.compagnia_rapporto_documenti
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Ufficio admin delete rapporto documenti" ON public.compagnia_rapporto_documenti
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- provvigioni_default_tipo: read open to authenticated, write only admin/ufficio
DROP POLICY IF EXISTS "Authenticated write provvigioni_default_tipo" ON public.provvigioni_default_tipo;
CREATE POLICY "Ufficio admin write provvigioni_default_tipo" ON public.provvigioni_default_tipo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- bandi_trattative: drop always-true insert/delete/read (ufficio policies remain)
DROP POLICY IF EXISTS "Authenticated users can delete bandi_trattative" ON public.bandi_trattative;
DROP POLICY IF EXISTS "Authenticated users can insert bandi_trattative" ON public.bandi_trattative;
DROP POLICY IF EXISTS "Authenticated users can read bandi_trattative" ON public.bandi_trattative;
CREATE POLICY "Ufficio admin read bandi_trattative" ON public.bandi_trattative
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- ricerche_bandi: scope read to owner / ufficio / admin
DROP POLICY IF EXISTS "Authenticated users can read ricerche_bandi" ON public.ricerche_bandi;
DROP POLICY IF EXISTS "Authenticated users can insert ricerche_bandi" ON public.ricerche_bandi;
CREATE POLICY "Read own or staff ricerche_bandi" ON public.ricerche_bandi
  FOR SELECT TO authenticated
  USING (
    eseguita_da = auth.uid()
    OR has_role(auth.uid(),'ufficio'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
  );
CREATE POLICY "Insert own ricerche_bandi" ON public.ricerche_bandi
  FOR INSERT TO authenticated
  WITH CHECK (eseguita_da = auth.uid());

-- titoli_numeri_storici: scope read to titolo owners/staff, restrict insert to staff
DROP POLICY IF EXISTS "auth insert numeri storici" ON public.titoli_numeri_storici;
DROP POLICY IF EXISTS "auth read numeri storici" ON public.titoli_numeri_storici;

CREATE POLICY "Staff insert numeri storici" ON public.titoli_numeri_storici
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'ufficio'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "Scoped read numeri storici" ON public.titoli_numeri_storici
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'cfo'::app_role)
    OR has_role(auth.uid(),'ufficio'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = titoli_numeri_storici.titolo_id
        AND (
          t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
          OR (has_role(auth.uid(),'produttore'::app_role) AND t.produttore_id = auth.uid())
        )
    )
  );

-- Helper macro: per-titolo scope expressed inline below for titoli_regolazioni/sostituzioni/storni

-- titoli_regolazioni
DROP POLICY IF EXISTS "Authenticated users can view regolazioni" ON public.titoli_regolazioni;
DROP POLICY IF EXISTS "Authenticated users can update regolazioni" ON public.titoli_regolazioni;
DROP POLICY IF EXISTS "Authenticated users can insert regolazioni" ON public.titoli_regolazioni;

CREATE POLICY "Scoped read regolazioni" ON public.titoli_regolazioni
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'cfo'::app_role)
    OR has_role(auth.uid(),'ufficio'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = titoli_regolazioni.titolo_madre_id
        AND (
          t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
          OR (has_role(auth.uid(),'produttore'::app_role) AND t.produttore_id = auth.uid())
        )
    )
  );

CREATE POLICY "Staff insert regolazioni" ON public.titoli_regolazioni
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Staff update regolazioni" ON public.titoli_regolazioni
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- titoli_sostituzioni
DROP POLICY IF EXISTS "Authenticated users can view sostituzioni" ON public.titoli_sostituzioni;
DROP POLICY IF EXISTS "Authenticated users can update sostituzioni" ON public.titoli_sostituzioni;
DROP POLICY IF EXISTS "Authenticated users can insert sostituzioni" ON public.titoli_sostituzioni;

CREATE POLICY "Scoped read sostituzioni" ON public.titoli_sostituzioni
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'cfo'::app_role)
    OR has_role(auth.uid(),'ufficio'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = titoli_sostituzioni.titolo_id
        AND (
          t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
          OR (has_role(auth.uid(),'produttore'::app_role) AND t.produttore_id = auth.uid())
        )
    )
  );

CREATE POLICY "Staff insert sostituzioni" ON public.titoli_sostituzioni
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Staff update sostituzioni" ON public.titoli_sostituzioni
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- titoli_storni
DROP POLICY IF EXISTS "Authenticated users can view storni" ON public.titoli_storni;
DROP POLICY IF EXISTS "Authenticated users can update storni" ON public.titoli_storni;
DROP POLICY IF EXISTS "Authenticated users can insert storni" ON public.titoli_storni;

CREATE POLICY "Scoped read storni" ON public.titoli_storni
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'cfo'::app_role)
    OR has_role(auth.uid(),'ufficio'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = titoli_storni.titolo_id
        AND (
          t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
          OR (has_role(auth.uid(),'produttore'::app_role) AND t.produttore_id = auth.uid())
        )
    )
  );

CREATE POLICY "Staff insert storni" ON public.titoli_storni
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Staff update storni" ON public.titoli_storni
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- Storage: rimesse-pdf bucket — restrict to ufficio/admin only
DROP POLICY IF EXISTS "Authenticated read rimesse pdf" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write rimesse pdf" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update rimesse pdf" ON storage.objects;

CREATE POLICY "Staff read rimesse pdf" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rimesse-pdf'
    AND (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  );
CREATE POLICY "Staff write rimesse pdf" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rimesse-pdf'
    AND (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  );
CREATE POLICY "Staff update rimesse pdf" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rimesse-pdf'
    AND (has_role(auth.uid(),'ufficio'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  );
