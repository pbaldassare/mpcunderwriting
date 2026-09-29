
ALTER TABLE public.trattative DROP CONSTRAINT IF EXISTS trattative_stato_check;

ALTER TABLE public.trattative ADD CONSTRAINT trattative_stato_check CHECK (stato IN ('aperta', 'contatto', 'preventivo', 'in_negoziazione', 'proposta_inviata', 'chiusa_vinta', 'chiusa_persa', 'sospesa'));
