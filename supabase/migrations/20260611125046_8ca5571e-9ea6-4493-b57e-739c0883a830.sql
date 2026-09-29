
CREATE TYPE public.movimento_bancario_stato AS ENUM
  ('importato','matchato','assegnato','ricongiunti','incassato');

CREATE TYPE public.movimento_polizza_tipo AS ENUM ('polizza','anticipo','ammanco');

CREATE TABLE public.movimenti_bancari (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_movimento  date NOT NULL,
  importo         numeric(12,2) NOT NULL,
  ordinante       text,
  descrizione     text,
  stato           public.movimento_bancario_stato NOT NULL DEFAULT 'importato',
  ufficio_id      uuid REFERENCES public.uffici(id),
  cliente_id      uuid REFERENCES public.clienti(id),
  caricato_da     uuid REFERENCES auth.users(id),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_bancari TO authenticated;
GRANT ALL ON public.movimenti_bancari TO service_role;
ALTER TABLE public.movimenti_bancari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mb_admin_all" ON public.movimenti_bancari
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role));
CREATE POLICY "mb_sede_select" ON public.movimenti_bancari
  FOR SELECT TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "mb_sede_update" ON public.movimenti_bancari
  FOR UPDATE TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_movimenti_bancari_ufficio ON public.movimenti_bancari(ufficio_id);
CREATE INDEX idx_movimenti_bancari_stato ON public.movimenti_bancari(stato);
CREATE INDEX idx_movimenti_bancari_data ON public.movimenti_bancari(data_movimento);

CREATE TABLE public.movimenti_clienti (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_id        uuid NOT NULL REFERENCES public.movimenti_bancari(id) ON DELETE CASCADE,
  cliente_id          uuid NOT NULL REFERENCES public.clienti(id),
  ufficio_id          uuid REFERENCES public.uffici(id),
  importo_assegnato   numeric(12,2) NOT NULL,
  anticipo            numeric(12,2) NOT NULL DEFAULT 0,
  ammanco             numeric(12,2) NOT NULL DEFAULT 0,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_clienti TO authenticated;
GRANT ALL ON public.movimenti_clienti TO service_role;
ALTER TABLE public.movimenti_clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_admin_all" ON public.movimenti_clienti
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role));
CREATE POLICY "mc_sede_rw" ON public.movimenti_clienti
  FOR ALL TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_movimenti_clienti_mov ON public.movimenti_clienti(movimento_id);
CREATE INDEX idx_movimenti_clienti_cliente ON public.movimenti_clienti(cliente_id);

CREATE TABLE public.movimenti_polizze (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_cliente_id  uuid NOT NULL REFERENCES public.movimenti_clienti(id) ON DELETE CASCADE,
  titolo_id             uuid REFERENCES public.titoli(id),
  importo               numeric(12,2) NOT NULL,
  tipo                  public.movimento_polizza_tipo NOT NULL DEFAULT 'polizza',
  messo_a_cassa         boolean NOT NULL DEFAULT false,
  data_messa_cassa      date,
  created_at            timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_polizze TO authenticated;
GRANT ALL ON public.movimenti_polizze TO service_role;
ALTER TABLE public.movimenti_polizze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_admin_all" ON public.movimenti_polizze
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'cfo'::public.app_role));
CREATE POLICY "mp_sede_rw" ON public.movimenti_polizze
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.movimenti_clienti mc
    WHERE mc.id = movimento_cliente_id
      AND mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.movimenti_clienti mc
    WHERE mc.id = movimento_cliente_id
      AND mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
  ));

CREATE INDEX idx_movimenti_polizze_mc ON public.movimenti_polizze(movimento_cliente_id);
CREATE INDEX idx_movimenti_polizze_titolo ON public.movimenti_polizze(titolo_id);

CREATE TRIGGER trg_movimenti_bancari_updated
  BEFORE UPDATE ON public.movimenti_bancari
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.movimenti_bancari REPLICA IDENTITY FULL;
ALTER TABLE public.movimenti_clienti REPLICA IDENTITY FULL;
ALTER TABLE public.movimenti_polizze REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimenti_bancari;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimenti_clienti;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimenti_polizze;
