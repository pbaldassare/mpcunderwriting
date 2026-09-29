
-- Replace check constraint with a more permissive one that includes legacy states
ALTER TABLE public.titoli DROP CONSTRAINT titoli_stato_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_stato_check 
  CHECK (stato IN ('creato','incassato','stornato','annullato','attivo','sospeso','scaduto'));
