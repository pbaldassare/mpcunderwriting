
-- 1. Nuove colonne FK
ALTER TABLE public.rimessa_dettaglio
  ADD COLUMN IF NOT EXISTS quietanza_id uuid REFERENCES public.quietanze(id) ON DELETE SET NULL;

ALTER TABLE public.note_restituzione_dettaglio
  ADD COLUMN IF NOT EXISTS quietanza_id uuid REFERENCES public.quietanze(id) ON DELETE SET NULL;

ALTER TABLE public.provvigioni_generate
  ADD COLUMN IF NOT EXISTS quietanza_id uuid REFERENCES public.quietanze(id) ON DELETE SET NULL;

ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS polizza_id uuid REFERENCES public.polizze(id) ON DELETE SET NULL;

ALTER TABLE public.titoli_sostituzioni
  ADD COLUMN IF NOT EXISTS polizza_id uuid REFERENCES public.polizze(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS polizza_sostituta_id uuid REFERENCES public.polizze(id) ON DELETE SET NULL;

ALTER TABLE public.titoli_storni
  ADD COLUMN IF NOT EXISTS polizza_id uuid REFERENCES public.polizze(id) ON DELETE SET NULL;

-- 2. Backfill da titolo_id → quietanza_id
UPDATE public.rimessa_dettaglio rd
SET quietanza_id = q.id
FROM public.quietanze q
WHERE q.titolo_id = rd.titolo_id AND rd.quietanza_id IS NULL;

UPDATE public.note_restituzione_dettaglio nrd
SET quietanza_id = q.id
FROM public.quietanze q
WHERE q.titolo_id = nrd.titolo_id AND nrd.quietanza_id IS NULL;

UPDATE public.provvigioni_generate pg
SET quietanza_id = q.id
FROM public.quietanze q
WHERE q.titolo_id = pg.titolo_id AND pg.quietanza_id IS NULL;

-- 3. Backfill da titoli.polizza_id → polizza_id
UPDATE public.sinistri s
SET polizza_id = t.polizza_id
FROM public.titoli t
WHERE t.id = s.titolo_id AND t.polizza_id IS NOT NULL AND s.polizza_id IS NULL;

UPDATE public.titoli_sostituzioni ts
SET polizza_id = t.polizza_id
FROM public.titoli t
WHERE t.id = ts.titolo_id AND t.polizza_id IS NOT NULL AND ts.polizza_id IS NULL;

UPDATE public.titoli_storni tst
SET polizza_id = t.polizza_id
FROM public.titoli t
WHERE t.id = tst.titolo_id AND t.polizza_id IS NOT NULL AND tst.polizza_id IS NULL;

-- 4. Indici
CREATE INDEX IF NOT EXISTS idx_rimessa_dettaglio_quietanza ON public.rimessa_dettaglio(quietanza_id);
CREATE INDEX IF NOT EXISTS idx_note_restituzione_dettaglio_quietanza ON public.note_restituzione_dettaglio(quietanza_id);
CREATE INDEX IF NOT EXISTS idx_provvigioni_generate_quietanza ON public.provvigioni_generate(quietanza_id);
CREATE INDEX IF NOT EXISTS idx_sinistri_polizza ON public.sinistri(polizza_id);
CREATE INDEX IF NOT EXISTS idx_titoli_sostituzioni_polizza ON public.titoli_sostituzioni(polizza_id);
CREATE INDEX IF NOT EXISTS idx_titoli_sostituzioni_polizza_sost ON public.titoli_sostituzioni(polizza_sostituta_id);
CREATE INDEX IF NOT EXISTS idx_titoli_storni_polizza ON public.titoli_storni(polizza_id);
CREATE INDEX IF NOT EXISTS idx_quietanze_polizza_numero ON public.quietanze(polizza_id, numero_rata);
CREATE INDEX IF NOT EXISTS idx_quietanze_data_messa_cassa ON public.quietanze(data_messa_cassa) WHERE data_messa_cassa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quietanze_stato ON public.quietanze(stato);

-- 5. View portafoglio quietanze (per le viste UI Attive/Carico/Storico)
CREATE OR REPLACE VIEW public.v_portafoglio_quietanze AS
SELECT
  q.id                           AS quietanza_id,
  q.polizza_id,
  q.numero_rata,
  q.numero_rate_totali,
  q.garanzia_da,
  q.garanzia_a,
  q.data_competenza,
  q.data_scadenza,
  q.premio_lordo,
  q.premio_netto,
  q.tasse,
  q.addizionali,
  q.ssn,
  q.provvigioni_firma,
  q.provvigioni_quietanza,
  q.stato                        AS stato_quietanza,
  q.data_messa_cassa,
  q.data_pagamento,
  q.data_incasso,
  q.importo_incassato,
  q.tipo_incasso,
  q.conto_incasso,
  q.appendice,
  q.numero_polizza_snapshot,
  q.titolo_id                    AS titolo_legacy_id,
  p.numero_polizza,
  p.cig_rif,
  p.appendice_corrente,
  p.cliente_anagrafica_id,
  p.compagnia_id,
  p.ramo_id,
  p.frazionamento,
  p.durata_da,
  p.durata_a,
  p.tacito_rinnovo,
  p.regolazione,
  p.stato                        AS stato_polizza,
  p.tipo_portafoglio,
  p.descrizione_polizza,
  t.ufficio_id,
  t.ae_anagrafica_id,
  t.anagrafica_commerciale_id    AS produttore_id,
  CASE WHEN q.numero_rata = 1 THEN 'polizza' ELSE 'quietanza' END AS tipo_riga
FROM public.quietanze q
JOIN public.polizze p ON p.id = q.polizza_id
LEFT JOIN public.titoli t ON t.id = q.titolo_id;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT ALL ON public.v_portafoglio_quietanze TO service_role;
