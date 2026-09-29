
-- 1. Estendi premi_garanzia_polizza
ALTER TABLE public.premi_garanzia_polizza
  ADD COLUMN IF NOT EXISTS aliquota_tasse_pct numeric,
  ADD COLUMN IF NOT EXISTS lordo_calcolato numeric,
  ADD COLUMN IF NOT EXISTS is_rca_principale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imposta_provinciale numeric,
  ADD COLUMN IF NOT EXISTS ssn numeric,
  ADD COLUMN IF NOT EXISTS codice_garanzia text;

-- Garantisce una sola riga "RCA principale" per titolo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rca_principale_per_titolo
  ON public.premi_garanzia_polizza(titolo_id)
  WHERE is_rca_principale = true;

-- 2. Tabella aliquote provinciali RCA
CREATE TABLE IF NOT EXISTS public.aliquote_provinciali_rca (
  provincia char(2) PRIMARY KEY,
  aliquota_pct numeric NOT NULL DEFAULT 16.0,
  aggiornato_il date NOT NULL DEFAULT CURRENT_DATE,
  note text
);

ALTER TABLE public.aliquote_provinciali_rca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aliquote_rca_read" ON public.aliquote_provinciali_rca;
CREATE POLICY "aliquote_rca_read" ON public.aliquote_provinciali_rca
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "aliquote_rca_write" ON public.aliquote_provinciali_rca;
CREATE POLICY "aliquote_rca_write" ON public.aliquote_provinciali_rca
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo IN ('admin','responsabile_sede')));

-- Seed province italiane (default 16%)
INSERT INTO public.aliquote_provinciali_rca (provincia, aliquota_pct) VALUES
('AG',16),('AL',16),('AN',16),('AO',9),('AP',16),('AQ',16),('AR',16),('AT',16),('AV',16),
('BA',16),('BG',16),('BI',16),('BL',16),('BN',16),('BO',16),('BR',16),('BS',16),('BT',16),('BZ',9),
('CA',16),('CB',16),('CE',16),('CH',16),('CL',16),('CN',16),('CO',16),('CR',16),('CS',16),('CT',16),('CZ',16),
('EN',16),
('FC',16),('FE',16),('FG',16),('FI',16),('FM',16),('FR',16),
('GE',16),('GO',16),('GR',16),
('IM',16),('IS',16),
('KR',16),
('LC',16),('LE',16),('LI',16),('LO',16),('LT',16),('LU',16),
('MB',16),('MC',16),('ME',16),('MI',16),('MN',16),('MO',16),('MS',16),('MT',16),
('NA',16),('NO',16),('NU',16),
('OR',16),
('PA',16),('PC',16),('PD',16),('PE',16),('PG',16),('PI',16),('PN',16),('PO',16),('PR',16),('PT',16),('PU',16),('PV',16),('PZ',16),
('RA',16),('RC',16),('RE',16),('RG',16),('RI',16),('RM',16),('RN',16),('RO',16),
('SA',16),('SI',16),('SO',16),('SP',16),('SR',16),('SS',16),('SU',16),('SV',16),
('TA',16),('TE',16),('TN',9),('TO',16),('TP',16),('TR',16),('TS',16),('TV',16),
('UD',16),
('VA',16),('VB',16),('VC',16),('VE',16),('VI',16),('VR',16),('VT',16),('VV',16)
ON CONFLICT (provincia) DO NOTHING;

-- 3. Audit trigger su premi_garanzia_polizza
DROP TRIGGER IF EXISTS audit_premi_garanzia_polizza ON public.premi_garanzia_polizza;
CREATE TRIGGER audit_premi_garanzia_polizza
  AFTER INSERT OR UPDATE OR DELETE ON public.premi_garanzia_polizza
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes('voce_rca');
