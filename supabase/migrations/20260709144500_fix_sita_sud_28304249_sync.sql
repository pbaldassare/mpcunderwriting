-- Bonifica SITA SUD 28304249: allinea quietanza rata 1 al titolo incassato
-- e mantiene rata 2 in da_incassare (non incassati / portafoglio carico).

DO $$
BEGIN
  -- Quietanza rata 1 → titolo incassato reale
  UPDATE public.quietanze
  SET
    titolo_id = '7cc87dab-2359-4821-a2fb-23488ece58ae',
    stato = 'incassato',
    data_messa_cassa = '2026-06-18',
    data_pagamento = '2026-06-18',
    data_incasso = '2026-06-18',
    data_copertura = '2026-06-18',
    importo_incassato = 1322204.49,
    updated_at = now()
  WHERE id = 'f10b4488-4a60-44cc-8bb9-1634aa37838a'
    AND titolo_id IS DISTINCT FROM '7cc87dab-2359-4821-a2fb-23488ece58ae';

  UPDATE public.titoli
  SET polizza_id = 'dbf71a4c-ae09-4727-b810-158fc877cb75',
      updated_at = now()
  WHERE id = '7cc87dab-2359-4821-a2fb-23488ece58ae'
    AND polizza_id IS NULL;

  -- Madre = shell contrattuale
  UPDATE public.titoli
  SET
    stato = 'attivo',
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    data_copertura = NULL,
    conferimento_gestito = false,
    updated_at = now()
  WHERE id = 'e199ad6d-d6dc-4456-a6dc-34988eda35eb'
    AND (stato = 'incassato' OR data_messa_cassa IS NOT NULL);

  -- Rata 2 esplicitamente da incassare
  UPDATE public.quietanze
  SET
    stato = 'da_incassare',
    data_messa_cassa = NULL,
    data_pagamento = NULL,
    data_incasso = NULL,
    importo_incassato = NULL,
    data_copertura = NULL,
    updated_at = now()
  WHERE id = '62206d7d-0319-41dd-a3a0-0e997a0e8e70'
    AND stato IS DISTINCT FROM 'da_incassare';

  UPDATE public.titoli
  SET
    stato = 'attivo',
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    data_copertura = NULL,
    conferimento_gestito = false,
    updated_at = now()
  WHERE id = 'b6caed63-1325-470b-a24f-471a0c12b72d'
    AND (stato = 'incassato' OR data_messa_cassa IS NOT NULL);

  UPDATE public.provvigioni_generate
  SET quietanza_id = 'f10b4488-4a60-44cc-8bb9-1634aa37838a'
  WHERE titolo_id = '7cc87dab-2359-4821-a2fb-23488ece58ae'
    AND quietanza_id IS NULL;
END $$;
