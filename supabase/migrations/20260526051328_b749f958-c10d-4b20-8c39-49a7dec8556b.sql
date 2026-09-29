
-- Add SSN flag and rate on sottorami (rami)
ALTER TABLE public.rami
  ADD COLUMN IF NOT EXISTS ssn_attivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aliquota_ssn numeric(5,2) NULL;

-- Aggregate SSN amounts on titoli (parallel to tasse/addizionali)
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS ssn_firma numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ssn_quietanza numeric(12,2) NOT NULL DEFAULT 0;

-- Seed: enable SSN on RCA Auto sottorami (gruppo ZQ - R.C.A.)
UPDATE public.rami r
SET ssn_attivo = true, aliquota_ssn = 10.50
FROM public.gruppi_ramo g
WHERE r.gruppo_ramo_id = g.id
  AND g.codice = 'ZQ'
  AND r.ssn_attivo = false;
