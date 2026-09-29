-- Backfill: titoli incassati solo con acconti da conto bancario → tipo_pagamento bonifico
-- (allinea dati storici per E/C agenzia e filtri; es. Poletto/Rovesta)

UPDATE public.titoli t
SET tipo_pagamento = 'bonifico', updated_at = now()
WHERE t.tipo_pagamento = 'anticipo'
  AND t.stato = 'incassato'
  AND EXISTS (
    SELECT 1
    FROM public.cliente_anticipi_utilizzi u
    JOIN public.cliente_anticipi ca ON ca.id = u.anticipo_id
    WHERE u.titolo_id = t.id
      AND ca.conto_bancario_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.cliente_anticipi_utilizzi u2
    JOIN public.cliente_anticipi ca2 ON ca2.id = u2.anticipo_id
    WHERE u2.titolo_id = t.id
      AND ca2.conto_bancario_id IS NULL
  );
