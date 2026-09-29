
ALTER TABLE public.movimenti_polizze
  ADD COLUMN IF NOT EXISTS cliente_id uuid NULL REFERENCES public.clienti(id),
  ADD COLUMN IF NOT EXISTS pagato_da text NULL;

CREATE INDEX IF NOT EXISTS idx_movimenti_polizze_cliente_id ON public.movimenti_polizze(cliente_id);

-- Backfill: cliente_id dal parent movimenti_clienti, pagato_da dall'ordinante del movimento bancario
UPDATE public.movimenti_polizze mp
SET cliente_id = mc.cliente_id,
    pagato_da  = mb.ordinante
FROM public.movimenti_clienti mc
JOIN public.movimenti_bancari mb ON mb.id = mc.movimento_id
WHERE mp.movimento_cliente_id = mc.id
  AND (mp.cliente_id IS NULL OR mp.pagato_da IS NULL);
