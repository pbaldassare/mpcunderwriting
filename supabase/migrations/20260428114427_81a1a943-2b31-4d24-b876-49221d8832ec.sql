-- 1) Colonna solo_statistico
ALTER TABLE public.provvigioni_generate
  ADD COLUMN IF NOT EXISTS solo_statistico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.provvigioni_generate.solo_statistico IS
  'true = riga generata solo per fini statistici (es. commerciale coincide con admin Consulbrokers SPA): non conteggiare nei totali economici/pagamenti.';

COMMENT ON COLUMN public.provvigioni_generate.tipo_destinatario IS
  'Destinatario provvigione: commerciale | admin (Consulbrokers SPA / casa madre) | consul (legacy, no commerciale)';

-- 2) Impostazione admin_anagrafica_id
INSERT INTO public.impostazioni_sistema (chiave, valore_json, descrizione)
VALUES (
  'admin_anagrafica_id',
  jsonb_build_object('anagrafica_id', 'b5029abb-72dd-454f-bbd1-2d758964a379'),
  'ID anagrafica professionale che rappresenta l''admin/casa madre (Consulbrokers SPA). Riceve la quota residua delle provvigioni.'
)
ON CONFLICT (chiave) DO UPDATE
  SET valore_json = EXCLUDED.valore_json,
      descrizione = EXCLUDED.descrizione,
      updated_at = now();

-- 3) Rietichetta righe storiche: 'consul' -> 'admin' quando il titolo ha un commerciale valorizzato
UPDATE public.provvigioni_generate pg
SET tipo_destinatario = 'admin'
FROM public.titoli t
WHERE pg.titolo_id = t.id
  AND pg.tipo_destinatario = 'consul'
  AND (t.anagrafica_commerciale_id IS NOT NULL OR t.commerciale_id IS NOT NULL)
  AND COALESCE(t.percentuale_commerciale, 100) < 100;