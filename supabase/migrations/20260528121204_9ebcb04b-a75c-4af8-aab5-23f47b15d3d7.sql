
CREATE OR REPLACE FUNCTION public.titoli_normalizza_importi()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.premio_lordo := ROUND(
    (COALESCE(NEW.premio_netto,0)
     + COALESCE(NEW.tasse,0)
     + COALESCE(NEW.ssn_firma,0)
     + COALESCE(NEW.addizionali,0))::numeric, 2);

  IF NEW.provvigioni_firma IS NOT NULL THEN
    NEW.provvigioni_firma := ROUND(NEW.provvigioni_firma::numeric, 2);
  END IF;
  IF NEW.provvigioni_quietanza IS NOT NULL THEN
    NEW.provvigioni_quietanza := ROUND(NEW.provvigioni_quietanza::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_normalizza_importi ON public.titoli;
CREATE TRIGGER trg_titoli_normalizza_importi
BEFORE INSERT OR UPDATE OF premio_netto, tasse, ssn_firma, addizionali, premio_lordo,
                            provvigioni_firma, provvigioni_quietanza
ON public.titoli
FOR EACH ROW EXECUTE FUNCTION public.titoli_normalizza_importi();

UPDATE public.titoli
SET premio_lordo = ROUND(
      (COALESCE(premio_netto,0)+COALESCE(tasse,0)+COALESCE(ssn_firma,0)+COALESCE(addizionali,0))::numeric, 2),
    provvigioni_firma = CASE WHEN provvigioni_firma IS NOT NULL THEN ROUND(provvigioni_firma::numeric, 2) END,
    provvigioni_quietanza = CASE WHEN provvigioni_quietanza IS NOT NULL THEN ROUND(provvigioni_quietanza::numeric, 2) END
WHERE
  ABS(COALESCE(premio_lordo,0) - ROUND(
    (COALESCE(premio_netto,0)+COALESCE(tasse,0)+COALESCE(ssn_firma,0)+COALESCE(addizionali,0))::numeric, 2)) > 0.005
  OR provvigioni_firma <> ROUND(COALESCE(provvigioni_firma,0)::numeric, 2)
  OR provvigioni_quietanza <> ROUND(COALESCE(provvigioni_quietanza,0)::numeric, 2);
