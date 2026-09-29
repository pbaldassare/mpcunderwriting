ALTER TABLE public.provvigioni_generate 
ADD COLUMN IF NOT EXISTS tipo_destinatario TEXT DEFAULT 'consul';