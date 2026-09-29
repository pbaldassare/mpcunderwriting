-- Il wizard del Centro Utenti assegna anche manager e responsabile_sede.
-- profiles.ruolo è testo con un CHECK: senza questi valori la creazione fallisce.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_ruolo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ruolo_check
  CHECK (ruolo = ANY (ARRAY[
    'admin'::text,
    'ufficio'::text,
    'produttore'::text,
    'contabilita'::text,
    'cfo'::text,
    'cliente'::text,
    'backoffice'::text,
    'prospect'::text,
    'corrispondente'::text,
    'manager'::text,
    'responsabile_sede'::text
  ]));
