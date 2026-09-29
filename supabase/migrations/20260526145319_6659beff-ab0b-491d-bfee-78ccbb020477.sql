ALTER TABLE public.titoli ADD COLUMN IF NOT EXISTS percentuale_ae numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name LIKE 'provvigioni_generate_tipo_destinatario%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.provvigioni_generate DROP CONSTRAINT ' || quote_ident(constraint_name)
      FROM information_schema.check_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name LIKE 'provvigioni_generate_tipo_destinatario%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.provvigioni_generate
  ADD CONSTRAINT provvigioni_generate_tipo_destinatario_check
  CHECK (tipo_destinatario IN ('commerciale','admin','consul','sede','ae'));