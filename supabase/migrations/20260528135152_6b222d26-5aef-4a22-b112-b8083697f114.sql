ALTER TABLE public.compagnie
  ADD COLUMN IF NOT EXISTS email_messe_a_cassa text,
  ADD COLUMN IF NOT EXISTS email_estratto_conto text;

UPDATE public.compagnie
SET email_messe_a_cassa = 'pscarpelli@consulbrokers.it',
    email_estratto_conto = 'pscarpelli@consulbrokers.it';

UPDATE public.compagnia_rapporti
SET email_messe_a_cassa = 'pscarpelli@consulbrokers.it',
    email_estratto_conto = 'pscarpelli@consulbrokers.it';