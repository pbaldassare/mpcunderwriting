-- Hard delete anagrafiche Paolo Baldassare e Samantha Gastaldello con tutto lo storico
DELETE FROM public.titoli 
WHERE cliente_anagrafica_id IN (
  '0cfddc67-bffb-4685-a259-86bcd4261f5b'::uuid,
  '42f594c0-d7a9-40a5-a9b0-a182083f4f35'::uuid
);

DELETE FROM public.clienti 
WHERE id IN (
  '0cfddc67-bffb-4685-a259-86bcd4261f5b'::uuid,
  '42f594c0-d7a9-40a5-a9b0-a182083f4f35'::uuid
);