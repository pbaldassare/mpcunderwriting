ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;
ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS banca_pagamento TEXT;