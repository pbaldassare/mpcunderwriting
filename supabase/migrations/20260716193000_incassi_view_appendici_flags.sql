-- Ripristina flag appendici sulla vista Incassi/portafoglio.
-- La migrazione split_commerciali aveva ricreato la view senza is_proroga /
-- is_appendice_modifica / titolo_derivato_numero, impedendo i filtri correttamente/Appendici.

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
  q.provvigioni_firma,
  q.provvigioni_quietanza,
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
      WHERE s.titolo_id = q.titolo_id
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
  t.sostituisce_polizza,
  t.is_regolazione,
  t.is_proroga,
  t.is_appendice_modifica,
  t.regolazione_quietanza_id,
  t.proroga_polizza_madre_id,
  t.appendice_modifica_polizza_madre_id,
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
LEFT JOIN clienti   cli ON cli.id = p.cliente_anagrafica_id
LEFT JOIN compagnie comp ON comp.id = p.compagnia_id
LEFT JOIN rami      r   ON r.id  = p.ramo_id
WHERE q.titolo_id IS NOT NULL;

GRANT SELECT ON public.v_portafoglio_quietanze TO authenticated;
GRANT SELECT ON public.v_portafoglio_quietanze TO anon;
GRANT SELECT ON public.v_portafoglio_quietanze TO service_role;

COMMENT ON VIEW public.v_portafoglio_quietanze IS
  'Vista Incassi/portafoglio quietanze: una riga per quietanza collegata a titolo, con flag appendici e split produttori.';
