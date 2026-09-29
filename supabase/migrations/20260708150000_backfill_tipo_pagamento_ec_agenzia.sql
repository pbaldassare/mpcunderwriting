-- Backfill tipo_pagamento legacy: abbuono/compensato non devono comparire in E/C agenzia.
-- Il mezzo reale (bonifico/contanti) resta su titoli; l'abbuono vive solo in titoli_compensazioni.

-- Bonifico: banca valorizzata in messa a cassa
UPDATE public.titoli
SET tipo_pagamento = 'bonifico',
    updated_at = now()
WHERE tipo_pagamento IN ('compensato', 'misto_compensato')
  AND banca_pagamento IS NOT NULL;

-- Misto con acconti (senza banca esplicita)
UPDATE public.titoli t
SET tipo_pagamento = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.cliente_anticipi_utilizzi u
        WHERE u.titolo_id = t.id
      ) AND COALESCE(t.importo_incassato, 0) > (
        SELECT COALESCE(SUM(u.importo_utilizzato), 0)
        FROM public.cliente_anticipi_utilizzi u
        WHERE u.titolo_id = t.id
      ) THEN 'anticipo_misto'
      WHEN EXISTS (
        SELECT 1 FROM public.cliente_anticipi_utilizzi u
        WHERE u.titolo_id = t.id
      ) THEN 'anticipo'
      ELSE 'contanti'
    END,
    updated_at = now()
WHERE t.tipo_pagamento IN ('compensato', 'misto_compensato')
  AND t.banca_pagamento IS NULL;

-- tipo_pagamento = 'abbuono' legacy (solo quadratura interna): lasciamo il valore;
-- la UI E/C agenzia lo mostra come "Premio saldato" via resolveTipoPagamentoLabelEcAgenzia.
