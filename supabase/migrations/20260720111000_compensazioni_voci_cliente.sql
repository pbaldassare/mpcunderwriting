-- Compensazioni: solo abbuoni/arrotondamenti in messa a cassa.
-- Disattiva eccedenza, sconto commerciale, spese accessorie.
-- Gli acconti restano su cliente_anticipi (causali ACC_*).

UPDATE public.causali_contabili
SET attivo = false
WHERE tipo_tabella = 'compensazione_messa_cassa'
  AND codice IN ('ECCED', 'SCONTO', 'SPESE');

COMMENT ON TABLE public.causali_contabili IS
  'Causali contabili. compensazione_messa_cassa: ABB_*/ARROT_* per messa a cassa; ACC_* per acconti cliente. ECCED/SCONTO/SPESE disattivate.';
