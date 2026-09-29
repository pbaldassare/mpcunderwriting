-- Cantiere Bandi partecipati: stato operativo + ponte verso storico_gare.
-- Non confondere con bandi_pubblici.stato (gara) né con bandi_interesse.esito (decisione).

ALTER TABLE public.bandi_interesse
  ADD COLUMN IF NOT EXISTS cantiere_stato text,
  ADD COLUMN IF NOT EXISTS cantiere_il timestamptz,
  ADD COLUMN IF NOT EXISTS storico_gara_id uuid REFERENCES public.storico_gare(id) ON DELETE SET NULL;

ALTER TABLE public.bandi_interesse
  DROP CONSTRAINT IF EXISTS bandi_interesse_cantiere_chk;
ALTER TABLE public.bandi_interesse
  ADD CONSTRAINT bandi_interesse_cantiere_chk CHECK (
    cantiere_stato IS NULL OR cantiere_stato IN (
      'da_approfondire',
      'in_monitoraggio',
      'pronto_trattativa',
      'in_trattativa',
      'archiviato_storico',
      'abbandonato'
    )
  );

UPDATE public.bandi_interesse
SET
  cantiere_stato = 'in_trattativa',
  cantiere_il = COALESCE(cantiere_il, deciso_il, now())
WHERE esito = 'in_trattativa'
  AND cantiere_stato IS NULL;

UPDATE public.bandi_interesse
SET
  cantiere_stato = 'da_approfondire',
  cantiere_il = COALESCE(cantiere_il, deciso_il, now())
WHERE esito = 'voglio_partecipare'
  AND cantiere_stato IS NULL;

CREATE INDEX IF NOT EXISTS bandi_interesse_cantiere_idx
  ON public.bandi_interesse (cantiere_stato);

ALTER TABLE public.storico_gare
  ADD COLUMN IF NOT EXISTS bando_id uuid REFERENCES public.bandi_pubblici(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS storico_gare_bando_uidx
  ON public.storico_gare (bando_id)
  WHERE bando_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS storico_gare_bando_idx
  ON public.storico_gare (bando_id);

COMMENT ON COLUMN public.bandi_interesse.cantiere_stato IS
  'Stato operativo in Bandi partecipati (approfondimento/monitoraggio/uscita).';
COMMENT ON COLUMN public.storico_gare.bando_id IS
  'Bando CBnet da cui è nata la riga di intelligence (opzionale).';

DROP VIEW IF EXISTS public.v_storico_gare;
CREATE VIEW public.v_storico_gare AS
SELECT
  sg.*,
  CASE
    WHEN sg.data_fine_mandato IS NULL THEN 'sconosciuto'
    WHEN sg.data_fine_mandato < CURRENT_DATE THEN 'scaduto'
    WHEN sg.data_fine_mandato <= CURRENT_DATE + INTERVAL '12 months' THEN 'in_scadenza_12m'
    ELSE 'attivo'
  END AS stato_mandato,
  c.ragione_sociale AS cliente_ragione_sociale,
  COALESCE(c.cognome || ' ' || c.nome, c.ragione_sociale) AS cliente_display
FROM public.storico_gare sg
LEFT JOIN public.clienti c ON c.id = sg.cliente_id;

ALTER VIEW public.v_storico_gare SET (security_invoker = true);
GRANT SELECT ON public.v_storico_gare TO authenticated;

DROP POLICY IF EXISTS "Storico gare insert da cantiere bandi" ON public.storico_gare;
CREATE POLICY "Storico gare insert da cantiere bandi"
ON public.storico_gare FOR INSERT
TO authenticated
WITH CHECK (
  bando_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN (
        'admin','cfo','responsabile_sede','ufficio','backoffice',
        'account_executive','specialist','produttore','executive'
      )
  )
);

DROP POLICY IF EXISTS "Storico gare update da cantiere bandi" ON public.storico_gare;
CREATE POLICY "Storico gare update da cantiere bandi"
ON public.storico_gare FOR UPDATE
TO authenticated
USING (
  bando_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN (
        'admin','cfo','responsabile_sede','ufficio','backoffice',
        'account_executive','specialist','produttore','executive'
      )
  )
)
WITH CHECK (
  bando_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN (
        'admin','cfo','responsabile_sede','ufficio','backoffice',
        'account_executive','specialist','produttore','executive'
      )
  )
);
