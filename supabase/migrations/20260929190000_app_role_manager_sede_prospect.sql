-- Ruoli usati dal Centro Utenti che non erano nell'enum app_role.
-- Senza questi valori user_roles rifiuta la riga e l'utente resta senza ruolo di sistema.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'responsabile_sede';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'prospect';
