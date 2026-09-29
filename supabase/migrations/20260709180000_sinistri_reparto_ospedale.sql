-- Reparto ospedaliero su sinistri (vista portale cliente sanitario)
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS reparto text;

COMMENT ON COLUMN public.sinistri.reparto IS
  'Reparto/area ospedaliera del sinistro (es. Chirurgia, Pronto Soccorso). Usato al posto della mappa geografica per clienti sanitari.';

-- Backfill demo ospedale pubblico
UPDATE public.sinistri SET reparto = 'Chirurgia'
WHERE numero_sinistro = 'SIN-OS-2025-001' AND reparto IS NULL;

UPDATE public.sinistri SET reparto = 'Ortopedia'
WHERE numero_sinistro = 'SIN-OS-2025-002' AND reparto IS NULL;

UPDATE public.sinistri SET reparto = 'Servizi Tecnici'
WHERE numero_sinistro = 'SIN-OS-2025-003' AND reparto IS NULL;

UPDATE public.sinistri SET reparto = 'Day Hospital'
WHERE numero_sinistro = 'SIN-OS-2025-004' AND reparto IS NULL;

UPDATE public.sinistri SET reparto = 'IT / Sistemi Informativi'
WHERE numero_sinistro = 'SIN-OS-2025-005' AND reparto IS NULL;

UPDATE public.sinistri SET reparto = 'Trasporto Sanitario'
WHERE numero_sinistro = 'SIN-OS-2026-006' AND reparto IS NULL;
