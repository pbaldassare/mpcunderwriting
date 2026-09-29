-- Backfill data_copertura / data_incasso su titoli già messi a cassa.
-- Regole:
--   Incasso diretto: data_copertura = data_messa_cassa (se mancante).
--   Garantito poi incassato: conserva data_copertura (o data_conferimento_gestito); data_incasso = data_messa_cassa.

-- Garantito incassato senza data_copertura: recupera dal giorno conferimento.
UPDATE public.titoli
SET data_copertura = data_conferimento_gestito,
    updated_at = now()
WHERE data_messa_cassa IS NOT NULL
  AND data_copertura IS NULL
  AND COALESCE(conferimento_gestito, false) = true
  AND data_conferimento_gestito IS NOT NULL;

-- Incasso diretto (o garantito senza storico conferimento): copertura = messa a cassa.
UPDATE public.titoli
SET data_copertura = data_messa_cassa,
    updated_at = now()
WHERE data_messa_cassa IS NOT NULL
  AND data_copertura IS NULL;

-- Allinea data_incasso alla messa a cassa storica.
UPDATE public.titoli
SET data_incasso = data_messa_cassa,
    updated_at = now()
WHERE data_messa_cassa IS NOT NULL
  AND data_incasso IS NULL;

-- Propaga su quietanze collegate.
UPDATE public.quietanze q
SET
  data_copertura = t.data_copertura,
  data_incasso = COALESCE(q.data_incasso, t.data_incasso),
  data_messa_cassa = COALESCE(q.data_messa_cassa, t.data_messa_cassa),
  updated_at = now()
FROM public.titoli t
WHERE q.titolo_id = t.id
  AND t.data_messa_cassa IS NOT NULL
  AND (
    q.data_copertura IS DISTINCT FROM t.data_copertura
    OR (q.data_incasso IS NULL AND t.data_incasso IS NOT NULL)
    OR (q.data_messa_cassa IS NULL AND t.data_messa_cassa IS NOT NULL)
  );

-- Sync incasso titolo → quietanza: include data_copertura.
CREATE OR REPLACE FUNCTION public.trg_titoli_sync_quietanza_da_titolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    NEW.stato IS DISTINCT FROM OLD.stato
    OR NEW.data_messa_cassa IS DISTINCT FROM OLD.data_messa_cassa
    OR NEW.data_incasso IS DISTINCT FROM OLD.data_incasso
    OR NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento
    OR NEW.data_copertura IS DISTINCT FROM OLD.data_copertura
    OR NEW.importo_incassato IS DISTINCT FROM OLD.importo_incassato
    OR NEW.tipo_pagamento IS DISTINCT FROM OLD.tipo_pagamento
    OR NEW.banca_pagamento IS DISTINCT FROM OLD.banca_pagamento
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.quietanze q SET
    stato = CASE NEW.stato
      WHEN 'incassato' THEN 'incassato'::public.quietanza_stato
      WHEN 'sospeso' THEN 'sospesa'::public.quietanza_stato
      WHEN 'annullato' THEN 'annullata'::public.quietanza_stato
      ELSE 'da_incassare'::public.quietanza_stato
    END,
    data_messa_cassa = NEW.data_messa_cassa,
    data_incasso = NEW.data_incasso,
    data_pagamento = NEW.data_pagamento,
    data_copertura = NEW.data_copertura,
    importo_incassato = NEW.importo_incassato,
    tipo_incasso = NEW.tipo_pagamento,
    conto_incasso = NEW.banca_pagamento,
    updated_at = now()
  WHERE q.titolo_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_sync_quietanza_da_titolo ON public.titoli;
CREATE TRIGGER trg_titoli_sync_quietanza_da_titolo
  AFTER UPDATE OF stato, data_messa_cassa, data_incasso, data_pagamento, data_copertura,
    importo_incassato, tipo_pagamento, banca_pagamento
  ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_titoli_sync_quietanza_da_titolo();
