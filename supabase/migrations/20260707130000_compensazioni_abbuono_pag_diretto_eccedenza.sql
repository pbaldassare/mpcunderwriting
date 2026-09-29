-- Struttura abbuono, pagamento diretto compagnia ed eccedenza di conto come
-- causali di compensazione contabile (al posto di valori tipo_pagamento).
-- Ogni causale porta un "effetto_contabile" che innesca la logica corretta in
-- messa a cassa, mantenendo invariati i comportamenti attesi.

ALTER TABLE public.causali_contabili
  ADD COLUMN IF NOT EXISTS effetto_contabile text NOT NULL DEFAULT 'standard'
    CHECK (effetto_contabile IN ('standard', 'abbuono', 'pag_diretto_compagnia', 'eccedenza'));

COMMENT ON COLUMN public.causali_contabili.effetto_contabile IS
  'Effetto della causale in messa a cassa: standard (solo compensazione), abbuono (write-off), pag_diretto_compagnia (flag premio pagato in compagnia), eccedenza (genera acconto cliente).';

-- Marca le causali abbuono esistenti.
UPDATE public.causali_contabili
SET effetto_contabile = 'abbuono'
WHERE tipo_tabella = 'compensazione_messa_cassa'
  AND codice IN ('ABB_ATT', 'ABB_PAS');

-- Nuove causali: pagamento diretto compagnia ed eccedenza di conto.
INSERT INTO public.causali_contabili (tipo_tabella, codice, descrizione, attivo, segno_default, effetto_contabile) VALUES
  ('compensazione_messa_cassa', 'PAG_DIR_CIA', 'Rimessa/Pagamento diretto compagnia (solo provvigione)', true, '+', 'pag_diretto_compagnia'),
  ('compensazione_messa_cassa', 'ECCED',       'Eccedenza di conto (genera acconto cliente)',            true, '-', 'eccedenza')
ON CONFLICT DO NOTHING;

-- Allinea l'effetto anche se le causali esistevano già senza effetto.
UPDATE public.causali_contabili SET effetto_contabile = 'pag_diretto_compagnia'
WHERE tipo_tabella = 'compensazione_messa_cassa' AND codice = 'PAG_DIR_CIA';
UPDATE public.causali_contabili SET effetto_contabile = 'eccedenza'
WHERE tipo_tabella = 'compensazione_messa_cassa' AND codice = 'ECCED';
