-- Incassi: provvigioni dalla stessa fonte del dettaglio cliente (titolo rata / blocco).
-- Prima: vista esponeva quietanze.provvigioni_* (spesso quietanza=0 e firma corretta).
-- Frontend usava `??` che non fa fallback su 0 → totali più bassi (es. Pensilis 1594 vs 2145).

-- 1) Backfill: se quietanza è 0/null ma firma > 0, allinea quietanza a firma
UPDATE public.quietanze q
SET
  provvigioni_quietanza = q.provvigioni_firma,
  updated_at = now()
WHERE (q.provvigioni_quietanza IS NULL OR q.provvigioni_quietanza = 0)
  AND q.provvigioni_firma IS NOT NULL
  AND q.provvigioni_firma <> 0;

-- 2) Preferisci i valori del titolo rata (sostituisce_polizza) quando collegabile alla quietanza
UPDATE public.quietanze q
SET
  provvigioni_firma = COALESCE(tr.provvigioni_firma, q.provvigioni_firma),
  provvigioni_quietanza = COALESCE(
    NULLIF(tr.provvigioni_quietanza, 0),
    NULLIF(tr.provvigioni_firma, 0),
    q.provvigioni_quietanza
  ),
  updated_at = now()
FROM public.titoli tm
JOIN public.titoli tr
  ON tr.sostituisce_polizza IS NOT NULL
 AND tr.sostituisce_polizza = tm.numero_titolo
WHERE q.titolo_id = tm.id
  AND tm.sostituisce_polizza IS NULL
  AND ABS(COALESCE(tr.premio_lordo, 0) - COALESCE(q.premio_lordo, 0)) < 0.02
  AND (
    COALESCE(q.provvigioni_firma, 0) IS DISTINCT FROM COALESCE(tr.provvigioni_firma, 0)
    OR COALESCE(q.provvigioni_quietanza, 0) IS DISTINCT FROM COALESCE(NULLIF(tr.provvigioni_quietanza, 0), tr.provvigioni_firma, 0)
  );

-- 3) Vista: espone provvigioni da titolo rata (se esiste), altrimenti madre, altrimenti quietanze
DROP VIEW IF EXISTS public.v_portafoglio_quietanze CASCADE;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  q.titolo_id                                         AS id,
  q.id                                                AS quietanza_id,
  p.id                                                AS polizza_id,
  q.titolo_id                                         AS titolo_legacy_id,
  COALESCE(p.numero_polizza, q.numero_polizza_snapshot, t.numero_titolo) AS numero_titolo,
  t.numero_titolo                                     AS titolo_derivato_numero,
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
  COALESCE(t.stato::text, p.stato::text)              AS stato,
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
  t.rate,
  p.frazionamento,
  p.targa_telaio,
  t.ae_nome,
  t.specialist,
  t.produttore_nome,
  COALESCE(
    (
      SELECT string_agg(
        COALESCE(
          NULLIF(TRIM(a.ragione_sociale), ''),
          NULLIF(TRIM(COALESCE(a.cognome, '') || ' ' || COALESCE(a.nome, '')), ''),
          '—'
        ) || ' (' || TRIM(to_char(s.percentuale, 'FM999990.00')) || '%)',
        ', ' ORDER BY s.ordine, s.created_at
      )
      FROM public.titoli_split_commerciali s
      JOIN public.anagrafiche_professionali a ON a.id = s.anagrafica_commerciale_id
      WHERE s.titolo_id = COALESCE(tr.id, q.titolo_id)
    ),
    t.produttore_nome
  )                                                   AS produttori_display,
  p.descrizione_polizza,
  p.tipo_portafoglio,
  p.tacito_rinnovo,
  p.regolazione,
  p.durata_da,
  p.durata_a,
  q.data_messa_cassa,
  q.data_pagamento,
  q.data_incasso,
  COALESCE(t.data_copertura, q.data_copertura)        AS data_copertura,
  t.data_decorrenza_rinnovo,
  t.conferimento_gestito,
  t.fondi_ricevuti,
  p.data_sospensione,
  p.data_riattivazione,
  t.limite_riattivazione,
  COALESCE(tr.sostituisce_polizza, t.sostituisce_polizza) AS sostituisce_polizza,
  COALESCE(tr.is_regolazione, t.is_regolazione)       AS is_regolazione,
  COALESCE(tr.is_proroga, t.is_proroga)               AS is_proroga,
  COALESCE(tr.is_appendice_modifica, t.is_appendice_modifica) AS is_appendice_modifica,
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
JOIN polizze   p    ON p.id = q.polizza_id
LEFT JOIN titoli    t   ON t.id  = q.titolo_id
LEFT JOIN LATERAL (
  SELECT tr.*
  FROM public.titoli tr
  WHERE tr.sostituisce_polizza IS NOT NULL
    AND (
      tr.id = q.titolo_id
      OR (
        t.numero_titolo IS NOT NULL
        AND tr.sostituisce_polizza = t.numero_titolo
        AND ABS(COALESCE(tr.premio_lordo, 0) - COALESCE(q.premio_lordo, 0)) < 0.02
      )
    )
  ORDER BY CASE WHEN tr.id = q.titolo_id THEN 0 ELSE 1 END, tr.created_at DESC NULLS LAST
  LIMIT 1
) tr ON true
LEFT JOIN clienti   cli ON cli.id = p.cliente_anagrafica_id
LEFT JOIN compagnie comp ON comp.id = p.compagnia_id
LEFT JOIN rami      r   ON r.id  = p.ramo_id
WHERE q.titolo_id IS NOT NULL;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT SELECT ON public.v_portafoglio_quietanze TO anon;
GRANT SELECT ON public.v_portafoglio_quietanze TO service_role;

COMMENT ON VIEW public.v_portafoglio_quietanze IS
  'Vista Incassi/portafoglio: provvigioni da titolo rata (blocco) se collegabile, altrimenti madre/quietanze.';
