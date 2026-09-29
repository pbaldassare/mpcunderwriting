-- Eliminazione totale polizza 184667297 (id 4469957b-0d8b-49df-808d-673be95c965e) e residui
DELETE FROM public.premi_garanzia_polizza WHERE titolo_id = '4469957b-0d8b-49df-808d-673be95c965e';
DELETE FROM public.log_attivita WHERE entita_tipo = 'titolo' AND entita_id = '4469957b-0d8b-49df-808d-673be95c965e';
DELETE FROM public.titoli WHERE id = '4469957b-0d8b-49df-808d-673be95c965e';