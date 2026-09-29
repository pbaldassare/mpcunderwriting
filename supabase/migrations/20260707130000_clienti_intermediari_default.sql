-- ---------------------------------------------------------------------------
-- Default multi-valore di intermediari (produttori + account executive) per cliente.
--
-- Consente di associare al cliente N produttori e N AE come default: le nuove
-- polizze ereditano automaticamente tutti i produttori nello split commerciale
-- e (per compatibilità con il modello polizza a AE singolo) il primo AE nel
-- campo Account Executive del titolo.
--
-- La compatibilità con i default singoli storici è garantita dal backfill da
-- codici_commerciali_cliente e dalla sincronizzazione del primo valore verso
-- codici_commerciali_cliente lato applicazione.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.clienti_intermediari_default (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('produttore','ae')),
  anagrafica_commerciale_id uuid NOT NULL REFERENCES public.anagrafiche_professionali(id),
  percentuale numeric NOT NULL DEFAULT 0,
  ordine int NOT NULL DEFAULT 0,
  escludi_provvigioni boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_clienti_interm_default
  ON public.clienti_intermediari_default (cliente_id, tipo, anagrafica_commerciale_id);
CREATE INDEX IF NOT EXISTS ix_clienti_interm_default_cliente
  ON public.clienti_intermediari_default (cliente_id);

ALTER TABLE public.clienti_intermediari_default ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clienti_intermediari_default"
  ON public.clienti_intermediari_default FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/ufficio can manage clienti_intermediari_default"
  ON public.clienti_intermediari_default FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ufficio'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ufficio'));

-- Backfill dai default singoli esistenti (Produttore Sede + AE)
INSERT INTO public.clienti_intermediari_default (cliente_id, tipo, anagrafica_commerciale_id, percentuale, ordine, escludi_provvigioni)
SELECT c.cliente_id, 'produttore', c.anagrafica_id, 0, 0, COALESCE(c.escludi_provvigioni,false)
FROM public.codici_commerciali_cliente c
WHERE c.ruolo = 'Produttore Sede' AND c.anagrafica_id IS NOT NULL
ON CONFLICT (cliente_id, tipo, anagrafica_commerciale_id) DO NOTHING;

INSERT INTO public.clienti_intermediari_default (cliente_id, tipo, anagrafica_commerciale_id, percentuale, ordine, escludi_provvigioni)
SELECT c.cliente_id, 'ae', c.anagrafica_id, 0, 0, false
FROM public.codici_commerciali_cliente c
WHERE c.ruolo = 'AE' AND c.anagrafica_id IS NOT NULL
ON CONFLICT (cliente_id, tipo, anagrafica_commerciale_id) DO NOTHING;

GRANT ALL ON public.clienti_intermediari_default TO authenticated;
GRANT ALL ON public.clienti_intermediari_default TO service_role;
