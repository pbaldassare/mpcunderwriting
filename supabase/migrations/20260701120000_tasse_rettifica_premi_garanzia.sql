-- Rettifica manuale tasse per riga garanzia (non influenza provvigioni)
ALTER TABLE public.premi_garanzia_polizza
  ADD COLUMN IF NOT EXISTS tasse_rettifica numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.premi_garanzia_polizza.tasse_rettifica IS
  'Rettifica manuale tasse (€): si somma alle tasse auto-calcolate per il lordo, senza impattare provvigioni.';
