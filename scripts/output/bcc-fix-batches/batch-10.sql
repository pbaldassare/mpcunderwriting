WITH corrections(descrizione, data_movimento, importo_ok, importo_v) AS (
VALUES
('Bonifico a vs favore *BCC BASILICATA-CREDITO COOPERATIVO DI LA EC POLIZZA 100324 - D&O AMMINISTRATORI E SINDACI Info aggiuntive: Data ordine: 01/07/2026 Localita ordinante: LAURENZANA Ragione sociale ordinante: BCC BASILICATA-CREDITO COOPERATIVO DI LA IBAN ordinante: IT06H0859742030000000399993 Indirizzo ordinante: VIA S.S.92 N.50 ID_BONIFICO: 00004525634 Descrizione aggiuntiva del movimento: *BCC BASILICATA-CREDITO COOPERATIVO DI LA EC POLIZZA 100324 - D&O AMMINISTRATORI E SINDACI'::text, '2026-07-02'::date, 6581.25::numeric, 6.58125::numeric),
('Bonifico a vs favore *INST 15:08 RENT AND EVENTS S.R.L. 2E16358583E74AD6A5417309AFFBE84C SALDO ESTRATTO CONTO DEL 19.06.2026 Info aggiuntive: Data ordine: 01/07/2026 Ragione sociale ordinante: RENT AND EVENTS S.R.L. IBAN ordinante: IT10B0511601600000000003622 Indirizzo ordinante: P.ZZADELLA VITTORIA 14/A ID_BONIFICO: 2E16358583E74AD6A5417309AFFBE84C Descrizione aggiuntiva del movimento: *INST 15:08 RENT AND EVENTS S.R.L. 2E16358583E74AD6A5417309AFFBE84C SALDO ESTRATTO CONTO DEL 19.06.2 Descrizione estesa del movimento: 026'::text, '2026-07-01'::date, 1231::numeric, 1.231::numeric),
('Bonifico a vs favore *COMUNE DI FERRAZZANO MAND. N. 676- 1 CIGBC36F231AF POLIZZE ASSICURATIVE 2026 Info aggiuntive: Data ordine: 01/07/2026 Localita ordinante: 86010  FERRAZZANO  CB IT Ragione sociale ordinante: COMUNE DI FERRAZZANO IBAN ordinante: IT88O0306903805100000046054 Indirizzo ordinante: PIAZZA VINCENZO SPENSIERI 19 ID_BONIFICO: 0306926588857100480380503805IT Descrizione aggiuntiva del movimento: *COMUNE DI FERRAZZANO MAND. N. 676- 1 CIGBC36F231AF POLIZZE ASSICURATIVE 2026'::text, '2026-07-01'::date, 14221.2::numeric, 14.2212::numeric),
('Bonifico a vs favore *COMUNE DI SESTO CAMPANO 2026.1230.1 RINNOVO POLIZZE AUTOMEZZI Info aggiuntive: Data ordine: 01/07/2026 Ragione sociale ordinante: COMUNE DI SESTO CAMPANO IBAN ordinante: IT86K0760103200001050270766 Indirizzo ordinante: VIA G. MARCONI SNC SESTO CAMPA ID_BONIFICO: EA26063038771171480320099999IT Descrizione aggiuntiva del movimento: *COMUNE DI SESTO CAMPANO 2026.1230.1 RINNOVO POLIZZE AUTOMEZZI'::text, '2026-07-01'::date, 4109.57::numeric, 4.10957::numeric),
('Bonifico a vs favore *COMUNE DI SESTO CAMPANO 2026.1229.1 RINNOVO POLIZZE AUTOMEZZI Info aggiuntive: Data ordine: 01/07/2026 Ragione sociale ordinante: COMUNE DI SESTO CAMPANO IBAN ordinante: IT86K0760103200001050270766 Indirizzo ordinante: VIA G. MARCONI SNC SESTO CAMPA ID_BONIFICO: EA26063038771169480320099999IT Descrizione aggiuntiva del movimento: *COMUNE DI SESTO CAMPANO 2026.1229.1 RINNOVO POLIZZE AUTOMEZZI'::text, '2026-07-01'::date, 3000::numeric, 3::numeric),
('Bonifico a vs favore *COMUNE DI SESTO CAMPANO 2026.1228.1 RINNOVO POLIZZE AUTOMEZZI Info aggiuntive: Data ordine: 01/07/2026 Ragione sociale ordinante: COMUNE DI SESTO CAMPANO IBAN ordinante: IT86K0760103200001050270766 Indirizzo ordinante: VIA G. MARCONI SNC SESTO CAMPA ID_BONIFICO: EA26063038771167480320099999IT Descrizione aggiuntiva del movimento: *COMUNE DI SESTO CAMPANO 2026.1228.1 RINNOVO POLIZZE AUTOMEZZI'::text, '2026-07-01'::date, 2944.93::numeric, 2.94493::numeric),
('Bonifico a vs favore *COMUNE DI SESTO CAMPANO 2026.1227.1 RINNOVO POLIZZE AUTOMEZZI Info aggiuntive: Data ordine: 01/07/2026 Ragione sociale ordinante: COMUNE DI SESTO CAMPANO IBAN ordinante: IT86K0760103200001050270766 Indirizzo ordinante: VIA G. MARCONI SNC SESTO CAMPA ID_BONIFICO: EA26063038771165480320099999IT Descrizione aggiuntiva del movimento: *COMUNE DI SESTO CAMPANO 2026.1227.1 RINNOVO POLIZZE AUTOMEZZI'::text, '2026-07-01'::date, 6000::numeric, 6::numeric)
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