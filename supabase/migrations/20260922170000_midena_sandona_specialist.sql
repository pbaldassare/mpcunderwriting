-- Specialist Maria Midena (backoffice midena@consulbrokers.it):
-- accesso e assegnazione su tutte le risorse della sede San Donà di Piave.
-- Idempotente: lookup per email / codice sede, nessun UUID hardcodato.

DO $$
DECLARE
  v_spec uuid;
  v_sede uuid;
BEGIN
  SELECT id INTO v_spec
  FROM public.profiles
  WHERE lower(email) = 'midena@consulbrokers.it'
    AND ruolo = 'backoffice'
  LIMIT 1;

  IF v_spec IS NULL THEN
    RAISE EXCEPTION 'Profilo specialist midena@consulbrokers.it non trovato';
  END IF;

  SELECT id INTO v_sede
  FROM public.uffici
  WHERE codice_ufficio = 'SD'
     OR nome_ufficio ILIKE '%SAN DON%'
  ORDER BY CASE WHEN codice_ufficio = 'SD' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Sede San Donà di Piave non trovata';
  END IF;

  -- Profilo: nome canonico + sede primaria
  UPDATE public.profiles
  SET nome = 'Maria',
      cognome = 'Midena',
      ufficio_id = v_sede,
      attivo = true
  WHERE id = v_spec
    AND (
      nome IS DISTINCT FROM 'Maria'
      OR cognome IS DISTINCT FROM 'Midena'
      OR ufficio_id IS DISTINCT FROM v_sede
      OR attivo IS DISTINCT FROM true
    );

  INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
  SELECT v_spec, v_sede, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profilo_sedi ps
    WHERE ps.profilo_id = v_spec AND ps.ufficio_id = v_sede
  );

  UPDATE public.profilo_sedi
  SET primaria = true
  WHERE profilo_id = v_spec AND ufficio_id = v_sede AND primaria IS DISTINCT FROM true;

  -- Specialist commerciale su TUTTI i clienti della sede
  INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, profilo_id)
  SELECT c.id, 'Backoffice', v_spec
  FROM public.clienti c
  WHERE c.ufficio_id = v_sede
  ON CONFLICT (cliente_id, ruolo) DO UPDATE
    SET profilo_id = EXCLUDED.profilo_id,
        updated_at = now()
    WHERE public.codici_commerciali_cliente.profilo_id IS DISTINCT FROM EXCLUDED.profilo_id;

  -- Polizze/quietanze della sede: specialist visibile
  UPDATE public.titoli
  SET specialist = 'Midena Maria'
  WHERE ufficio_id = v_sede
    AND coalesce(specialist, '') IS DISTINCT FROM 'Midena Maria';

  -- Copertura specialist sinistri sulla stessa sede
  INSERT INTO public.specialist_sinistri_sedi (profilo_id, ufficio_id, primaria)
  SELECT v_spec, v_sede, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.specialist_sinistri_sedi s
    WHERE s.profilo_id = v_spec AND s.ufficio_id = v_sede
  );

  UPDATE public.specialist_sinistri_sedi
  SET primaria = true
  WHERE profilo_id = v_spec AND ufficio_id = v_sede AND primaria IS DISTINCT FROM true;
END $$;
