
-- 1) Lookup: sezioni di bilancio
CREATE TABLE public.sezioni_bilancio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  ordine int DEFAULT 0,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sezioni_bilancio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sezioni_bilancio" ON public.sezioni_bilancio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write sezioni_bilancio" ON public.sezioni_bilancio FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Gruppi (Centri di costo - livello 1)
CREATE TABLE public.piano_conti_gruppi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE CHECK (codice ~ '^\d{6}$'),
  descrizione text NOT NULL,
  sezione_bilancio_id uuid REFERENCES public.sezioni_bilancio(id),
  natura_tipo text NOT NULL DEFAULT 'patrimoniale' CHECK (natura_tipo IN ('patrimoniale','economico')),
  natura_segno text NOT NULL DEFAULT 'attivo' CHECK (natura_segno IN ('attivo','passivo')),
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.piano_conti_gruppi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read piano_conti_gruppi" ON public.piano_conti_gruppi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write piano_conti_gruppi" ON public.piano_conti_gruppi FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_piano_conti_gruppi BEFORE UPDATE ON public.piano_conti_gruppi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Conti (Sottocentri - livello 2, con anagrafica integrata)
CREATE TABLE public.piano_conti_conti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gruppo_id uuid NOT NULL REFERENCES public.piano_conti_gruppi(id) ON DELETE CASCADE,
  codice text NOT NULL CHECK (codice ~ '^\d{6}$'),
  descrizione text NOT NULL,
  sezione_bilancio_id uuid REFERENCES public.sezioni_bilancio(id),
  natura_tipo text NOT NULL DEFAULT 'patrimoniale' CHECK (natura_tipo IN ('patrimoniale','economico')),
  natura_segno text NOT NULL DEFAULT 'attivo' CHECK (natura_segno IN ('attivo','passivo')),
  gestione_partite boolean DEFAULT false,
  tipo_sezionale text DEFAULT 'no' CHECK (tipo_sezionale IN ('no','clienti','fornitori')),
  voce_spesa text,
  flag_stato boolean DEFAULT false,
  data_sospensione date,
  gestione_tesoreria boolean DEFAULT false,
  iban text,
  bic text,
  citta text,
  cf_piva text,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(gruppo_id, codice)
);
ALTER TABLE public.piano_conti_conti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read piano_conti_conti" ON public.piano_conti_conti FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write piano_conti_conti" ON public.piano_conti_conti FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_piano_conti_conti BEFORE UPDATE ON public.piano_conti_conti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Seed sezioni_bilancio
INSERT INTO public.sezioni_bilancio (codice, descrizione, ordine) VALUES
('CRS','CREDITI VERSO SOCI',1),
('IMI','IMMOBILIZZ. IMMATERIALI',2),
('IMM','IMMOBILIZZ. MATERIALI',3),
('IMF','IMMOBILIZZ. FINANZIARIE',4),
('ASS','ASSICURATI',5),
('CLI','CLIENTI',6),
('DEB','DEBITORI DIVERSI',7),
('FOR','FORNITORI',8),
('CMP','COMPAGNIE',9),
('CRD','CREDITORI DIVERSI',10),
('ACO','ASS./COMP. C/D''ORDINE',11),
('CAS','CASSA',12),
('BAN','BANCHE',13),
('POR','PORTAFOGLIO',14),
('AAF','ALTRE ATTIVITA'' FINANZ.',15),
('RER','RATEI E RISCONTI',16),
('FAM','F.DO AMM. IMM. MATERIALI',17),
('FAI','F.DO AMM. IMMOB. IMMATER.',18),
('TFR','TRATT. FINE RAPPORTO',19),
('CAP','CAPITALE',20),
('RIS','RISERVE',21),
('RIC','RICAVI',22),
('COS','COSTI',23),
('IMP','IMPOSTE E TASSE',24),
('DIV','DIVERSI',25);

-- 5) Seed gruppi + conti demo
-- Helper: get sezione id by codice
DO $$
DECLARE
  s_crs uuid; s_imi uuid; s_imm uuid; s_for uuid; s_ban uuid; s_cas uuid; s_cli uuid; s_cos uuid;
  g_crs uuid; g_imi uuid; g_imm uuid; g_for uuid; g_ban uuid; g_cas uuid; g_cli uuid; g_cos uuid;
BEGIN
  SELECT id INTO s_crs FROM sezioni_bilancio WHERE codice='CRS';
  SELECT id INTO s_imi FROM sezioni_bilancio WHERE codice='IMI';
  SELECT id INTO s_imm FROM sezioni_bilancio WHERE codice='IMM';
  SELECT id INTO s_for FROM sezioni_bilancio WHERE codice='FOR';
  SELECT id INTO s_ban FROM sezioni_bilancio WHERE codice='BAN';
  SELECT id INTO s_cas FROM sezioni_bilancio WHERE codice='CAS';
  SELECT id INTO s_cli FROM sezioni_bilancio WHERE codice='CLI';
  SELECT id INTO s_cos FROM sezioni_bilancio WHERE codice='COS';

  -- Gruppi
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('010101','CREDITI VERSO SOCI', s_crs, 'patrimoniale','attivo') RETURNING id INTO g_crs;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('020101','IMMOBILIZZ. IMMATERIALI', s_imi, 'patrimoniale','attivo') RETURNING id INTO g_imi;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('030101','IMMOBILIZZ. MATERIALI', s_imm, 'patrimoniale','attivo') RETURNING id INTO g_imm;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('040101','CLIENTI', s_cli, 'patrimoniale','attivo') RETURNING id INTO g_cli;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('050101','FORNITORI', s_for, 'patrimoniale','passivo') RETURNING id INTO g_for;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('060101','BANCHE', s_ban, 'patrimoniale','attivo') RETURNING id INTO g_ban;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('070101','CASSA', s_cas, 'patrimoniale','attivo') RETURNING id INTO g_cas;
  INSERT INTO piano_conti_gruppi (codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    ('080101','COSTI DI ESERCIZIO', s_cos, 'economico','passivo') RETURNING id INTO g_cos;

  -- Conti (sottocentri)
  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    (g_crs, '000001','CREDITI VERSO SOCI', s_crs, 'patrimoniale','attivo'),
    (g_crs, '000002','OBBLIGAZIONISTI C/SOTT.NI', s_crs, 'patrimoniale','attivo');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    (g_imi, '000001','SPESE PRIMO IMPIANTO', s_imi, 'patrimoniale','attivo'),
    (g_imi, '000002','COSTI PLURIENNALI', s_imi, 'patrimoniale','attivo'),
    (g_imi, '000003','SOFTWARE', s_imi, 'patrimoniale','attivo'),
    (g_imi, '000004','PORTAFOGLI ASSICURATIVI', s_imi, 'patrimoniale','attivo'),
    (g_imi, '000005','ATTIVITA'' FINANZIARIE', s_imi, 'patrimoniale','attivo'),
    (g_imi, '000006','SPESE CERT. DI QUALITA''', s_imi, 'patrimoniale','attivo');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    (g_imm, '000001','MOBILI E ARREDI', s_imm, 'patrimoniale','attivo'),
    (g_imm, '000002','MACCHINE UFFICIO', s_imm, 'patrimoniale','attivo'),
    (g_imm, '000003','IMPIANTI', s_imm, 'patrimoniale','attivo');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno, tipo_sezionale) VALUES
    (g_cli, '000001','CLIENTI NAZIONALI', s_cli, 'patrimoniale','attivo','clienti'),
    (g_cli, '000002','CLIENTI ESTERI', s_cli, 'patrimoniale','attivo','clienti');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno, tipo_sezionale) VALUES
    (g_for, '000001','BOLLETTE TELEFONICHE', s_for, 'patrimoniale','passivo','fornitori'),
    (g_for, '000002','ENERGIA ELETTRICA', s_for, 'patrimoniale','passivo','fornitori'),
    (g_for, '000003','AFFITTO UFFICI', s_for, 'patrimoniale','passivo','fornitori'),
    (g_for, '000004','CANCELLERIA', s_for, 'patrimoniale','passivo','fornitori');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno, gestione_tesoreria, iban, bic, citta) VALUES
    (g_ban, '000001','BANCA VALSABBINA', s_ban, 'patrimoniale','attivo', true, 'IT60X0542811101000000123456','BVSAIT2V','Brescia'),
    (g_ban, '000002','BCC ROMA', s_ban, 'patrimoniale','attivo', true, 'IT15T0832703200000000456789','ROMAITRR','Roma'),
    (g_ban, '000003','INTESA SANPAOLO', s_ban, 'patrimoniale','attivo', true, 'IT40S0306909606100000789012','BCITITMM','Milano');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    (g_cas, '000001','CASSA SEDE NAPOLI', s_cas, 'patrimoniale','attivo'),
    (g_cas, '000002','CASSA SEDE ROMA', s_cas, 'patrimoniale','attivo');

  INSERT INTO piano_conti_conti (gruppo_id, codice, descrizione, sezione_bilancio_id, natura_tipo, natura_segno) VALUES
    (g_cos, '000001','UTENZE TELEFONICHE', s_cos, 'economico','passivo'),
    (g_cos, '000002','ENERGIA E GAS', s_cos, 'economico','passivo'),
    (g_cos, '000003','CONSULENZE PROFESSIONALI', s_cos, 'economico','passivo'),
    (g_cos, '000004','ASSICURAZIONI', s_cos, 'economico','passivo'),
    (g_cos, '000005','MANUTENZIONE UFFICI', s_cos, 'economico','passivo');
END $$;
