-- Pulizia rimesse vuote create per bug "metti_in_pagamento" con importo_incassato NULL
DELETE FROM public.rimessa_dettaglio WHERE rimessa_id IN ('191e6b3c-3d9a-49bc-a10f-e841bf60b47d','f218e86e-1f8e-4f0a-980e-945c5dc69a15');
DELETE FROM public.rimessa_premi WHERE id IN ('191e6b3c-3d9a-49bc-a10f-e841bf60b47d','f218e86e-1f8e-4f0a-980e-945c5dc69a15');

-- Ricalcolo importo dettaglio + totale per la rimessa rimasta usando premio_lordo come fallback
UPDATE public.rimessa_dettaglio rd
SET importo = COALESCE(t.importo_incassato, t.premio_lordo, 0)
FROM public.titoli t
WHERE rd.titolo_id = t.id
  AND rd.rimessa_id = '17948caf-f97e-476e-80a2-b37b9e369d79'
  AND (rd.importo IS NULL OR rd.importo = 0);

UPDATE public.rimessa_premi rp
SET totale_importi = ROUND(COALESCE((SELECT SUM(importo) FROM public.rimessa_dettaglio WHERE rimessa_id = rp.id), 0)::numeric, 2)
WHERE rp.id = '17948caf-f97e-476e-80a2-b37b9e369d79';