ALTER TABLE public.compagnia_rapporti
  ADD COLUMN IF NOT EXISTS email_messe_a_cassa text,
  ADD COLUMN IF NOT EXISTS email_estratto_conto text;

UPDATE public.compagnia_rapporti
SET email_messe_a_cassa = COALESCE(email_messe_a_cassa, 'pscarpelli@gmail.com'),
    email_estratto_conto = COALESCE(email_estratto_conto, 'pscarpelli@gmail.com');