-- Flag agenzia: accordo di collaborazione e ratifica ex art. 118 CAP
ALTER TABLE public.compagnie
  ADD COLUMN IF NOT EXISTS accordo_collaborazione boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ratifica_art_118 boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.compagnie.accordo_collaborazione IS 'Agenzia con accordo di collaborazione attivo';
COMMENT ON COLUMN public.compagnie.ratifica_art_118 IS 'Pagamento premio ratificato ex art. 118 CAP (effetto liberatorio)';
