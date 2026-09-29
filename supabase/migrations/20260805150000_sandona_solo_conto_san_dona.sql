-- SEDE SAN DONA' DI PIAVE: solo Conto san donà (IBAN IT68V0890436281061015010777)
-- Unlink Valsabbina / BCC ROMA dalla N:N; allinea uffici.conto_bancario_id.
-- Non cancella movimenti storici su altri conti.

DO $$
DECLARE
  v_ufficio_id uuid := '327e92f7-64f0-48b9-9e48-73611d8cb406';
  v_conto_sd uuid;
BEGIN
  SELECT id INTO v_conto_sd
  FROM public.conti_bancari
  WHERE replace(upper(iban), ' ', '') = 'IT68V0890436281061015010777'
  LIMIT 1;

  IF v_conto_sd IS NULL THEN
    RAISE EXCEPTION 'Conto san donà non trovato per IBAN IT68V0890436281061015010777';
  END IF;

  UPDATE public.uffici
  SET conto_bancario_id = v_conto_sd
  WHERE id = v_ufficio_id;

  DELETE FROM public.conti_bancari_uffici
  WHERE ufficio_id = v_ufficio_id
    AND conto_bancario_id <> v_conto_sd;

  INSERT INTO public.conti_bancari_uffici (conto_bancario_id, ufficio_id)
  VALUES (v_conto_sd, v_ufficio_id)
  ON CONFLICT DO NOTHING;
END $$;
