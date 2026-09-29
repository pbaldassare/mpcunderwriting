ALTER TABLE public.provvigioni_generate
ADD COLUMN IF NOT EXISTS anagrafica_commerciale_id uuid NULL REFERENCES public.anagrafiche_professionali(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_provvigioni_generate_anagrafica_commerciale_id
  ON public.provvigioni_generate(anagrafica_commerciale_id);

-- Backfill: collega le provvigioni 'commerciale' esistenti al produttore-anagrafica
-- Caso 1: titoli con split commerciali → usa il primo split commerciale del titolo
UPDATE public.provvigioni_generate pg
SET anagrafica_commerciale_id = sub.anagrafica_commerciale_id
FROM (
  SELECT DISTINCT ON (titolo_id) titolo_id, anagrafica_commerciale_id
  FROM public.titoli_split_commerciali
  WHERE anagrafica_commerciale_id IS NOT NULL
  ORDER BY titolo_id, ordine ASC
) sub
WHERE pg.titolo_id = sub.titolo_id
  AND pg.tipo_destinatario = 'commerciale'
  AND pg.anagrafica_commerciale_id IS NULL;

-- Caso 2: titoli senza split → usa titoli.anagrafica_commerciale_id
UPDATE public.provvigioni_generate pg
SET anagrafica_commerciale_id = t.anagrafica_commerciale_id
FROM public.titoli t
WHERE pg.titolo_id = t.id
  AND pg.tipo_destinatario = 'commerciale'
  AND pg.anagrafica_commerciale_id IS NULL
  AND t.anagrafica_commerciale_id IS NOT NULL;