-- Add percentuale_consulenza column
ALTER TABLE public.anagrafiche_professionali 
  ADD COLUMN IF NOT EXISTS percentuale_consulenza numeric(5,2) DEFAULT 0;

-- Replace the validation trigger to support new commercial types
CREATE OR REPLACE FUNCTION public.validate_anagrafiche_professionali_tipo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo NOT IN ('liquidatore','perito','legale','account_executive','corrispondente','executive','responsabile_sede','produttore_sede') THEN
    RAISE EXCEPTION 'Invalid tipo: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$function$;