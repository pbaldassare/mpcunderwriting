
-- Drop overly permissive "global" policies for role 'ufficio' that bypass per-sede filtering
-- Keep only "...own..." policies which filter by ufficio_id = get_my_ufficio_id()

-- clienti
DROP POLICY IF EXISTS "Ufficio global delete clienti" ON public.clienti;
DROP POLICY IF EXISTS "Ufficio global insert clienti" ON public.clienti;
DROP POLICY IF EXISTS "Ufficio global update clienti" ON public.clienti;
DROP POLICY IF EXISTS "Ufficio select all clienti" ON public.clienti;

-- titoli
DROP POLICY IF EXISTS "Ufficio global delete titoli" ON public.titoli;
DROP POLICY IF EXISTS "Ufficio global insert titoli" ON public.titoli;
DROP POLICY IF EXISTS "Ufficio global update titoli" ON public.titoli;
DROP POLICY IF EXISTS "Ufficio select all titoli" ON public.titoli;

-- sinistri
DROP POLICY IF EXISTS "Ufficio global delete sinistri" ON public.sinistri;
DROP POLICY IF EXISTS "Ufficio global insert sinistri" ON public.sinistri;
DROP POLICY IF EXISTS "Ufficio global update sinistri" ON public.sinistri;
DROP POLICY IF EXISTS "Ufficio select all sinistri" ON public.sinistri;

-- movimenti_contabili
DROP POLICY IF EXISTS "Ufficio global delete movimenti_contabili" ON public.movimenti_contabili;
DROP POLICY IF EXISTS "Ufficio global insert movimenti_contabili" ON public.movimenti_contabili;
DROP POLICY IF EXISTS "Ufficio global update movimenti_contabili" ON public.movimenti_contabili;
DROP POLICY IF EXISTS "Ufficio select all movimenti" ON public.movimenti_contabili;
