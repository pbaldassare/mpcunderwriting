ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_ruolo_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ruolo_check
  CHECK (ruolo = ANY (ARRAY['admin','ufficio','produttore','contabilita','cfo','cliente','backoffice','prospect','corrispondente']));
UPDATE public.profiles SET ruolo='prospect' WHERE id='746c540d-7e65-417d-9834-39612c13213a';