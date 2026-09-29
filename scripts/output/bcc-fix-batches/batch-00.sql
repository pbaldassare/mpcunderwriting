WITH corrections(descrizione, data_movimento, importo_ok, importo_v) AS (
VALUES
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2639- 1 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 838.09::numeric, 83809::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2634- 1 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 5323.4::numeric, 5.3234::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2638- 1 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 5297.22::numeric, 5.29722::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2636- 1 PARCO AUTO'::text, '2026-07-16'::date, 1629::numeric, 1.629::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2637- 2 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 10255.07::numeric, 10.25507::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2635- 1 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 2526::numeric, 2.526::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2637- 1 PROPERTY (ALL RISK)'::text, '2026-07-16'::date, 25747.56::numeric, 25.74756::numeric),
('Bonifico a vs favore *COMUNE DI POMIGLIANO D ARCO MAND. N. 2636- 2 PROROGA TECNICA COPERTURE ASSICURATIVE ED IMPEGNO.'::text, '2026-07-16'::date, 9186.39::numeric, 9.18639::numeric)
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