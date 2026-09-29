
-- 1) Create lookup tables
CREATE TABLE IF NOT EXISTS lookup_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_indotti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_attivita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_settori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_contratti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_fasce_fatturato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_fasce_dipendenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE lookup_zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_indotti ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_attivita ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_settori ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_contratti ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_fasce_fatturato ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_fasce_dipendenti ENABLE ROW LEVEL SECURITY;

-- 3) RLS policies - SELECT for authenticated
CREATE POLICY "Authenticated can read lookup_zone" ON lookup_zone FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_indotti" ON lookup_indotti FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_attivita" ON lookup_attivita FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_settori" ON lookup_settori FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_contratti" ON lookup_contratti FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_fasce_fatturato" ON lookup_fasce_fatturato FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read lookup_fasce_dipendenti" ON lookup_fasce_dipendenti FOR SELECT TO authenticated USING (true);

-- RLS policies - INSERT/UPDATE/DELETE for admin
CREATE POLICY "Admin can insert lookup_zone" ON lookup_zone FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_zone" ON lookup_zone FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_zone" ON lookup_zone FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_indotti" ON lookup_indotti FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_indotti" ON lookup_indotti FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_indotti" ON lookup_indotti FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_attivita" ON lookup_attivita FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_attivita" ON lookup_attivita FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_attivita" ON lookup_attivita FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_settori" ON lookup_settori FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_settori" ON lookup_settori FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_settori" ON lookup_settori FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_contratti" ON lookup_contratti FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_contratti" ON lookup_contratti FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_contratti" ON lookup_contratti FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_fasce_fatturato" ON lookup_fasce_fatturato FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_fasce_fatturato" ON lookup_fasce_fatturato FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_fasce_fatturato" ON lookup_fasce_fatturato FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert lookup_fasce_dipendenti" ON lookup_fasce_dipendenti FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update lookup_fasce_dipendenti" ON lookup_fasce_dipendenti FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete lookup_fasce_dipendenti" ON lookup_fasce_dipendenti FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) Populate Zone
INSERT INTO lookup_zone (codice, descrizione) VALUES
  ('CENTRO', 'Centro'),
  ('EMILIA_ROMAGNA', 'Emilia Romagna'),
  ('ESTERO', 'Estero'),
  ('FRIULI_VG', 'Friuli Venezia Giulia'),
  ('ISOLE', 'Isole'),
  ('LAZIO', 'Lazio'),
  ('LOMBARDIA', 'Lombardia'),
  ('NORD_EST', 'Nord-Est'),
  ('NORD_OVEST', 'Nord-Ovest'),
  ('PIEMONTE', 'Piemonte'),
  ('SUD', 'Sud'),
  ('TRENTINO_AA', 'Trentino Alto Adige'),
  ('VENETO', 'Veneto');

-- 5) Populate Settori
INSERT INTO lookup_settori (codice, descrizione) VALUES
  ('AGRICOLTURA', 'Agricoltura'),
  ('EDILIZIA_PRIV', 'Edilizia Privata'),
  ('EDILIZIA_PUB', 'Edilizia Pubblica'),
  ('GEST_RIFIUTI', 'Gestione Rifiuti'),
  ('SERV_IDRICO', 'Ser. idrico/Gest. rifiuti'),
  ('SERV_TURISMO', 'Servizi Promoz. Turistica'),
  ('SERV_SOCIALI', 'Servizi Sociali'),
  ('SERV_PA', 'Servizi Vari Alla P.A.');

-- 6) Populate Fasce Fatturato
INSERT INTO lookup_fasce_fatturato (codice, descrizione, ordine) VALUES
  ('FINO_2M', 'Fino a 2 milioni', 1),
  ('2_5M', 'Da 2 a 5 milioni', 2),
  ('5_10M', 'Da 5 a 10 milioni', 3),
  ('10_50M', 'Da 10 a 50 milioni', 4),
  ('50_100M', 'Da 50 a 100 milioni', 5),
  ('100_200M', 'Da 100 a 200 milioni', 6),
  ('OLTRE_200M', 'Oltre 200 milioni', 7);

-- 7) Populate Fasce Dipendenti
INSERT INTO lookup_fasce_dipendenti (codice, descrizione, ordine) VALUES
  ('FINO_9', 'Fino a 9', 1),
  ('10_49', 'Da 10 a 49', 2),
  ('50_249', 'Da 50 a 249', 3),
  ('250_499', 'Da 250 a 499', 4),
  ('OLTRE_500', 'Oltre 500 dipendenti', 5);

-- 8) Populate Attivita
INSERT INTO lookup_attivita (codice, descrizione) VALUES
  ('AEREOPORTI', 'Aereoporti'),
  ('AGENTI', 'Agenti'),
  ('AGRICOLTORI', 'Agricoltori'),
  ('ALIMENTARI', 'Alimentari'),
  ('AMM_UNICO', 'Amministratore Unico'),
  ('ARCHITETTO', 'Architetto'),
  ('ARTIGIANI', 'Artigiani'),
  ('ASSESSORE', 'Assessore'),
  ('ASSIST_UNIV', 'Assistenza Universitaria'),
  ('ASSOC_VOLONT', 'Assoc. Volontariato'),
  ('ASSIST_INFANZIA', 'Attività di assistenza diurna per l''infanzia'),
  ('AZ_AGRICOLA', 'Azienda Agricola'),
  ('BANCHE', 'Banche'),
  ('BROKERS', 'Brokers'),
  ('CASSE_PREV', 'Casse Previdenziali'),
  ('CAT_DA_DEF', 'Categoria da definire'),
  ('CMD_POL_LOC', 'Comandante Polizia Locale'),
  ('COMMERCIALISTA', 'Commercialista'),
  ('COMMERCIALISTI', 'Commercialisti'),
  ('COMMERCIANTI', 'Commercianti'),
  ('COMM_LIQUID', 'Commissario Liquidatore'),
  ('COMP_ASSIC', 'Compagnie di Assicuraz.'),
  ('COMP_NAVIG', 'Compagnie di Navigazione'),
  ('CONC_PARMALAT', 'Concessionarie Parmalat'),
  ('CONSIGLIERE', 'Consigliere'),
  ('CONS_COMUNALE', 'Consigliere Comunale');

-- 9) Populate Indotti
INSERT INTO lookup_indotti (codice, descrizione) VALUES
  ('GR_ENTI_PUB', 'Gruppo Enti Pubblici'),
  ('GR_ENTI_PUB_DIV', 'Gruppo Enti Pubblici Diversi'),
  ('GR_DIP_AMGA', 'Gruppo dipendenti AMGA SpA');

-- 10) Add columns to clienti if missing
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS fascia_fatturato text;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS fascia_dipendenti text;

-- 11) Update gruppi_finanziari with correct values
DELETE FROM gruppi_finanziari;
INSERT INTO gruppi_finanziari (codice, descrizione, nome) VALUES
  ('ASD', 'Ass.ne Sportiva Dilettantistica', 'Ass.ne Sportiva Dilettantistica'),
  ('ASS_CULT', 'Associazione Culturale', 'Associazione Culturale'),
  ('ASS_PROM', 'Associazione di Promozione Sociale', 'Associazione di Promozione Sociale'),
  ('ASS_VOL', 'Associazione Volontariato', 'Associazione Volontariato'),
  ('AZ_PART_PUB', 'Azienda Partecipata Pubblica', 'Azienda Partecipata Pubblica'),
  ('AZ_PRIV', 'Aziende Private', 'Aziende Private'),
  ('AZ_SAN_PRIV', 'Aziende Sanitarie Private', 'Aziende Sanitarie Private'),
  ('AZ_SAN_PUB', 'Aziende Sanitarie Pubbliche', 'Aziende Sanitarie Pubbliche'),
  ('ENTE_AUT', 'Ente autonomo funzionale di diritto', 'Ente autonomo funzionale di diritto'),
  ('EPE', 'Ente Pubblico Economico', 'Ente Pubblico Economico'),
  ('EP_NO_LUCRO', 'Enti Pubblici Senza Scopo di Lucro', 'Enti Pubblici Senza Scopo di Lucro'),
  ('EP_STRUM', 'Enti Pubblici Strumentali', 'Enti Pubblici Strumentali'),
  ('EP_TERRIT', 'Enti Pubblici Territoriali', 'Enti Pubblici Territoriali'),
  ('FARMAC', 'Farmaceutico', 'Farmaceutico'),
  ('IPAB', 'I.P.A.B.', 'I.P.A.B.'),
  ('LINEA_PERS', 'Linea Persona', 'Linea Persona');
