
ALTER TABLE public.anagrafiche_professionali
  ADD COLUMN codice text,
  ADD COLUMN nome_breve text,
  ADD COLUMN referente_nome text,
  ADD COLUMN referente_email text;
