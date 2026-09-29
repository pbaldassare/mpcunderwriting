CREATE OR REPLACE FUNCTION public.anticipi_init_residuo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Partite a debito (−): non utilizzabili come credito → residuo 0
  IF COALESCE(NEW.segno, '+') = '-' THEN
    NEW.importo_residuo := 0;
    RETURN NEW;
  END IF;
  IF NEW.importo_residuo IS NULL OR NEW.importo_residuo = 0 THEN
    NEW.importo_residuo := NEW.importo;
  END IF;
  RETURN NEW;
END;
$$;
