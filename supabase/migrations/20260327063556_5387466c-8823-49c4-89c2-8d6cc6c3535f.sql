
-- Nullify existing FK references before clearing gruppi_finanziari
UPDATE public.clienti SET gruppo_finanziario_id = NULL WHERE gruppo_finanziario_id IS NOT NULL;

-- Now safe to delete and repopulate
DELETE FROM public.gruppi_finanziari;
INSERT INTO public.gruppi_finanziari (codice, nome, descrizione, attivo) VALUES
('EPT','Enti Pubblici Territoriali','Comuni, Province, Regioni, Comunità Montane',true),
('EPA','Enti Pubblici non territoriali','ASL, Ospedali, Università, INPS, INAIL',true),
('AZP','Aziende Private','Società di capitali e di persone private',true),
('AZS','Aziende Sanitarie','ASL, Aziende Ospedaliere, IRCCS',true),
('ASD','Ass.ne Sportiva Dilettantistica','Associazioni sportive dilettantistiche',true),
('COOP','Cooperative','Cooperative sociali, di lavoro, di servizi',true),
('FOND','Fondazioni','Fondazioni private e pubbliche',true),
('ONLUS','ONLUS / ETS','Organizzazioni non lucrative di utilità sociale',true),
('PROF','Professionisti','Studi professionali e liberi professionisti',true),
('PRIV','Privati','Persone fisiche',true),
('COND','Condomini','Condomini residenziali e commerciali',true),
('SIND','Sindacati','Organizzazioni sindacali',true),
('CONS','Consorzi','Consorzi di imprese e di bonifica',true),
('SCUO','Scuole','Istituti scolastici di ogni ordine e grado',true);
