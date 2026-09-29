INSERT INTO public.uffici (nome_ufficio, codice_ufficio, citta, provincia, attivo)
VALUES ('SEDE MILANO', 'MI', 'Milano', 'MI', true)
ON CONFLICT DO NOTHING;