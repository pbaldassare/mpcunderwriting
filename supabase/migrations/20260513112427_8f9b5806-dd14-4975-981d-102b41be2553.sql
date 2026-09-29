-- titoli.cliente_anagrafica_id → SET NULL
ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_cliente_anagrafica_id_fkey;
ALTER TABLE public.titoli
  ADD CONSTRAINT titoli_cliente_anagrafica_id_fkey
  FOREIGN KEY (cliente_anagrafica_id) REFERENCES public.clienti(id) ON DELETE SET NULL;

-- sinistri.cliente_anagrafica_id → SET NULL
ALTER TABLE public.sinistri DROP CONSTRAINT IF EXISTS sinistri_cliente_anagrafica_id_fkey;
ALTER TABLE public.sinistri
  ADD CONSTRAINT sinistri_cliente_anagrafica_id_fkey
  FOREIGN KEY (cliente_anagrafica_id) REFERENCES public.clienti(id) ON DELETE SET NULL;

-- prospect.convertito_cliente_id → SET NULL
ALTER TABLE public.prospect DROP CONSTRAINT IF EXISTS prospect_convertito_cliente_id_fkey;
ALTER TABLE public.prospect
  ADD CONSTRAINT prospect_convertito_cliente_id_fkey
  FOREIGN KEY (convertito_cliente_id) REFERENCES public.clienti(id) ON DELETE SET NULL;