
-- 1) Collegamento conto bancario su Sedi e Specialist (profiles)
ALTER TABLE public.uffici
  ADD COLUMN IF NOT EXISTS conto_bancario_id uuid REFERENCES public.conti_bancari(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS conto_bancario_id uuid REFERENCES public.conti_bancari(id) ON DELETE SET NULL;

-- 2) Trigger per garantire un solo default per tipo
CREATE OR REPLACE FUNCTION public.enforce_single_default_conto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.conti_bancari
       SET is_default = false
     WHERE tipo = NEW.tipo
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_default_conto ON public.conti_bancari;
CREATE TRIGGER trg_enforce_single_default_conto
BEFORE INSERT OR UPDATE OF is_default, tipo ON public.conti_bancari
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_conto();

-- 3) Funzione per risolvere l'IBAN proposto al cliente
CREATE OR REPLACE FUNCTION public.get_iban_cliente(p_cliente_id uuid)
RETURNS TABLE(iban text, intestato_a text, banca text, bic text, fonte text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_specialist_conto_id uuid;
  v_sede_conto_id uuid;
  v_conto record;
BEGIN
  -- 1) Specialist assegnato al cliente (codici_commerciali_cliente con ruolo Backoffice)
  SELECT p.conto_bancario_id INTO v_specialist_conto_id
  FROM public.codici_commerciali_cliente ccc
  JOIN public.profiles p ON p.id = ccc.profilo_id
  WHERE ccc.cliente_id = p_cliente_id
    AND ccc.ruolo = 'Backoffice'
    AND p.conto_bancario_id IS NOT NULL
  ORDER BY ccc.created_at DESC
  LIMIT 1;

  IF v_specialist_conto_id IS NOT NULL THEN
    SELECT cb.iban, cb.intestato_a, cb.banca, cb.bic INTO v_conto
    FROM public.conti_bancari cb WHERE cb.id = v_specialist_conto_id AND cb.attivo = true;
    IF FOUND THEN
      RETURN QUERY SELECT v_conto.iban, v_conto.intestato_a, COALESCE(v_conto.banca,''), COALESCE(v_conto.bic,''), 'specialist'::text;
      RETURN;
    END IF;
  END IF;

  -- 2) Sede del cliente
  SELECT u.conto_bancario_id INTO v_sede_conto_id
  FROM public.clienti c
  JOIN public.uffici u ON u.id = c.ufficio_id
  WHERE c.id = p_cliente_id
    AND u.conto_bancario_id IS NOT NULL;

  IF v_sede_conto_id IS NOT NULL THEN
    SELECT cb.iban, cb.intestato_a, cb.banca, cb.bic INTO v_conto
    FROM public.conti_bancari cb WHERE cb.id = v_sede_conto_id AND cb.attivo = true;
    IF FOUND THEN
      RETURN QUERY SELECT v_conto.iban, v_conto.intestato_a, COALESCE(v_conto.banca,''), COALESCE(v_conto.bic,''), 'sede'::text;
      RETURN;
    END IF;
  END IF;

  -- 3) Default Consulbrokers (silenzioso)
  SELECT cb.iban, cb.intestato_a, cb.banca, cb.bic INTO v_conto
  FROM public.conti_bancari cb
  WHERE cb.tipo = 'incasso_clienti'
    AND cb.is_default = true
    AND cb.attivo = true
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_conto.iban, v_conto.intestato_a, COALESCE(v_conto.banca,''), COALESCE(v_conto.bic,''), 'default'::text;
    RETURN;
  END IF;

  -- Nessuno
  RETURN QUERY SELECT ''::text, ''::text, ''::text, ''::text, 'nessuno'::text;
END;
$$;

-- 4) Seed: assicura un default Consulbrokers per incassi clienti
INSERT INTO public.conti_bancari (etichetta, iban, intestato_a, banca, tipo, is_default, attivo, note)
SELECT 'Consulbrokers - Incassi Clienti (default)', 'IT00X0000000000000000000000', 'Consulbrokers S.r.l.', 'Da configurare', 'incasso_clienti', true, true, 'Conto di default creato automaticamente. Aggiornare IBAN reale dalla pagina Conti Bancari.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.conti_bancari WHERE tipo = 'incasso_clienti' AND is_default = true AND attivo = true
);
