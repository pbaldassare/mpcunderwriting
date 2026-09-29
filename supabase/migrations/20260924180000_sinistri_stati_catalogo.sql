-- Catalogo stati sinistro: voci operative CAPS + legacy (stesso slug).
-- CHIUSO SENZA SEGUITO una sola volta. CHECK allargato, RLS/report invariati.

ALTER TABLE public.sinistri DROP CONSTRAINT IF EXISTS sinistri_stato_check;
ALTER TABLE public.sinistri ADD CONSTRAINT sinistri_stato_check
  CHECK (stato IN (
    'apertura_cautelativa',
    'apertura_sinistro',
    'archiviato',
    'atto_di_citazione',
    'card_attivo',
    'card_passivo',
    'chiuso',
    'chiuso_card_passivo',
    'chiuso_senza_responsabilita',
    'chiuso_senza_seguito',
    'chiuso_senza_seguito_fuori_garanzia',
    'chiuso_senza_seguito_in_franchigia',
    'chiuso_senza_seguito_prescritto',
    'contenzioso',
    'i_sollecito_doc_cliente',
    'ii_sollecito_doc_cliente',
    'in_attesa_di_perizia',
    'in_attesa_di_sviluppi',
    'in_attesa_documentazione_da_cliente',
    'in_attesa_documentazione_da_ctp',
    'in_attesa_documentazione_fiscale_per_iva',
    'in_attesa_liquidazione_franchigia_rct',
    'in_attesa_nomina_perito',
    'in_attesa_pagamento_da_compagnia',
    'in_attesa_quietanza_da_cliente',
    'in_attesa_quietanza_da_compagnia',
    'inviata_relazione_tecnica_a_compagnia',
    'invio_atto_liquidazione_amichevole_cliente',
    'invio_atto_liquidazione_amichevole_compagnia',
    'invio_atto_liquidazione_amichevole_perito',
    'invio_citazione_in_compagnia_causa',
    'invio_documentazione_a_compagnia',
    'invio_quietanza_a_compagnia',
    'invio_quietanza_al_cliente',
    'liquidato',
    'liquidato_parziale',
    'liquidazione_transattiva',
    'mediazione',
    'non_denunciato_a_compagnia',
    'operazioni_peritali_in_corso',
    'passaggio_ad_altro_broker',
    'procedimento_giudizio_concluso',
    'bozza',
    'in_valutazione',
    'aperto',
    'in_lavorazione',
    'in_attesa_documenti',
    'in_liquidazione',
    'respinto'
  ));

COMMENT ON CONSTRAINT sinistri_stato_check ON public.sinistri IS
  'Catalogo stati pratica (slug snake). Label UI CAPS in src/lib/sinistriStati.ts. Legacy bozza/aperto/… conservati.';
