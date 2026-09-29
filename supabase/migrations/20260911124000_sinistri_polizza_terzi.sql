-- Dati polizza dichiarati sul sinistro (anche Terzi, senza FK su titoli)
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS numero_polizza text,
  ADD COLUMN IF NOT EXISTS prodotto_sinistro text;

COMMENT ON COLUMN public.sinistri.numero_polizza IS
  'Numero polizza della pratica. Per Sinistro Terzi è il numero esterno (titolo_id resta NULL).';

COMMENT ON COLUMN public.sinistri.prodotto_sinistro IS
  'Tipo/nome prodotto dichiarato sulla pratica, utile quando manca il titolo CBnet.';
