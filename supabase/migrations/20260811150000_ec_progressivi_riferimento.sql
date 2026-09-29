-- Progressivi mensili per riferimento E/C agenzia e rendiconto produttore

CREATE TABLE IF NOT EXISTS public.ec_progressivi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('agenzia', 'produttore')),
  entita_id uuid NOT NULL,
  anno_mese text NOT NULL,
  ultimo_numero integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, entita_id, anno_mese)
);

COMMENT ON TABLE public.ec_progressivi IS 'Contatore mensile riferimenti E/C per agenzia o produttore';
COMMENT ON COLUMN public.ec_progressivi.anno_mese IS 'Chiave mese YYYY-MM';

ALTER TABLE public.ec_progressivi ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prossimo_riferimento_ec(
  p_tipo text,
  p_entita_id uuid,
  p_codice text,
  p_mese date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_incrementa boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anno_mese text;
  v_num integer;
  v_codice text;
  v_rif text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non autenticato');
  END IF;

  IF p_tipo NOT IN ('agenzia', 'produttore') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tipo non valido');
  END IF;

  IF p_entita_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'entita_id obbligatorio');
  END IF;

  v_anno_mese := to_char(p_mese, 'YYYY-MM');
  v_codice := NULLIF(trim(p_codice), '');
  IF v_codice IS NULL THEN
    v_codice := 'REF';
  END IF;

  IF p_incrementa THEN
    INSERT INTO public.ec_progressivi (tipo, entita_id, anno_mese, ultimo_numero)
    VALUES (p_tipo, p_entita_id, v_anno_mese, 1)
    ON CONFLICT (tipo, entita_id, anno_mese)
    DO UPDATE SET
      ultimo_numero = ec_progressivi.ultimo_numero + 1,
      updated_at = now()
    RETURNING ultimo_numero INTO v_num;
  ELSE
    SELECT ultimo_numero INTO v_num
    FROM public.ec_progressivi
    WHERE tipo = p_tipo
      AND entita_id = p_entita_id
      AND anno_mese = v_anno_mese;

    v_num := COALESCE(v_num, 0) + 1;
  END IF;

  v_rif := v_codice || '/' || to_char(p_mese, 'YYMM') || lpad(v_num::text, 2, '0');

  RETURN jsonb_build_object(
    'ok', true,
    'numero', v_num,
    'riferimento', v_rif
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prossimo_riferimento_ec(text, uuid, text, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prossimo_riferimento_ec(text, uuid, text, date, boolean) TO service_role;

COMMENT ON FUNCTION public.prossimo_riferimento_ec IS
  'Alloca o anteprima riferimento E/C progressivo per entità/mese. Formato: CODICE/YYMMNN';
