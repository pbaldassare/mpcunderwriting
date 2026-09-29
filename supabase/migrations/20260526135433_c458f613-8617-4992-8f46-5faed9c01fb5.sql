CREATE TABLE public.titoli_numeri_storici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  numero_precedente text NOT NULL,
  numero_nuovo text NOT NULL,
  causale text NOT NULL CHECK (causale IN ('sostituzione','sospensione','riattivazione')),
  motivo text,
  riferimento_id uuid,
  cambiato_da_user_id uuid,
  cambiato_il timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_titoli_numeri_storici_titolo ON public.titoli_numeri_storici(titolo_id);
CREATE INDEX idx_titoli_numeri_storici_num_prec ON public.titoli_numeri_storici(numero_precedente);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titoli_numeri_storici TO authenticated;
GRANT ALL ON public.titoli_numeri_storici TO service_role;

ALTER TABLE public.titoli_numeri_storici ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read numeri storici"
  ON public.titoli_numeri_storici FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert numeri storici"
  ON public.titoli_numeri_storici FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin delete numeri storici"
  ON public.titoli_numeri_storici FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));