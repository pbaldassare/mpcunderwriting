-- Tabelle marche e modelli veicoli
CREATE TABLE public.veicoli_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  popolare boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.veicoli_modelli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.veicoli_marche(id) ON DELETE CASCADE,
  nome text NOT NULL,
  popolare boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marca_id, nome)
);

CREATE INDEX idx_veicoli_modelli_marca ON public.veicoli_modelli(marca_id);

-- Trigger uppercase
CREATE OR REPLACE FUNCTION public.veicoli_uppercase_nome()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome = UPPER(TRIM(NEW.nome));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_veicoli_marche_upper BEFORE INSERT OR UPDATE ON public.veicoli_marche
FOR EACH ROW EXECUTE FUNCTION public.veicoli_uppercase_nome();

CREATE TRIGGER trg_veicoli_modelli_upper BEFORE INSERT OR UPDATE ON public.veicoli_modelli
FOR EACH ROW EXECUTE FUNCTION public.veicoli_uppercase_nome();

-- RLS
ALTER TABLE public.veicoli_marche ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veicoli_modelli ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read marche" ON public.veicoli_marche
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert marche" ON public.veicoli_marche
FOR INSERT TO authenticated WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cliente','prospect'))
);

CREATE POLICY "Staff update marche" ON public.veicoli_marche
FOR UPDATE TO authenticated USING (
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cliente','prospect'))
);

CREATE POLICY "Authenticated read modelli" ON public.veicoli_modelli
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert modelli" ON public.veicoli_modelli
FOR INSERT TO authenticated WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cliente','prospect'))
);

CREATE POLICY "Staff update modelli" ON public.veicoli_modelli
FOR UPDATE TO authenticated USING (
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo IN ('cliente','prospect'))
);

-- Seed marche popolari
INSERT INTO public.veicoli_marche (nome, popolare) VALUES
('FIAT', true), ('VOLKSWAGEN', true), ('FORD', true), ('OPEL', true),
('RENAULT', true), ('PEUGEOT', true), ('CITROEN', true), ('TOYOTA', true),
('NISSAN', true), ('HYUNDAI', true), ('KIA', true), ('BMW', true),
('MERCEDES-BENZ', true), ('AUDI', true), ('ALFA ROMEO', true), ('LANCIA', true),
('JEEP', true), ('DACIA', true), ('SKODA', true), ('SEAT', true),
('MINI', true), ('SMART', true), ('VOLVO', true), ('MAZDA', true),
('HONDA', true), ('SUZUKI', true), ('MITSUBISHI', true), ('LAND ROVER', true),
('JAGUAR', false), ('PORSCHE', false), ('TESLA', true), ('DR', false), ('MG', false);

-- Seed modelli (per marche principali)
INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('PANDA', true), ('500', true), ('500X', true), ('500L', true), ('PUNTO', true),
  ('TIPO', true), ('BRAVO', false), ('DOBLO', false), ('DUCATO', true), ('QUBO', false),
  ('500E', false), ('600', false), ('MULTIPLA', false), ('IDEA', false), ('CROMA', false)
) AS m(modello, popolare)
WHERE nome = 'FIAT';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('GOLF', true), ('POLO', true), ('PASSAT', true), ('T-ROC', true), ('TIGUAN', true),
  ('UP!', false), ('ID.3', false), ('ID.4', false), ('TOUAREG', false), ('TOURAN', false),
  ('T-CROSS', true), ('ARTEON', false), ('CADDY', false), ('TRANSPORTER', false), ('SHARAN', false)
) AS m(modello, popolare)
WHERE nome = 'VOLKSWAGEN';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('FIESTA', true), ('FOCUS', true), ('PUMA', true), ('KUGA', true), ('MONDEO', false),
  ('ECOSPORT', false), ('TRANSIT', true), ('KA', false), ('B-MAX', false), ('EDGE', false),
  ('GALAXY', false), ('S-MAX', false), ('TOURNEO', false), ('MUSTANG', false)
) AS m(modello, popolare)
WHERE nome = 'FORD';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('CORSA', true), ('ASTRA', true), ('MOKKA', true), ('CROSSLAND', true), ('GRANDLAND', true),
  ('INSIGNIA', false), ('ZAFIRA', false), ('MERIVA', false), ('ADAM', false), ('COMBO', false),
  ('VIVARO', false), ('MOVANO', false), ('AGILA', false)
) AS m(modello, popolare)
WHERE nome = 'OPEL';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('CLIO', true), ('CAPTUR', true), ('MEGANE', true), ('SCENIC', true), ('TWINGO', true),
  ('KADJAR', false), ('KOLEOS', false), ('TALISMAN', false), ('ZOE', false), ('ARKANA', true),
  ('AUSTRAL', true), ('MASTER', false), ('TRAFIC', false), ('KANGOO', false)
) AS m(modello, popolare)
WHERE nome = 'RENAULT';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('208', true), ('308', true), ('2008', true), ('3008', true), ('5008', true),
  ('108', false), ('508', false), ('PARTNER', false), ('RIFTER', false), ('BOXER', false),
  ('EXPERT', false), ('TRAVELLER', false)
) AS m(modello, popolare)
WHERE nome = 'PEUGEOT';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('C3', true), ('C4', true), ('C5 AIRCROSS', true), ('C3 AIRCROSS', true), ('BERLINGO', true),
  ('C1', false), ('C5', false), ('C5 X', false), ('JUMPY', false), ('JUMPER', false),
  ('SPACETOURER', false), ('DS3', false), ('DS4', false)
) AS m(modello, popolare)
WHERE nome = 'CITROEN';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('YARIS', true), ('YARIS CROSS', true), ('COROLLA', true), ('C-HR', true), ('RAV4', true),
  ('AYGO', false), ('AYGO X', true), ('PRIUS', false), ('CAMRY', false), ('HIGHLANDER', false),
  ('LAND CRUISER', false), ('HILUX', false), ('PROACE', false), ('MIRAI', false), ('GR YARIS', false)
) AS m(modello, popolare)
WHERE nome = 'TOYOTA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('MICRA', true), ('JUKE', true), ('QASHQAI', true), ('X-TRAIL', true), ('LEAF', false),
  ('NOTE', false), ('PULSAR', false), ('NAVARA', false), ('NV200', false), ('TOWNSTAR', false),
  ('ARIYA', false), ('PATROL', false)
) AS m(modello, popolare)
WHERE nome = 'NISSAN';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('I10', true), ('I20', true), ('I30', true), ('TUCSON', true), ('KONA', true),
  ('SANTA FE', false), ('IONIQ', false), ('IONIQ 5', true), ('BAYON', true), ('NEXO', false),
  ('I40', false), ('STARIA', false)
) AS m(modello, popolare)
WHERE nome = 'HYUNDAI';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('PICANTO', true), ('RIO', true), ('CEED', true), ('SPORTAGE', true), ('STONIC', true),
  ('NIRO', true), ('SORENTO', false), ('EV6', false), ('XCEED', false), ('PROCEED', false),
  ('SOUL', false), ('VENGA', false)
) AS m(modello, popolare)
WHERE nome = 'KIA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('SERIE 1', true), ('SERIE 2', true), ('SERIE 3', true), ('SERIE 4', false), ('SERIE 5', true),
  ('SERIE 6', false), ('SERIE 7', false), ('SERIE 8', false), ('X1', true), ('X2', true),
  ('X3', true), ('X4', false), ('X5', true), ('X6', false), ('X7', false),
  ('I3', false), ('I4', false), ('IX', false), ('IX1', true), ('IX3', false),
  ('Z4', false), ('M2', false), ('M3', false), ('M4', false)
) AS m(modello, popolare)
WHERE nome = 'BMW';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('CLASSE A', true), ('CLASSE B', true), ('CLASSE C', true), ('CLASSE E', true), ('CLASSE S', false),
  ('CLA', true), ('CLS', false), ('GLA', true), ('GLB', true), ('GLC', true),
  ('GLE', false), ('GLS', false), ('SLC', false), ('SL', false), ('AMG GT', false),
  ('EQA', false), ('EQB', false), ('EQC', false), ('EQE', false), ('EQS', false),
  ('CITAN', false), ('VITO', false), ('SPRINTER', true), ('CLASSE V', false), ('CLASSE G', false)
) AS m(modello, popolare)
WHERE nome = 'MERCEDES-BENZ';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('A1', true), ('A3', true), ('A4', true), ('A5', false), ('A6', true),
  ('A7', false), ('A8', false), ('Q2', true), ('Q3', true), ('Q4 E-TRON', true),
  ('Q5', true), ('Q7', false), ('Q8', false), ('E-TRON', false), ('TT', false),
  ('R8', false), ('S3', false), ('RS3', false), ('RS6', false)
) AS m(modello, popolare)
WHERE nome = 'AUDI';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('GIULIETTA', true), ('GIULIA', true), ('STELVIO', true), ('TONALE', true), ('MITO', false),
  ('4C', false), ('159', false), ('147', false), ('BRERA', false), ('SPIDER', false)
) AS m(modello, popolare)
WHERE nome = 'ALFA ROMEO';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('Y', true), ('YPSILON', true), ('DELTA', false), ('MUSA', false), ('THESIS', false),
  ('PHEDRA', false), ('VOYAGER', false)
) AS m(modello, popolare)
WHERE nome = 'LANCIA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('RENEGADE', true), ('COMPASS', true), ('AVENGER', true), ('WRANGLER', false), ('CHEROKEE', false),
  ('GRAND CHEROKEE', false), ('GLADIATOR', false)
) AS m(modello, popolare)
WHERE nome = 'JEEP';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('SANDERO', true), ('DUSTER', true), ('JOGGER', true), ('SPRING', true), ('LOGAN', false),
  ('LODGY', false), ('DOKKER', false), ('BIGSTER', false)
) AS m(modello, popolare)
WHERE nome = 'DACIA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('FABIA', true), ('SCALA', true), ('OCTAVIA', true), ('SUPERB', false), ('KAMIQ', true),
  ('KAROQ', true), ('KODIAQ', true), ('ENYAQ', false), ('CITIGO', false), ('RAPID', false)
) AS m(modello, popolare)
WHERE nome = 'SKODA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('IBIZA', true), ('LEON', true), ('ARONA', true), ('ATECA', true), ('TARRACO', false),
  ('ALHAMBRA', false), ('MII', false), ('FORMENTOR', true), ('BORN', false)
) AS m(modello, popolare)
WHERE nome = 'SEAT';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('COOPER', true), ('COUNTRYMAN', true), ('CLUBMAN', false), ('CABRIO', false),
  ('ELECTRIC', false), ('ACEMAN', false)
) AS m(modello, popolare)
WHERE nome = 'MINI';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('FORTWO', true), ('FORFOUR', true), ('#1', false), ('#3', false), ('ROADSTER', false)
) AS m(modello, popolare)
WHERE nome = 'SMART';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('XC40', true), ('XC60', true), ('XC90', true), ('V40', false), ('V60', true),
  ('V90', false), ('S60', false), ('S90', false), ('EX30', false), ('EX90', false), ('C40', false)
) AS m(modello, popolare)
WHERE nome = 'VOLVO';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('CX-3', true), ('CX-30', true), ('CX-5', true), ('CX-60', true), ('MAZDA2', true),
  ('MAZDA3', true), ('MAZDA6', false), ('MX-5', false), ('MX-30', false), ('CX-9', false)
) AS m(modello, popolare)
WHERE nome = 'MAZDA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('JAZZ', true), ('CIVIC', true), ('CR-V', true), ('HR-V', true), ('E:NY1', false),
  ('NSX', false), ('ACCORD', false)
) AS m(modello, popolare)
WHERE nome = 'HONDA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('SWIFT', true), ('IGNIS', true), ('VITARA', true), ('S-CROSS', true), ('JIMNY', true),
  ('BALENO', false), ('CELERIO', false), ('ACROSS', false), ('SWACE', false)
) AS m(modello, popolare)
WHERE nome = 'SUZUKI';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('SPACE STAR', true), ('ASX', true), ('OUTLANDER', true), ('ECLIPSE CROSS', true),
  ('L200', false), ('PAJERO', false), ('COLT', false)
) AS m(modello, popolare)
WHERE nome = 'MITSUBISHI';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('DISCOVERY', true), ('DISCOVERY SPORT', true), ('DEFENDER', true), ('RANGE ROVER', true),
  ('RANGE ROVER SPORT', true), ('RANGE ROVER EVOQUE', true), ('RANGE ROVER VELAR', false), ('FREELANDER', false)
) AS m(modello, popolare)
WHERE nome = 'LAND ROVER';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('XE', false), ('XF', false), ('F-PACE', true), ('E-PACE', true), ('I-PACE', false),
  ('F-TYPE', false)
) AS m(modello, popolare)
WHERE nome = 'JAGUAR';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('911', true), ('718 CAYMAN', false), ('718 BOXSTER', false), ('PANAMERA', false),
  ('CAYENNE', true), ('MACAN', true), ('TAYCAN', true)
) AS m(modello, popolare)
WHERE nome = 'PORSCHE';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('MODEL 3', true), ('MODEL Y', true), ('MODEL S', false), ('MODEL X', false), ('CYBERTRUCK', false)
) AS m(modello, popolare)
WHERE nome = 'TESLA';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('ZERO', true), ('1.0', true), ('3.0', true), ('4.0', true), ('5.0', true),
  ('6.0', true), ('F35', false), ('EVO 5', false), ('EVO 6', false)
) AS m(modello, popolare)
WHERE nome = 'DR';

INSERT INTO public.veicoli_modelli (marca_id, nome, popolare)
SELECT id, m.modello, m.popolare FROM public.veicoli_marche
CROSS JOIN LATERAL (VALUES
  ('ZS', true), ('HS', true), ('MARVEL R', false), ('MG4', true), ('MG5', false), ('CYBERSTER', false)
) AS m(modello, popolare)
WHERE nome = 'MG';