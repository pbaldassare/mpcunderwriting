CREATE OR REPLACE FUNCTION public.validate_clienti_tipo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_cliente NOT IN ('privato', 'azienda', 'ente') THEN
    RAISE EXCEPTION 'Invalid tipo_cliente: %', NEW.tipo_cliente;
  END IF;
  RETURN NEW;
END;
$function$;