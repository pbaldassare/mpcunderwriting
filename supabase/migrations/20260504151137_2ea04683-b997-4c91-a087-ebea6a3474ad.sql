SELECT set_config('app.bypass_premi_lock', 'on', true);
SELECT set_config('app.bypass_messa_cassa_lock', 'on', true);

DELETE FROM public.movimenti_polizza WHERE titolo_id NOT IN (SELECT id FROM public.titoli);
DELETE FROM public.provvigioni_generate WHERE titolo_id NOT IN (SELECT id FROM public.titoli);
DELETE FROM public.premi_garanzia_polizza WHERE titolo_id NOT IN (SELECT id FROM public.titoli);
DELETE FROM public.appendici_polizza WHERE titolo_id NOT IN (SELECT id FROM public.titoli);
DELETE FROM public.veicoli_polizza WHERE titolo_id NOT IN (SELECT id FROM public.titoli);
DELETE FROM public.conducenti_polizza WHERE titolo_id NOT IN (SELECT id FROM public.titoli);