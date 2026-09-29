-- 1. Flag su rami
ALTER TABLE public.rami
  ADD COLUMN IF NOT EXISTS escludi_provvigioni boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rami.escludi_provvigioni IS
  'Se true il sottoramo non genera tasse né provvigioni (es. Contributo Forzoso, Oneri).';

-- 2. Seed delle righe per i Gruppi Ramo già esistenti
INSERT INTO public.rami
  (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
   ssn_attivo, attivo, escludi_provvigioni)
SELECT g.codice || '-CF', 'CONTRIBUTO FORZOSO', g.id, 0, 0, false, true, true
FROM public.gruppi_ramo g
ON CONFLICT (codice) DO NOTHING;

INSERT INTO public.rami
  (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
   ssn_attivo, attivo, escludi_provvigioni)
SELECT g.codice || '-ON', 'ONERI', g.id, 0, 0, false, true, true
FROM public.gruppi_ramo g
ON CONFLICT (codice) DO NOTHING;

-- 3. Trigger AFTER INSERT su gruppi_ramo per i futuri Gruppi
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_cf_oneri ON public.gruppi_ramo;
CREATE TRIGGER trg_seed_cf_oneri
AFTER INSERT ON public.gruppi_ramo
FOR EACH ROW EXECUTE FUNCTION public.trg_gruppi_ramo_seed_cf_oneri();