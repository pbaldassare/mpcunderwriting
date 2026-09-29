
ALTER TABLE public.sinistri ADD COLUMN IF NOT EXISTS aperto_da_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.documenti ADD COLUMN IF NOT EXISTS caricato_da_cliente boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.richieste_modifica_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  richiesto_da uuid NOT NULL,
  campo text NOT NULL,
  campo_label text,
  valore_attuale text,
  valore_proposto text NOT NULL,
  motivazione text,
  documento_url text,
  stato text NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa','approvata','rifiutata','annullata')),
  note_agenzia text,
  gestita_da uuid,
  gestita_il timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rmc_cliente ON public.richieste_modifica_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_rmc_stato ON public.richieste_modifica_cliente(stato);

ALTER TABLE public.richieste_modifica_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all rmc" ON public.richieste_modifica_cliente
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Ufficio select rmc" ON public.richieste_modifica_cliente
  FOR SELECT USING (has_role(auth.uid(),'ufficio'::app_role));
CREATE POLICY "Ufficio update rmc" ON public.richieste_modifica_cliente
  FOR UPDATE USING (has_role(auth.uid(),'ufficio'::app_role)) WITH CHECK (has_role(auth.uid(),'ufficio'::app_role));
CREATE POLICY "Cliente select own rmc" ON public.richieste_modifica_cliente
  FOR SELECT USING (
    has_role(auth.uid(),'cliente'::app_role)
    AND cliente_id IN (SELECT get_my_cliente_ids())
  );
CREATE POLICY "Cliente insert own rmc" ON public.richieste_modifica_cliente
  FOR INSERT WITH CHECK (
    has_role(auth.uid(),'cliente'::app_role)
    AND cliente_id IN (SELECT get_my_cliente_ids())
    AND stato = 'in_attesa'
    AND richiesto_da = auth.uid()
  );
CREATE POLICY "Cliente delete own pending rmc" ON public.richieste_modifica_cliente
  FOR DELETE USING (
    has_role(auth.uid(),'cliente'::app_role)
    AND cliente_id IN (SELECT get_my_cliente_ids())
    AND stato = 'in_attesa'
  );

CREATE TRIGGER trg_rmc_updated_at
  BEFORE UPDATE ON public.richieste_modifica_cliente
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Cliente insert own sinistro" ON public.sinistri
  FOR INSERT WITH CHECK (
    has_role(auth.uid(),'cliente'::app_role)
    AND cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
    AND aperto_da_cliente = true
    AND stato = 'aperto'
  );

DROP POLICY IF EXISTS cliente_insert_documenti ON public.documenti;
CREATE POLICY "cliente_insert_documenti" ON public.documenti
  FOR INSERT WITH CHECK (
    has_role(auth.uid(),'cliente'::app_role)
    AND visibile_al_cliente = true
    AND caricato_da_cliente = true
    AND (
      (entita_tipo = 'cliente' AND entita_id IN (SELECT get_my_cliente_ids()))
      OR (entita_tipo = 'sinistro' AND entita_id IN (
        SELECT s.id FROM public.sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
      ))
      OR (entita_tipo = 'titolo' AND entita_id IN (
        SELECT t.id FROM public.titoli t WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
      ))
    )
  );

CREATE POLICY "Cliente upload documenti_sinistri"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documenti_sinistri' AND has_role(auth.uid(),'cliente'::app_role));

CREATE POLICY "Cliente upload documenti_titoli"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documenti_titoli' AND has_role(auth.uid(),'cliente'::app_role));

CREATE POLICY "Cliente read documenti_sinistri"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documenti_sinistri'
    AND has_role(auth.uid(),'cliente'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.documenti d
      WHERE d.bucket_name = 'documenti_sinistri'
        AND d.path_storage = storage.objects.name
        AND d.visibile_al_cliente = true
        AND d.entita_tipo = 'sinistro'
        AND d.entita_id IN (
          SELECT s.id FROM public.sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
        )
    )
  );

CREATE POLICY "Cliente read documenti_titoli"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documenti_titoli'
    AND has_role(auth.uid(),'cliente'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.documenti d
      WHERE d.bucket_name = 'documenti_titoli'
        AND d.path_storage = storage.objects.name
        AND d.visibile_al_cliente = true
        AND d.entita_tipo = 'titolo'
        AND d.entita_id IN (
          SELECT t.id FROM public.titoli t WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
        )
    )
  );
