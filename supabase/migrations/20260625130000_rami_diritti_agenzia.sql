-- Diritti di agenzia: voce garanzia con solo importo tasse manuale (no premio netto/lordo da imponibile).

ALTER TABLE public.rami
  ADD COLUMN IF NOT EXISTS diritti_agenzia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rami.diritti_agenzia IS
  'Se true la voce accetta solo importo tasse manuale (diritti di agenzia), senza premio netto né calcolo % tasse.';

-- Seed per tutti i Gruppi Ramo esistenti
INSERT INTO public.rami
  (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
   ssn_attivo, attivo, diritti_agenzia)
SELECT g.codice || '-DAG', 'DIRITTI DI AGENZIA', g.id, 0, 0, false, true, true
FROM public.gruppi_ramo g
WHERE NOT EXISTS (
  SELECT 1 FROM public.rami r
  WHERE r.gruppo_ramo_id = g.id AND r.diritti_agenzia = true
);

-- Estende il trigger su nuovi Gruppi Ramo (CF, ONERI, Diritti di agenzia)
CREATE OR REPLACE FUNCTION public.trg_gruppi_ramo_seed_cf_oneri()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rami
    (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
     ssn_attivo, attivo, escludi_provvigioni)
  VALUES
    (NEW.codice || '-CF', 'CONTRIBUTO FORZOSO', NEW.id, 0, 0, false, true, true),
    (NEW.codice || '-ON', 'ONERI',              NEW.id, 0, 0, false, true, true)
  ON CONFLICT (codice) DO NOTHING;

  INSERT INTO public.rami
    (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
     ssn_attivo, attivo, diritti_agenzia)
  VALUES
    (NEW.codice || '-DAG', 'DIRITTI DI AGENZIA', NEW.id, 0, 0, false, true, true)
  ON CONFLICT (codice) DO NOTHING;

  RETURN NEW;
END;
$$;
