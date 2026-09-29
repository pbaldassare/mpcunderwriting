-- Note interne multi-entry per sinistro (log cronologico)
CREATE TABLE IF NOT EXISTS public.sinistro_note_interne (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistri(id) ON DELETE CASCADE,
  testo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT sinistro_note_interne_testo_non_vuoto CHECK (length(btrim(testo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_sinistro_note_interne_sinistro_created
  ON public.sinistro_note_interne (sinistro_id, created_at DESC);

ALTER TABLE public.sinistro_note_interne ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin all note interne"
  ON public.sinistro_note_interne
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- CFO: read
CREATE POLICY "CFO select note interne"
  ON public.sinistro_note_interne
  FOR SELECT
  USING (has_role(auth.uid(), 'cfo'::app_role));

-- Ufficio / sede: CRUD sulle pratiche della propria sede
CREATE POLICY "Ufficio all own note interne"
  ON public.sinistro_note_interne
  FOR ALL
  USING (
    sinistro_id IN (
      SELECT s.id FROM public.sinistri s
      WHERE s.ufficio_id = ANY (get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    sinistro_id IN (
      SELECT s.id FROM public.sinistri s
      WHERE s.ufficio_id = ANY (get_my_ufficio_ids())
    )
  );

-- Ruolo ufficio: insert/update/delete globali (come sinistro_eventi)
CREATE POLICY "Ufficio global insert note interne"
  ON public.sinistro_note_interne
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role));

CREATE POLICY "Ufficio global update note interne"
  ON public.sinistro_note_interne
  FOR UPDATE
  USING (has_role(auth.uid(), 'ufficio'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role));

CREATE POLICY "Ufficio global delete note interne"
  ON public.sinistro_note_interne
  FOR DELETE
  USING (has_role(auth.uid(), 'ufficio'::app_role));

-- Produttore: sola lettura sulle pratiche del proprio portafoglio
CREATE POLICY "Produttore select own note interne"
  ON public.sinistro_note_interne
  FOR SELECT
  USING (
    sinistro_id IN (
      SELECT s.id FROM public.sinistri s
      WHERE s.titolo_id IN (
        SELECT t.id FROM public.titoli t
        WHERE t.produttore_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinistro_note_interne TO authenticated;
GRANT ALL ON public.sinistro_note_interne TO service_role;

-- Migra il campo legacy note_interne (se presente) come prima riga del log
INSERT INTO public.sinistro_note_interne (sinistro_id, testo, created_by, created_at)
SELECT
  s.id,
  btrim(s.note_interne),
  s.aperto_da_user_id,
  COALESCE(s.updated_at, s.created_at, now())
FROM public.sinistri s
WHERE s.note_interne IS NOT NULL
  AND length(btrim(s.note_interne)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.sinistro_note_interne n WHERE n.sinistro_id = s.id
  );
