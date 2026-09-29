-- Add tacito_rinnovo boolean flag to titoli
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS tacito_rinnovo boolean NOT NULL DEFAULT true;

-- Add tacito_rinnovo boolean flag to movimenti_polizza
ALTER TABLE public.movimenti_polizza
  ADD COLUMN IF NOT EXISTS tacito_rinnovo boolean NOT NULL DEFAULT true;

-- Initialize from legacy tipo_rinnovo on titoli
UPDATE public.titoli
SET tacito_rinnovo = CASE
  WHEN tipo_rinnovo IN ('T', 'tacito_rinnovo') THEN true
  WHEN tipo_rinnovo IS NULL OR tipo_rinnovo = '' THEN true
  ELSE false
END;

-- Initialize from legacy tipo_rinnovo on movimenti_polizza
UPDATE public.movimenti_polizza
SET tacito_rinnovo = CASE
  WHEN tipo_rinnovo IN ('T', 'tacito_rinnovo') THEN true
  WHEN tipo_rinnovo IS NULL OR tipo_rinnovo = '' THEN true
  ELSE false
END;