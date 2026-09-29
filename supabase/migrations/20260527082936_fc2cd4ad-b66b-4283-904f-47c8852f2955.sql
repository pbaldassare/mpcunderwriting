
-- Whitelist delle colonne enum/testo libere che l'IA può esplorare
CREATE TABLE public.ai_allowed_enums (
  table_name text NOT NULL,
  column_name text NOT NULL,
  descrizione text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, column_name)
);

GRANT SELECT ON public.ai_allowed_enums TO authenticated;
GRANT ALL ON public.ai_allowed_enums TO service_role;

ALTER TABLE public.ai_allowed_enums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_allowed_enums readable by authenticated"
  ON public.ai_allowed_enums FOR SELECT TO authenticated USING (true);

-- Seed iniziale
INSERT INTO public.ai_allowed_enums(table_name, column_name, descrizione) VALUES
  ('clienti','stato_cliente','Stato cliente (testo libero)'),
  ('clienti','tipo_cliente','privato/azienda/ente'),
  ('clienti','tipo_persona','tipo persona fisica/giuridica'),
  ('clienti','settore','Settore attività'),
  ('prospect','stato','Stato prospect (testo libero)'),
  ('prospect','fonte','Fonte di acquisizione'),
  ('prospect','tipo_cliente','privato/azienda/ente'),
  ('trattative','stato','Stato pipeline trattativa'),
  ('trattative','priorita','bassa/media/alta'),
  ('trattative','fonte','Fonte trattativa'),
  ('trattative','prodotto','Prodotto richiesto (testo libero)'),
  ('titoli','stato','Stato polizza'),
  ('titoli','tipo_portafoglio','Tipo portafoglio'),
  ('titoli','periodicita','Periodicità polizza'),
  ('titoli','tipo_rinnovo','Tipo rinnovo (legacy)'),
  ('sinistri','stato','Stato sinistro'),
  ('sinistri','tipo_sinistro','Tipo sinistro'),
  ('sinistri','ramo_sinistro','Ramo sinistro'),
  ('compagnie','stato','Stato compagnia'),
  ('compagnie','tipo_mandatario','Tipo mandato compagnia'),
  ('compagnie','gruppo_compagnia','Gruppo compagnia'),
  ('bandi_pubblici','stato','Stato bando'),
  ('bandi_pubblici','tipologia','Tipologia bando'),
  ('storico_gare','tipologia','Tipologia gara'),
  ('storico_gare','esito','Esito gara'),
  ('storico_gare','categoria_ente','Categoria ente PA'),
  ('storico_gare','broker_incumbent','Broker incumbent normalizzato'),
  ('notifiche','tipo','Tipo notifica'),
  ('notifiche','priorita','Priorità notifica'),
  ('notifiche','entita_tipo','Entità collegata'),
  ('movimenti_contabili','tipo','entrata/uscita'),
  ('movimenti_contabili','categoria','Categoria movimento contabile'),
  ('profiles','ruolo','Ruolo utente'),
  ('anagrafiche_professionali','tipo','Tipo anagrafica professionale'),
  ('rami','gruppo','Gruppo ramo assicurativo'),
  ('codici_commerciali_cliente','ruolo','Ruolo commerciale su cliente'),
  ('provvigioni_generate','tipo_destinatario','Tipo destinatario provvigione');

-- RPC: ritorna i valori distinti realmente presenti per una colonna whitelisted
CREATE OR REPLACE FUNCTION public.ai_list_enum_values(p_table text, p_column text)
RETURNS TABLE(valore text, occorrenze bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed boolean;
  v_sql text;
BEGIN
  -- Whitelist check
  SELECT EXISTS(
    SELECT 1 FROM public.ai_allowed_enums
    WHERE table_name = p_table AND column_name = p_column
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Colonna %.% non in whitelist ai_allowed_enums', p_table, p_column;
  END IF;

  v_sql := format(
    'SELECT %I::text AS valore, COUNT(*)::bigint AS occorrenze
     FROM public.%I
     WHERE %I IS NOT NULL
     GROUP BY %I
     ORDER BY occorrenze DESC
     LIMIT 50',
    p_column, p_table, p_column, p_column
  );

  RETURN QUERY EXECUTE v_sql;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_list_enum_values(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_list_enum_values(text,text) TO authenticated;
