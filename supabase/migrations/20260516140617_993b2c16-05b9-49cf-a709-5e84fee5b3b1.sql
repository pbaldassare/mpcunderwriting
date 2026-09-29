
-- ============================================================
-- FASE 1: BACKUP
-- ============================================================
DROP TABLE IF EXISTS public._backup_compagnie_reset_20260516;
CREATE TABLE public._backup_compagnie_reset_20260516 AS
SELECT c.*,
  (SELECT jsonb_agg(to_jsonb(r.*)) FROM public.compagnia_rapporti r WHERE r.compagnia_id = c.id) AS rapporti_json
FROM public.compagnie c
WHERE c.tipo IN ('agenzia','broker');

ALTER TABLE public._backup_compagnie_reset_20260516 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only read backup compagnie reset"
ON public._backup_compagnie_reset_20260516
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ruolo = 'admin'));

-- ============================================================
-- FASE 2: AZZERAMENTO RIFERIMENTI (SET NULL manuale)
-- ============================================================
UPDATE public.titoli SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.sinistri SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.trattative SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.prodotti SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.flussi_compagnia SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.anagrafiche_professionali SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.dettaglio_riparto SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

UPDATE public.rimessa_premi SET compagnia_id = NULL
  WHERE compagnia_id IN (SELECT id FROM public._backup_compagnie_reset_20260516);

-- ============================================================
-- FASE 3: DELETE (compagnia_rapporti e provvigioni_compagnia_ramo cascade)
-- ============================================================
DELETE FROM public.compagnie WHERE tipo IN ('agenzia','broker');

-- ============================================================
-- FASE 4: UNIQUE su codice (case-insensitive) per le nuove agenzie
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_compagnie_codice_unique
  ON public.compagnie (LOWER(codice))
  WHERE codice IS NOT NULL;
