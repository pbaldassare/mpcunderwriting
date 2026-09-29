
-- Visibilità globale read-only per ruolo 'ufficio' (Sede / Segreteria centrale)

-- titoli
DROP POLICY IF EXISTS "Ufficio select all titoli" ON public.titoli;
CREATE POLICY "Ufficio select all titoli" ON public.titoli
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- clienti
DROP POLICY IF EXISTS "Ufficio select all clienti" ON public.clienti;
CREATE POLICY "Ufficio select all clienti" ON public.clienti
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- prospect
DROP POLICY IF EXISTS "Ufficio select all prospect" ON public.prospect;
CREATE POLICY "Ufficio select all prospect" ON public.prospect
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- sinistri
DROP POLICY IF EXISTS "Ufficio select all sinistri" ON public.sinistri;
CREATE POLICY "Ufficio select all sinistri" ON public.sinistri
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- trattative
DROP POLICY IF EXISTS "Ufficio select all trattative" ON public.trattative;
CREATE POLICY "Ufficio select all trattative" ON public.trattative
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- movimenti_contabili
DROP POLICY IF EXISTS "Ufficio select all movimenti" ON public.movimenti_contabili;
CREATE POLICY "Ufficio select all movimenti" ON public.movimenti_contabili
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- rimessa_premi
DROP POLICY IF EXISTS "Ufficio select all rimessa" ON public.rimessa_premi;
CREATE POLICY "Ufficio select all rimessa" ON public.rimessa_premi
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- note_restituzione
DROP POLICY IF EXISTS "Ufficio select all note_restituzione" ON public.note_restituzione;
CREATE POLICY "Ufficio select all note_restituzione" ON public.note_restituzione
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- pagamenti_provvigioni
DROP POLICY IF EXISTS "Ufficio select all pagamenti_provvigioni" ON public.pagamenti_provvigioni;
CREATE POLICY "Ufficio select all pagamenti_provvigioni" ON public.pagamenti_provvigioni
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- appendici_polizza
DROP POLICY IF EXISTS "Ufficio select all appendici_polizza" ON public.appendici_polizza;
CREATE POLICY "Ufficio select all appendici_polizza" ON public.appendici_polizza
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));

-- conducenti_polizza
DROP POLICY IF EXISTS "Ufficio select all conducenti_polizza" ON public.conducenti_polizza;
CREATE POLICY "Ufficio select all conducenti_polizza" ON public.conducenti_polizza
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'::app_role));
