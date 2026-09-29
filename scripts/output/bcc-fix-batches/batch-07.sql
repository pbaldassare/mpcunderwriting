WITH corrections(descrizione, data_movimento, importo_ok, importo_v) AS (
VALUES
('Bonifico a vs favore *SALERNO PULITA SPA 319017209 AVVISO N.031000053- POLIZZA ANNUALE R.C. INQUINAMENTO- CIG B7C29CC9CD Info aggiuntive: Data ordine: 08/07/2026 Localita ordinante: 84131 SA SALERNO Ragione sociale ordinante: SALERNO PULITA SPA IBAN ordinante: IT59K0103015200000063550939 Indirizzo ordinante: VIA TIBERIO CLAUDIO FELICE,18 ID_BONIFICO: A105381545501030481520015200IT Descrizione aggiuntiva del movimento: *SALERNO PULITA SPA 319017209 AVVISO N.031000053- POLIZZA ANNUALE R.C. INQUINAMENTO- CIG B7C29CC9CD'::text, '2026-07-08'::date, 11613.75::numeric, 11.61375::numeric),
('Bonifico a vs favore *SALERNO PULITA SPA 319021668 AVVISO N.031000053- POLIZZA INFORTUNI CONDUCENTI- CIG BC4781122B Info aggiuntive: Data ordine: 08/07/2026 Localita ordinante: 84131 SA SALERNO Ragione sociale ordinante: SALERNO PULITA SPA IBAN ordinante: IT59K0103015200000063550939 Indirizzo ordinante: VIA TIBERIO CLAUDIO FELICE,18 ID_BONIFICO: A105381545601030481520015200IT Descrizione aggiuntiva del movimento: *SALERNO PULITA SPA 319021668 AVVISO N.031000053- POLIZZA INFORTUNI CONDUCENTI- CIG BC4781122B'::text, '2026-07-08'::date, 5292::numeric, 5.292::numeric),
('Bonifico a vs favore *COMUNE DI PIETRACATELLA CIG BC1978C69B COPERTURA ASSICURATIVA DELL AUTOVETTURA ELETTRICA LEAPMOTORTARGATA HB557KM . Info aggiuntive: Data ordine: 08/07/2026 Localita ordinante: PIETRACATELLA Ragione sociale ordinante: COMUNE DI PIETRACATELLA IBAN ordinante: IT96R0818939620000000018572 Indirizzo ordinante: VIA CAVATOIO ID_BONIFICO: 0818900003341636487785000000IT Descrizione aggiuntiva del movimento: *COMUNE DI PIETRACATELLA CIG BC1978C69B COPERTURA ASSICURATIVA DELL AUTOVETTURA ELETTRICA LEAPMOTOR Descrizione estesa del movimento: TARGATA HB557KM  .'::text, '2026-07-08'::date, 370::numeric, 37000::numeric),
('Bonifico a vs favore *COMUNE DI S.CROCE DI MAGLIANO CIGBC456B069B POLIZZE TUTELA GIUDIZIARIA, RC PATRIMONIALE, RC AUTO RINNOVO CIG BC456B069B - MAND. 0000651-0000001 Info aggiuntive: Data ordine: 08/07/2026 Localita ordinante: SANTA CROCE DI MAGLIANO Ragione sociale ordinante: COMUNE DI S.CROCE DI MAGLIANO IBAN ordinante: IT80M0200841101000001016050 Indirizzo ordinante: PIAZZA NICOLA CRAPSI, SNC ID_BONIFICO: 1101261880364196 Descrizione aggiuntiva del movimento: *COMUNE DI S.CROCE DI MAGLIANO CIGBC456B069B POLIZZE TUTELA GIUDIZIARIA, RC PATRIMONIALE, RC AUTO RI Descrizione estesa del movimento: NNOVO CIG BC456B069B - MAND. 0000651-0000001'::text, '2026-07-08'::date, 9050::numeric, 9.05::numeric),
('Bonifico a vs favore *INST 10:24 PIERGOMME DI PIETRUNTI FABRIZIO e C. SO SALDO POLIZZE VARIE R.C. AUTO / CATASTROFALI /INFORT. CONDUCENTE Info aggiuntive: Data ordine: 07/07/2026 Localita ordinante: RIPALIMOSANI Ragione sociale ordinante: PIERGOMME DI PIETRUNTI FABRIZIO e C. SO IBAN ordinante: IT58K0503403801000000000553 Indirizzo ordinante: VIA PIERO PIETRUNTI 6 ID_BONIFICO: 5034002950076188480380011700IT Descrizione aggiuntiva del movimento: *INST 10:24 PIERGOMME DI PIETRUNTI FABRIZIO e C. SO  SALDO POLIZZE VARIE R.C. AUTO / CATASTROFALI / Descrizione estesa del movimento: INFORT. CONDUCENTE'::text, '2026-07-07'::date, 5488.2::numeric, 5.4882::numeric),
('Bonifico a vs favore *CONSULBROKERS DIGITAL SRL EC 18398 10-07-2026 Info aggiuntive: Data ordine: 07/07/2026 Localita ordinante: NAPOLI Ragione sociale ordinante: CONSULBROKERS DIGITAL SRL IBAN ordinante: IT41V0623002402000011730561 Indirizzo ordinante: VIA MERGELLINA 2 ID_BONIFICO: 0623000356075943260240202402ITN2 Descrizione aggiuntiva del movimento: *CONSULBROKERS DIGITAL SRL EC 18398 10-07-2026'::text, '2026-07-07'::date, 9707.59::numeric, 9.70759::numeric),
('Bonifico a vs favore *CONSULBROKERS DIGITAL SRL EC 18427 10-07-2026 Info aggiuntive: Data ordine: 07/07/2026 Localita ordinante: NAPOLI Ragione sociale ordinante: CONSULBROKERS DIGITAL SRL IBAN ordinante: IT41V0623002402000011730561 Indirizzo ordinante: VIA MERGELLINA 2 ID_BONIFICO: 0623000356077833260240202402ITN2 Descrizione aggiuntiva del movimento: *CONSULBROKERS DIGITAL SRL EC 18427 10-07-2026'::text, '2026-07-07'::date, 2369.1::numeric, 2.3691::numeric),
('Bonifico a vs favore *COMUNE DI VAGLIO BASILICATA MAND. N. 665- 1 CIGBC49C7F23A LIQUIDAZIONE PREMIO PER POLIZZA ASSICURATIVA A CONSULBROKERS SPA (CAMPO SPORTIVO E TENSOSTRUTTURA) - ANNO 2026 Info aggiuntive: Data ordine: 07/07/2026 Localita ordinante: 85010  VAGLIO BASILICATA  PZ I Ragione sociale ordinante: COMUNE DI VAGLIO BASILICATA IBAN ordinante: IT36C0306904214100000046240 Indirizzo ordinante: VIA CARMINE ID_BONIFICO: 0306926798219500480421404214IT Descrizione aggiuntiva del movimento: *COMUNE DI VAGLIO BASILICATA MAND. N. 665- 1 CIGBC49C7F23A LIQUIDAZIONE PREMIO PER POLIZZA ASSICURAT Descrizione estesa del movimento: IVA A CONSULBROKERS SPA (CAMPO SPORTIVO E TENSOSTRUTTURA) - ANNO 2026'::text, '2026-07-07'::date, 750::numeric, 75000::numeric)
),
upd AS (
  UPDATE movimenti_bancari m
  SET importo = c.importo_ok
  FROM corrections c
  WHERE m.data_movimento = c.data_movimento
    AND m.stato IN ('importato','matchato','assegnato')
    AND round(m.importo::numeric, 2) IS DISTINCT FROM round(c.importo_ok, 2)
    AND (
      m.descrizione = c.descrizione
      OR (
        left(m.descrizione, 90) = left(c.descrizione, 90)
        AND c.importo_v IS NOT NULL
        AND (
          round(m.importo::numeric, 2) = round(c.importo_v, 2)
          OR abs(m.importo - c.importo_ok * 100) < 0.05
          OR abs(m.importo * 1000 - c.importo_ok) < 0.05
        )
      )
    )
  RETURNING m.id
)
SELECT count(*)::int AS updated FROM upd;