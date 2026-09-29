
ALTER TABLE public.rimessa_premi
  ADD COLUMN IF NOT EXISTS data_messa_in_pagamento date,
  ADD COLUMN IF NOT EXISTS flusso_xml_id uuid REFERENCES public.documenti(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rimessa_premi.stato IS 'Stati ammessi: in_pagamento (preparata in E/C Agenzie), pronta (XML SEPA generato), pagata (pagamento confermato), annullata';
COMMENT ON COLUMN public.rimessa_premi.data_messa_in_pagamento IS 'Data in cui la rimessa è stata messa in pagamento da E/C Agenzie';
COMMENT ON COLUMN public.rimessa_premi.flusso_xml_id IS 'Documento (categoria Flusso SEPA) del flusso XML pain.001 generato per il batch';

CREATE INDEX IF NOT EXISTS idx_rimessa_premi_stato ON public.rimessa_premi(stato);
CREATE INDEX IF NOT EXISTS idx_rimessa_premi_conto_mittente ON public.rimessa_premi(conto_bancario_mittente_id);
