-- Helper: grant ufficio role full write access on operational tables
-- Pattern applied per table: INSERT/UPDATE/DELETE policies gated by has_role(auth.uid(),'ufficio')

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'titoli',
    'movimenti_contabili',
    'appendici_polizza',
    'pagamenti_provvigioni',
    'pagamento_dettaglio',
    'note_restituzione',
    'nota_restituzione_dettaglio',
    'rimessa_premi',
    'rimessa_dettaglio',
    'sinistri',
    'sinistro_eventi',
    'sinistro_checklist',
    'movimenti_sinistro',
    'documenti_sinistro',
    'trattative',
    'trattativa_eventi',
    'trattativa_documenti',
    'trattativa_scadenze',
    'clienti',
    'clienti_relazioni',
    'codici_commerciali_cliente',
    'nominativi_cliente',
    'contatti_cliente',
    'referenti_cliente',
    'prospect',
    'documenti',
    'documenti_cliente',
    'documenti_titolo',
    'documenti_trattativa',
    'log_attivita',
    'notifiche',
    'chat_messaggi',
    'chat_messaggi_interni',
    'conducenti_polizza',
    'dettaglio_riparto',
    'spedizioni',
    'provvigioni_generate',
    'incroci_bancari',
    'estratti_conto',
    'distinte_giornaliere',
    'distinte_giornaliere_righe',
    'banca_documenti',
    'flussi_compagnia',
    'anomalie_sistema',
    'chiusure_contabili',
    'elab_annuali',
    'elaborazioni_periodiche',
    'certificazioni_cu',
    'documenti_utenti',
    'bandi_pubblici',
    'bandi_trattative',
    'portafoglio_incassi',
    'portafoglio_eventi'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- skip if table doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- Drop existing ufficio-global write policies if present (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS "Ufficio global insert %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Ufficio global update %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Ufficio global delete %I" ON public.%I', t, t);

    -- Create permissive write policies for ufficio role (global scope)
    EXECUTE format(
      'CREATE POLICY "Ufficio global insert %I" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), ''ufficio''::app_role))',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "Ufficio global update %I" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.has_role(auth.uid(), ''ufficio''::app_role))
        WITH CHECK (public.has_role(auth.uid(), ''ufficio''::app_role))',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "Ufficio global delete %I" ON public.%I
        FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), ''ufficio''::app_role))',
      t, t
    );
  END LOOP;
END $$;