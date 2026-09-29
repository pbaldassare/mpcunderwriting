-- Coordinate geografiche opzionali sui sinistri (mappa area riservata).
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN public.sinistri.lat IS 'Latitudine WGS84 del luogo sinistro';
COMMENT ON COLUMN public.sinistri.lng IS 'Longitudine WGS84 del luogo sinistro';
