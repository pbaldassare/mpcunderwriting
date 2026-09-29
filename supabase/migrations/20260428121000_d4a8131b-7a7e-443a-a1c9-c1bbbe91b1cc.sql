-- 1. Aggiunge colonna ponte fornitori → anagrafiche_professionali
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS anagrafica_professionale_id uuid 
  REFERENCES public.anagrafiche_professionali(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fornitori_anagrafica_professionale_id 
  ON public.fornitori(anagrafica_professionale_id);

-- 2. Riassegna i titoli dai duplicati al master
UPDATE public.titoli
   SET anagrafica_commerciale_id = '6d1d5294-707f-4dde-8c39-7f13ada8a26b'
 WHERE anagrafica_commerciale_id IN (
   'eb9f1f9a-0000-0000-0000-000000000000'::uuid, -- placeholder, sostituito sotto
   '012e76c9-0000-0000-0000-000000000000'::uuid
 );

-- Riassegnazione effettiva (con ID reali)
UPDATE public.titoli
   SET anagrafica_commerciale_id = '6d1d5294-707f-4dde-8c39-7f13ada8a26b'
 WHERE anagrafica_commerciale_id::text IN ('eb9f1f9a','012e76c9')
    OR anagrafica_commerciale_id IN (
      SELECT id FROM public.anagrafiche_professionali 
      WHERE id::text LIKE 'eb9f1f9a%' OR id::text LIKE '012e76c9%'
    );

-- 3. Disattiva duplicati con nota di tracciamento
UPDATE public.anagrafiche_professionali
   SET attivo = false,
       note = COALESCE(note,'') || ' [MERGED in 6d1d5294-707f-4dde-8c39-7f13ada8a26b il ' || to_char(now(),'YYYY-MM-DD') || ']'
 WHERE id::text LIKE 'eb9f1f9a%' OR id::text LIKE '012e76c9%';

-- 4. Collega il fornitore ASS.NI SAN MARCO SNC al master professionale
UPDATE public.fornitori
   SET anagrafica_professionale_id = '6d1d5294-707f-4dde-8c39-7f13ada8a26b'
 WHERE id::text LIKE '7cb1b3de%';