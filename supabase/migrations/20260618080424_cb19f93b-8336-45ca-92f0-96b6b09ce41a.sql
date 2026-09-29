CREATE OR REPLACE VIEW public.v_portafoglio_titoli AS
WITH base AS (
  SELECT t.id,
    t.numero_titolo, t.cliente_id, t.prodotto_id, t.ufficio_id, t.produttore_id,
    t.premio_lordo, t.importo_incassato, t.data_incasso, t.stato, t.note,
    t.created_at, t.updated_at, t.search_vector, t.cliente_anagrafica_id,
    t.data_scadenza, t.compagnia_id, t.ramo_id, t.specialist, t.tipo_portafoglio,
    t.cig_rif, t.vincolo, t.descrizione_polizza, t.appendice, t.riga,
    t.targa_telaio, t.durata_da, t.durata_a, t.anni_durata,
    t.garanzia_da, t.garanzia_a, t.data_competenza, t.limite_mora, t.mora_giorni,
    t.rate, t.tipo_rinnovo, t.disdetta_mesi, t.regolazione, t.tipo_lettera_regolazione,
    t.tipo_scadenza, t.giorni_presentazione, t.periodicita, t.libro_matricola,
    t.rimborso, t.valuta, t.cambio, t.indicizzata, t.no_calcolo_tasse,
    t.premio_netto, t.addizionali, t.tasse, t.provvigioni_firma, t.provvigioni_quietanza,
    t.premio_netto_quietanza, t.addizionali_quietanza, t.tasse_quietanza,
    t.pag_diretto_compagnia, t.emissione_fee, t.formato_elettronico,
    t.sostituisce_polizza, t.sostituisce_riga, t.sostituisce_appendice,
    t.storno_polizza, t.storno_riga, t.storno_appendice,
    t.commerciale_id, t.percentuale_commerciale, t.percentuale_riparto,
    t.tipo_mandatario, t.risk_type, t.prodotto_nome, t.comp_contabile, t.comp_assicurativa,
    t.tipo_incasso, t.conto_incasso, t.id_legacy, t.produttore_nome, t.ae_nome, t.filiale,
    t.data_sospensione, t.limite_riattivazione, t.data_riattivazione, t.motivo_sospensione,
    t.data_messa_cassa, t.data_pagamento, t.data_decorrenza_rinnovo,
    t.anagrafica_commerciale_id, t.tipo_pagamento, t.banca_pagamento,
    t.conferimento_gestito, t.fondi_ricevuti, t.data_conferimento_gestito,
    t.tacito_rinnovo, t.vincolo_attivo,
    LEAST(COALESCE(t.garanzia_a, t.data_scadenza, t.durata_a), COALESCE(t.data_scadenza, t.garanzia_a, t.durata_a)) AS fine_periodo_effettivo,
    t.is_regolazione, t.regolazione_quietanza_id
  FROM titoli t
)
SELECT b.id, b.numero_titolo, b.cliente_id, b.prodotto_id, b.ufficio_id, b.produttore_id,
  b.premio_lordo, b.importo_incassato, b.data_incasso, b.stato, b.note,
  b.created_at, b.updated_at, b.search_vector, b.cliente_anagrafica_id,
  b.data_scadenza, b.compagnia_id, b.ramo_id, b.specialist, b.tipo_portafoglio,
  b.cig_rif, b.vincolo, b.descrizione_polizza, b.appendice, b.riga,
  b.targa_telaio, b.durata_da, b.durata_a, b.anni_durata,
  b.garanzia_da, b.garanzia_a, b.data_competenza, b.limite_mora, b.mora_giorni,
  b.rate, b.tipo_rinnovo, b.disdetta_mesi, b.regolazione, b.tipo_lettera_regolazione,
  b.tipo_scadenza, b.giorni_presentazione, b.periodicita, b.libro_matricola,
  b.rimborso, b.valuta, b.cambio, b.indicizzata, b.no_calcolo_tasse,
  b.premio_netto, b.addizionali, b.tasse, b.provvigioni_firma, b.provvigioni_quietanza,
  b.premio_netto_quietanza, b.addizionali_quietanza, b.tasse_quietanza,
  b.pag_diretto_compagnia, b.emissione_fee, b.formato_elettronico,
  b.sostituisce_polizza, b.sostituisce_riga, b.sostituisce_appendice,
  b.storno_polizza, b.storno_riga, b.storno_appendice,
  b.commerciale_id, b.percentuale_commerciale, b.percentuale_riparto,
  b.tipo_mandatario, b.risk_type, b.prodotto_nome, b.comp_contabile, b.comp_assicurativa,
  b.tipo_incasso, b.conto_incasso, b.id_legacy, b.produttore_nome, b.ae_nome, b.filiale,
  b.data_sospensione, b.limite_riattivazione, b.data_riattivazione, b.motivo_sospensione,
  b.data_messa_cassa, b.data_pagamento, b.data_decorrenza_rinnovo,
  b.anagrafica_commerciale_id, b.tipo_pagamento, b.banca_pagamento,
  b.conferimento_gestito, b.fondi_ricevuti, b.data_conferimento_gestito,
  b.tacito_rinnovo, b.vincolo_attivo, b.fine_periodo_effettivo,
  COALESCE(c.ragione_sociale, NULLIF(TRIM(BOTH FROM (COALESCE(c.cognome, ''::text) || ' '::text) || COALESCE(c.nome, ''::text)), ''::text)) AS cliente_nome_display,
  c.codice_fiscale AS cliente_codice_fiscale,
  c.partita_iva AS cliente_partita_iva,
  c.tipo_cliente AS cliente_tipo,
  c.codice_ricerca AS cliente_codice,
  c.cognome AS cliente_cognome,
  c.nome AS cliente_nome,
  c.ragione_sociale AS cliente_ragione_sociale,
  comp.nome AS compagnia_nome,
  comp.codice AS compagnia_codice,
  r.descrizione AS ramo_descrizione,
  r.descrizione AS ramo_nome,
  r.codice AS ramo_codice,
  gr.codice AS gruppo_ramo,
  gr.id AS gruppo_ramo_id,
  gr.descrizione AS gruppo_ramo_descrizione,
  uff.nome_ufficio AS ufficio_nome,
  uff.nome_ufficio,
  (b.fine_periodo_effettivo + '1 day'::interval)::date AS prossima_garanzia_da,
  CASE
    WHEN b.rate = 1 THEN (b.fine_periodo_effettivo + '1 day'::interval + '1 year'::interval - '1 day'::interval)::date
    WHEN b.rate = 2 THEN (b.fine_periodo_effettivo + '1 day'::interval + '6 mons'::interval - '1 day'::interval)::date
    WHEN b.rate = 3 THEN (b.fine_periodo_effettivo + '1 day'::interval + '4 mons'::interval - '1 day'::interval)::date
    WHEN b.rate = 4 THEN (b.fine_periodo_effettivo + '1 day'::interval + '3 mons'::interval - '1 day'::interval)::date
    WHEN b.rate = 12 THEN (b.fine_periodo_effettivo + '1 day'::interval + '1 mon'::interval - '1 day'::interval)::date
    ELSE (b.fine_periodo_effettivo + '1 day'::interval + '1 year'::interval - '1 day'::interval)::date
  END AS prossima_garanzia_a,
  to_char((b.fine_periodo_effettivo + '1 day'::interval)::date::timestamp with time zone, 'YYYY-MM'::text) AS mese_carico,
  CASE
    WHEN b.fine_periodo_effettivo IS NOT NULL AND b.fine_periodo_effettivo < (CURRENT_DATE - '7 days'::interval)::date AND b.stato = 'incassato'::text THEN false
    ELSE true
  END AS premi_modificabili,
  b.is_regolazione,
  b.regolazione_quietanza_id
FROM base b
  LEFT JOIN clienti c ON c.id = b.cliente_anagrafica_id
  LEFT JOIN compagnie comp ON comp.id = b.compagnia_id
  LEFT JOIN rami r ON r.id = b.ramo_id
  LEFT JOIN gruppi_ramo gr ON gr.id = r.gruppo_ramo_id
  LEFT JOIN uffici uff ON uff.id = b.ufficio_id;