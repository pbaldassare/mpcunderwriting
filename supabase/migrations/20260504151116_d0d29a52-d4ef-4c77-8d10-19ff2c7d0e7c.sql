-- Cancellazione totale di tutti i titoli e dei record dipendenti via CASCADE
SET session_replication_role = 'replica';
SELECT set_config('app.bypass_premi_lock', 'on', true);
SELECT set_config('app.bypass_messa_cassa_lock', 'on', true);

DELETE FROM public.titoli;

SET session_replication_role = 'origin';