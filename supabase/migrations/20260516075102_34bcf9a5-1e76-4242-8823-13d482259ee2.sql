ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS brokeraggio_firma numeric,
  ADD COLUMN IF NOT EXISTS brokeraggio_quietanza numeric,
  ADD COLUMN IF NOT EXISTS percentuale_brokeraggio numeric;

COMMENT ON COLUMN public.titoli.brokeraggio_firma IS 'Quota di brokeraggio (importo €) sulla rata di firma. Default = premio_netto × percentuale_brokeraggio / 100, editabile.';
COMMENT ON COLUMN public.titoli.brokeraggio_quietanza IS 'Quota di brokeraggio (importo €) sulla quietanza. Default = premio_netto_quietanza × percentuale_brokeraggio / 100, editabile.';
COMMENT ON COLUMN public.titoli.percentuale_brokeraggio IS 'Percentuale brokeraggio applicata. Default da anagrafiche_professionali.percentuale_consulenza del Produttore selezionato, editabile.';