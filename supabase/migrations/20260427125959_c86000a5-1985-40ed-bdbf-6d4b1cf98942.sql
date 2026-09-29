CREATE TABLE IF NOT EXISTS public.compagnie_snapshot_post_dedup AS
SELECT *, now() AS snapshot_at FROM public.compagnie;

COMMENT ON TABLE public.compagnie_snapshot_post_dedup IS 'Snapshot della tabella compagnie subito dopo l''aggregazione duplicati del 2026-04-27. Mantenere come riferimento.';