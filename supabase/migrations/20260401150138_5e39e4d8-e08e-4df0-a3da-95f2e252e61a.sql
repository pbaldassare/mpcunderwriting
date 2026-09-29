
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS perito_id uuid REFERENCES public.anagrafiche_professionali(id),
  ADD COLUMN IF NOT EXISTS liquidatore_id uuid REFERENCES public.anagrafiche_professionali(id),
  ADD COLUMN IF NOT EXISTS medico_legale text,
  ADD COLUMN IF NOT EXISTS dinamica text,
  ADD COLUMN IF NOT EXISTS indirizzo_sinistro text,
  ADD COLUMN IF NOT EXISTS citta_sinistro text,
  ADD COLUMN IF NOT EXISTS provincia_sinistro text,
  ADD COLUMN IF NOT EXISTS cap_sinistro text,
  ADD COLUMN IF NOT EXISTS data_denuncia date,
  ADD COLUMN IF NOT EXISTS ramo_sinistro text;
