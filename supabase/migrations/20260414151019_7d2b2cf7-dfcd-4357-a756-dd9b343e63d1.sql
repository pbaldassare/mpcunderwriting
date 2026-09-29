ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS data_sospensione date;
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS limite_riattivazione date;
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS data_riattivazione date;
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS motivo_sospensione text;