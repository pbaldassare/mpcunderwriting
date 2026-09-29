
-- Seed garanzia principale per ogni gruppo ramo non-RCA (idempotente via codice+gruppo_ramo_id)
INSERT INTO public.rca_garanzie (codice, descrizione, aliquota_tasse, attivo, gruppo_ramo_id)
SELECT v.codice, v.descrizione, v.aliquota_tasse, true, gr.id
FROM (VALUES
  ('ZD', 'CORPI',     'Corpi',                              21.25),
  ('ZL', 'INC',       'Incendio Furto Rischi Tecnologici',  21.25),
  ('ZN', 'INF',       'Infortuni',                           2.50),
  ('ZM', 'MAL',       'Malattia',                            2.50),
  ('ZP', 'RCT',       'R.C. Terzi',                         21.25),
  ('ZS', 'TG',        'Tutela Giudiziaria',                 21.25),
  ('ZC', 'CRC',       'Credito / Cauzioni',                 21.25),
  ('ZT', 'TRA',       'Trasporti',                           7.50),
  ('ZV', 'VITA',      'Vita',                                2.50),
  ('ZY', 'ALTRI',     'Altri Rami Danni',                   21.25),
  ('DI', 'ASS',       'Assistenza',                         10.00)
) AS v(gruppo_codice, codice, descrizione, aliquota_tasse)
JOIN public.gruppi_ramo gr ON gr.codice = v.gruppo_codice
WHERE NOT EXISTS (
  SELECT 1 FROM public.rca_garanzie rg
  WHERE rg.gruppo_ramo_id = gr.id AND rg.codice = v.codice
);
