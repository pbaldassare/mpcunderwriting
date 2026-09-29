-- Riforma alla scadenza (default off)
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS riforma_alla_scadenza boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.titoli.riforma_alla_scadenza IS
  'Se true, la polizza prevede riforma automatica alla scadenza.';

-- Disdetta: da mesi a giorni (preavviso)
ALTER TABLE public.titoli
  RENAME COLUMN disdetta_mesi TO disdetta_giorni;

-- Valori storici erano mesi (tipicamente 2–3); valori >12 lasciati invariati (già giorni o edge case)
UPDATE public.titoli
SET disdetta_giorni = disdetta_giorni * 30
WHERE disdetta_giorni IS NOT NULL
  AND disdetta_giorni > 0
  AND disdetta_giorni <= 12;

COMMENT ON COLUMN public.titoli.disdetta_giorni IS
  'Giorni di preavviso per la disdetta prima della scadenza.';

-- Legacy polizze table (se presente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'polizze' AND column_name = 'disdetta_mesi'
  ) THEN
    ALTER TABLE public.polizze RENAME COLUMN disdetta_mesi TO disdetta_giorni;
    UPDATE public.polizze
    SET disdetta_giorni = disdetta_giorni * 30
    WHERE disdetta_giorni IS NOT NULL
      AND disdetta_giorni > 0
      AND disdetta_giorni <= 12;
  END IF;
END $$;

-- Aggiorna trigger che copiano disdetta su quietanze generate
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc LIKE '%disdetta_mesi%'
  LOOP
    EXECUTE replace(
      pg_get_functiondef(r.oid),
      'disdetta_mesi',
      'disdetta_giorni'
    );
  END LOOP;
END $$;

-- Ricrea view portafoglio (colonna rinominata)
DROP VIEW IF EXISTS public.v_portafoglio_titoli;

CREATE VIEW public.v_portafoglio_titoli AS
WITH base AS (
  SELECT
    t.id, t.numero_titolo, t.cliente_id, t.prodotto_id, t.ufficio_id, t.produttore_id,
    t.premio_lordo, t.importo_incassato, t.data_incasso, t.stato, t.note, t.created_at, t.updated_at,
    t.search_vector, t.cliente_anagrafica_id, t.data_scadenza, t.compagnia_id, t.ramo_id, t.specialist,
    t.tipo_portafoglio, t.cig_rif, t.vincolo, t.descrizione_polizza, t.appendice, t.riga, t.targa_telaio,
    t.durata_da, t.durata_a, t.anni_durata, t.garanzia_da, t.garanzia_a, t.data_competenza, t.limite_mora,
    t.mora_giorni, t.rate, t.tipo_rinnovo, t.disdetta_giorni, t.regolazione, t.tipo_lettera_regolazione,
    t.tipo_scadenza, t.giorni_presentazione, t.periodicita, t.libro_matricola, t.rimborso, t.valuta, t.cambio,
    t.indicizzata, t.no_calcolo_tasse, t.premio_netto, t.addizionali, t.tasse, t.provvigioni_firma,
    t.provvigioni_quietanza, t.premio_netto_quietanza, t.addizionali_quietanza, t.tasse_quietanza,
    t.pag_diretto_compagnia, t.emissione_fee, t.formato_elettronico, t.sostituisce_polizza, t.sostituisce_riga,
    t.sostituisce_appendice, t.storno_polizza, t.storno_riga, t.storno_appendice, t.commerciale_id,
    t.percentuale_commerciale, t.percentuale_riparto, t.tipo_mandatario, t.risk_type, t.prodotto_nome,
    t.comp_contabile, t.comp_assicurativa, t.tipo_incasso, t.conto_incasso, t.id_legacy, t.produttore_nome,
    t.ae_nome, t.filiale, t.data_sospensione, t.limite_riattivazione, t.data_riattivazione, t.motivo_sospensione,
    t.data_messa_cassa, t.data_pagamento, t.data_decorrenza_rinnovo, t.anagrafica_commerciale_id, t.tipo_pagamento,
    t.banca_pagamento, t.conferimento_gestito, t.fondi_ricevuti, t.data_conferimento_gestito, t.tacito_rinnovo,
    t.vincolo_attivo,
    LEAST(
      COALESCE(t.garanzia_a, t.data_scadenza, t.durata_a),
      COALESCE(t.data_scadenza, t.garanzia_a, t.durata_a)
    ) AS fine_periodo_effettivo,
    t.is_regolazione, t.regolazione_quietanza_id
  FROM public.titoli t
)
SELECT
  b.*,
  COALESCE(c.ragione_sociale, NULLIF(TRIM(BOTH FROM (COALESCE(c.cognome, '') || ' ' || COALESCE(c.nome, ''))), '')) AS cliente_nome_display,
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
  (b.fine_periodo_effettivo + INTERVAL '1 day')::date AS prossima_garanzia_da,
  CASE
    WHEN b.rate = 1 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '1 year' - INTERVAL '1 day')::date
    WHEN b.rate = 2 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '6 months' - INTERVAL '1 day')::date
    WHEN b.rate = 3 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '4 months' - INTERVAL '1 day')::date
    WHEN b.rate = 4 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '3 months' - INTERVAL '1 day')::date
    WHEN b.rate = 12 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '1 month' - INTERVAL '1 day')::date
    ELSE (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '1 year' - INTERVAL '1 day')::date
  END AS prossima_garanzia_a,
  to_char((b.fine_periodo_effettivo + INTERVAL '1 day')::date, 'YYYY-MM') AS mese_carico,
  CASE
    WHEN b.fine_periodo_effettivo IS NOT NULL
      AND b.fine_periodo_effettivo < (CURRENT_DATE - INTERVAL '7 days')::date
      AND b.stato = 'incassato'
    THEN false
    ELSE true
  END AS premi_modificabili
FROM base b
LEFT JOIN public.clienti c ON c.id = b.cliente_anagrafica_id
LEFT JOIN public.compagnie comp ON comp.id = b.compagnia_id
LEFT JOIN public.rami r ON r.id = b.ramo_id
LEFT JOIN public.gruppi_ramo gr ON gr.id = r.gruppo_ramo_id
LEFT JOIN public.uffici uff ON uff.id = b.ufficio_id;
