
-- Popolare titoli esistenti con dati realistici
UPDATE public.titoli SET
  compagnia_id = (SELECT p.compagnia_id FROM prodotti p WHERE p.id = titoli.prodotto_id),
  ramo_id = (SELECT id FROM rami WHERE attivo = true ORDER BY random() LIMIT 1),
  durata_da = created_at::date,
  durata_a = (created_at::date + interval '1 year')::date,
  anni_durata = 1,
  garanzia_da = created_at::date,
  garanzia_a = (created_at::date + interval '1 year')::date,
  data_competenza = created_at::date,
  limite_mora = (created_at::date + interval '1 year' + interval '15 days')::date,
  mora_giorni = 15,
  rate = 1,
  tipo_rinnovo = 'tacito_rinnovo',
  disdetta_mesi = 2,
  periodicita = 'annuale',
  libro_matricola = 'no',
  valuta = 'EUR',
  cambio = 1,
  premio_netto = ROUND(COALESCE(premio_lordo, 0) * 0.78, 2),
  addizionali = ROUND(COALESCE(premio_lordo, 0) * 0.03, 2),
  tasse = ROUND(COALESCE(premio_lordo, 0) * 0.22, 2),
  provvigioni_firma = ROUND(COALESCE(premio_lordo, 0) * 0.78 * 0.10, 2),
  provvigioni_quietanza = ROUND(COALESCE(premio_lordo, 0) * 0.78 * 0.08, 2),
  premio_netto_quietanza = ROUND(COALESCE(premio_lordo, 0) * 0.78, 2),
  addizionali_quietanza = ROUND(COALESCE(premio_lordo, 0) * 0.03, 2),
  tasse_quietanza = ROUND(COALESCE(premio_lordo, 0) * 0.22, 2),
  tipo_portafoglio = 'diretto',
  specialist = CASE (random() * 3)::int WHEN 0 THEN 'danni' WHEN 1 THEN 'vita' ELSE 'auto' END,
  riga = 0,
  appendice = '000'
WHERE compagnia_id IS NULL;

-- Inserire dettaglio_riparto per ogni titolo (quota 100%)
INSERT INTO public.dettaglio_riparto (titolo_id, compagnia_id, quota_percentuale, perc_provv_netto, perc_provv_addizionali, netto, addizionali, tasse, totale, provv_netto, provv_addizionali, tipo_pagamento)
SELECT 
  t.id,
  t.compagnia_id,
  100,
  10,
  5,
  COALESCE(t.premio_netto, 0),
  COALESCE(t.addizionali, 0),
  COALESCE(t.tasse, 0),
  COALESCE(t.premio_lordo, 0),
  COALESCE(t.provvigioni_firma, 0),
  ROUND(COALESCE(t.addizionali, 0) * 0.05, 2),
  'C'
FROM titoli t
WHERE t.compagnia_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dettaglio_riparto dr WHERE dr.titolo_id = t.id);
