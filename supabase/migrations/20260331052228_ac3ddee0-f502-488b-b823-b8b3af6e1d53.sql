-- Tabella Settori RCA
CREATE TABLE rca_settori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabella Usi RCA (FK → rca_settori)
CREATE TABLE rca_usi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settore_id uuid REFERENCES rca_settori(id) ON DELETE CASCADE NOT NULL,
  codice text NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(settore_id, codice)
);

-- Tabella Garanzie RCA (indipendente, con % tasse)
CREATE TABLE rca_garanzie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  aliquota_tasse numeric(5,2) DEFAULT 0,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE rca_settori ENABLE ROW LEVEL SECURITY;
ALTER TABLE rca_usi ENABLE ROW LEVEL SECURITY;
ALTER TABLE rca_garanzie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rca_settori" ON rca_settori FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage rca_settori" ON rca_settori FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read rca_usi" ON rca_usi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage rca_usi" ON rca_usi FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read rca_garanzie" ON rca_garanzie FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage rca_garanzie" ON rca_garanzie FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: 16 Settori RCA
INSERT INTO rca_settori (codice, descrizione) VALUES
  ('01', 'Autovetture'),
  ('02', 'Autotassametri'),
  ('03', 'Autobus e Filobus'),
  ('04', 'Autocarri o Autoveicoli per trasporto cose'),
  ('05', 'Ciclomotori o Motoveicoli per trasporto cose'),
  ('06', 'Ciclomotori o Quadricicli legg.trasporto persone'),
  ('07', 'Motoveicoli per trasporto persone'),
  ('08', 'Macchine Operatici e Carrelli'),
  ('09', 'Macchine Agricole'),
  ('10', 'Natanti da diporto/uso privato/motore amovibile'),
  ('11', 'Natanti in servizio pubblico'),
  ('12', 'Rimorchi - Conto terzi'),
  ('13', 'Carrelli'),
  ('14', 'Autoarticolato'),
  ('15', 'Rimorchi - Conto Proprio'),
  ('16', 'Camper');

-- Seed: 43 Usi RCA
INSERT INTO rca_usi (settore_id, codice, descrizione)
SELECT s.id, u.codice, u.descrizione
FROM (VALUES
  ('01','1','PRIVATO'),
  ('01','10','PRIVATO ESC.NOL./LOC.'),
  ('01','13','Trasporto C/Proprio'),
  ('01','14','Trasporto C/Terzi'),
  ('01','15','Uso Speciale'),
  ('01','16','Uso Polizia'),
  ('01','17','Uso Protezione Civile'),
  ('01','2','LOCAZIONE SENZA CONDUC.'),
  ('01','3','NOLEGGIO CON CONDUCENTE'),
  ('01','4','AUTOTASSAMETRO'),
  ('01','5','SCUOLA GUIDA'),
  ('01','6','PROMISCUO << 25 Q.LI >>'),
  ('01','7','PROMISCUO << 35 Q.LI >>'),
  ('01','8','TRAZIONE ELETTRICA'),
  ('01','9','SERVIZIO ENTI'),
  ('03','1','URBANO'),
  ('03','2','EXTRAURBANO'),
  ('04','1','PRIVATO'),
  ('04','13','Trasporto C/Proprio'),
  ('04','14','Trasporto C/Terzi'),
  ('04','15','Uso Speciale'),
  ('04','2','LOCAZIONE SENZA CONDUC.'),
  ('04','4','CONTO TERZI'),
  ('04','5','CONTO PROPRIO'),
  ('04','6','NOLEGGIO SENZA CONDUC.'),
  ('05','1','TRASPORTO CONTO PROPRIO'),
  ('05','2','TRASPORTO CONTO TERZI'),
  ('05','3','TRASPORTO AUTOVEIC. (CP)'),
  ('05','4','TRASP.INFIAMM.CORR. (CP)'),
  ('05','5','TRASP.INFIAMM.CORROS.(CT)'),
  ('05','6','TRASP. GAS TOSSICI (CP)'),
  ('05','7','TRASP. GAS TOSSICI (CT)'),
  ('05','8','SCUOLA GUIDA'),
  ('05','9','TRASP. AUTOV. (CT)'),
  ('07','1','CONTO PROPRIO'),
  ('07','2','CONTO TERZI'),
  ('08','1','CONTO PROPRIO'),
  ('08','2','CONTO TERZI'),
  ('09','1','CONTO PROPRIO'),
  ('09','2','CONTO TERZI'),
  ('10','1','PRIVATO'),
  ('15','1','CONTO PROPRIO'),
  ('16','1','CONTO PROPRIO')
) AS u(settore_codice, codice, descrizione)
JOIN rca_settori s ON s.codice = u.settore_codice;