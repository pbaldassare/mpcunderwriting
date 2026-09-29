
CREATE OR REPLACE VIEW public.v_portafoglio_titoli AS
SELECT 
  t.id,
  t.numero_titolo,
  t.stato,
  t.premio_lordo,
  t.garanzia_da,
  t.garanzia_a,
  t.data_scadenza,
  t.compagnia_id,
  t.ramo_id,
  t.ufficio_id,
  t.cliente_anagrafica_id,
  t.ae_nome,
  t.specialist,
  t.produttore_nome,
  t.provvigioni_firma,
  t.provvigioni_quietanza,
  t.filiale,
  t.targa_telaio,
  t.rate,
  c.nome AS compagnia_nome,
  r.descrizione AS ramo_nome,
  COALESCE(cli.ragione_sociale, TRIM(COALESCE(cli.cognome, '') || ' ' || COALESCE(cli.nome, ''))) AS cliente_nome_display,
  cli.codice_ricerca AS cliente_codice
FROM titoli t
LEFT JOIN compagnie c ON c.id = t.compagnia_id
LEFT JOIN rami r ON r.id = t.ramo_id
LEFT JOIN clienti cli ON cli.id = t.cliente_anagrafica_id;
