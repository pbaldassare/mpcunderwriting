-- Incassi lento / timeout: la vista faceva LATERAL seq-scan su titoli per ogni quietanza
-- + subquery produttori. Ottimizza indici e vista.

CREATE INDEX IF NOT EXISTS idx_titoli_sostituisce_polizza
  ON public.titoli (sostituisce_polizza)
  WHERE sostituisce_polizza IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_sostituisce_premio
  ON public.titoli (sostituisce_polizza, premio_lordo)
  WHERE sostituisce_polizza IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quietanze_pendenti
  ON public.quietanze (data_messa_cassa, stato)
  WHERE titolo_id IS NOT NULL;

-- Split commerciali: stessa policy degli altri oggetti operativi
DROP POLICY IF EXISTS "Authenticated full access titoli_split_commerciali" ON public.titoli_split_commerciali;
CREATE POLICY "Authenticated full access titoli_split_commerciali" ON public.titoli_split_commerciali
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP VIEW IF EXISTS public.v_portafoglio_quietanze CASCADE;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  COALESCE(tr.id, q.titolo_id)                        AS id,
  q.id                                                AS quietanza_id,
  p.id                                                AS polizza_id,
  q.titolo_id                                         AS titolo_legacy_id,
  COALESCE(p.numero_polizza, q.numero_polizza_snapshot, t.numero_titolo) AS numero_titolo,
  COALESCE(tr.numero_titolo, t.numero_titolo)         AS titolo_derivato_numero,
  q.numero_polizza_snapshot,
  p.cig_rif,
  p.appendice_corrente,
  p.cliente_anagrafica_id,
  COALESCE(
    cli.ragione_sociale,
    NULLIF(TRIM(COALESCE(cli.cognome, '') || ' ' || COALESCE(cli.nome, '')), ''),
    '—'
  )                                                   AS cliente_nome_display,
  cli.codice_cliente                                  AS cliente_codice,
  p.compagnia_id,
  comp.nome                                           AS compagnia_nome,
  p.ramo_id,
  r.descrizione                                       AS ramo_nome,
  r.codice                                            AS ramo_codice,
  COALESCE(tr.stato, t.stato, p.stato::text)          AS stato,
  q.stato                                             AS stato_quietanza,
  p.stato                                             AS stato_polizza,
  q.garanzia_da,
  q.garanzia_a,
  q.data_competenza,
  q.data_scadenza,
  q.premio_lordo,
  q.premio_netto,
  q.tasse,
  q.addizionali,
  q.ssn,
  COALESCE(tr.provvigioni_firma, t.provvigioni_firma, q.provvigioni_firma) AS provvigioni_firma,
  COALESCE(
    NULLIF(tr.provvigioni_quietanza, 0),
    NULLIF(t.provvigioni_quietanza, 0),
    NULLIF(q.provvigioni_quietanza, 0),
    tr.provvigioni_firma,
    t.provvigioni_firma,
    q.provvigioni_firma
  )                                                   AS provvigioni_quietanza,
  q.importo_incassato,
  COALESCE(tr.rate, t.rate)                           AS rate,
  p.frazionamento,
  p.targa_telaio,
  COALESCE(tr.ae_nome, t.ae_nome)                     AS ae_nome,
  COALESCE(tr.specialist, t.specialist)               AS specialist,
  COALESCE(tr.produttore_nome, t.produttore_nome)     AS produttore_nome,
  -- niente subquery split: troppo costosa in lista Incassi
  COALESCE(tr.produttore_nome, t.produttore_nome)     AS produttori_display,
  p.descrizione_polizza,
  p.tipo_portafoglio,
  p.tacito_rinnovo,
  p.regolazione,
  p.durata_da,
  p.durata_a,
  q.data_messa_cassa,
  q.data_pagamento,
  q.data_incasso,
  COALESCE(tr.data_copertura, t.data_copertura, q.data_copertura) AS data_copertura,
  COALESCE(tr.data_decorrenza_rinnovo, t.data_decorrenza_rinnovo) AS data_decorrenza_rinnovo,
  COALESCE(tr.conferimento_gestito, t.conferimento_gestito) AS conferimento_gestito,
  COALESCE(tr.fondi_ricevuti, t.fondi_ricevuti)       AS fondi_ricevuti,
  p.data_sospensione,
  p.data_riattivazione,
  COALESCE(tr.limite_riattivazione, t.limite_riattivazione) AS limite_riattivazione,
  COALESCE(tr.sostituisce_polizza, t.sostituisce_polizza) AS sostituisce_polizza,
  COALESCE(tr.is_regolazione, t.is_regolazione, false) AS is_regolazione,
  COALESCE(tr.is_proroga, t.is_proroga, false)        AS is_proroga,
  COALESCE(tr.is_appendice_modifica, t.is_appendice_modifica, false) AS is_appendice_modifica,
  COALESCE(tr.regolazione_quietanza_id, t.regolazione_quietanza_id) AS regolazione_quietanza_id,
  COALESCE(tr.proroga_polizza_madre_id, t.proroga_polizza_madre_id) AS proroga_polizza_madre_id,
  COALESCE(tr.appendice_modifica_polizza_madre_id, t.appendice_modifica_polizza_madre_id) AS appendice_modifica_polizza_madre_id,
  q.appendice                                         AS appendice_tipo,
  q.numero_rata,
  q.numero_rate_totali,
  p.ufficio_id,
  p.account_executive_anagrafica_id                   AS ae_anagrafica_id,
  p.anagrafica_commerciale_id,
  p.produttore_anagrafica_id                          AS produttore_id
FROM quietanze q
JOIN polizze p ON p.id = q.polizza_id
LEFT JOIN titoli t ON t.id = q.titolo_id
-- LATERAL solo se titolo_id punta alla madre: cerca la rata collegata
LEFT JOIN LATERAL (
  SELECT
    tr.id,
    tr.numero_titolo,
    tr.stato,
    tr.provvigioni_firma,
    tr.provvigioni_quietanza,
    tr.rate,
    tr.ae_nome,
    tr.specialist,
    tr.produttore_nome,
    tr.data_copertura,
    tr.data_decorrenza_rinnovo,
    tr.conferimento_gestito,
    tr.fondi_ricevuti,
    tr.limite_riattivazione,
    tr.sostituisce_polizza,
    tr.is_regolazione,
    tr.is_proroga,
    tr.is_appendice_modifica,
    tr.regolazione_quietanza_id,
    tr.proroga_polizza_madre_id,
    tr.appendice_modifica_polizza_madre_id
  FROM public.titoli tr
  WHERE t.sostituisce_polizza IS NULL
    AND t.numero_titolo IS NOT NULL
    AND tr.sostituisce_polizza = t.numero_titolo
    AND ABS(COALESCE(tr.premio_lordo, 0) - COALESCE(q.premio_lordo, 0)) < 0.02
  ORDER BY tr.created_at DESC NULLS LAST
  LIMIT 1
) tr ON t.sostituisce_polizza IS NULL
LEFT JOIN clienti cli ON cli.id = p.cliente_anagrafica_id
LEFT JOIN compagnie comp ON comp.id = p.compagnia_id
LEFT JOIN rami r ON r.id = p.ramo_id
WHERE q.titolo_id IS NOT NULL;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT SELECT ON public.v_portafoglio_quietanze TO anon;
GRANT SELECT ON public.v_portafoglio_quietanze TO service_role;

COMMENT ON VIEW public.v_portafoglio_quietanze IS
  'Vista Incassi/portafoglio (ottimizzata): LATERAL rata solo se titolo_id è madre; senza subquery split.';
