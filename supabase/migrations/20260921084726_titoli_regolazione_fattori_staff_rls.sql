-- titoli_regolazione_fattori: RLS era abilitata ma senza policy (INSERT negato a tutti).
-- Staff interno può leggere/scrivere i fattori delle polizze visibili (sede / global viewer).
-- Cliente/prospect: sola lettura se vedono il titolo padre; nessun write.

DROP POLICY IF EXISTS "Authenticated full access titoli_regolazione_fattori" ON public.titoli_regolazione_fattori;
DROP POLICY IF EXISTS "Select titoli_regolazione_fattori via titolo" ON public.titoli_regolazione_fattori;
DROP POLICY IF EXISTS "Staff insert titoli_regolazione_fattori" ON public.titoli_regolazione_fattori;
DROP POLICY IF EXISTS "Staff update titoli_regolazione_fattori" ON public.titoli_regolazione_fattori;
DROP POLICY IF EXISTS "Staff delete titoli_regolazione_fattori" ON public.titoli_regolazione_fattori;

-- Visibilità: se l'utente vede il titolo padre (RLS su titoli), vede i fattori.
CREATE POLICY "Select titoli_regolazione_fattori via titolo"
ON public.titoli_regolazione_fattori
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id = titoli_regolazione_fattori.titolo_id
  )
);

-- Write solo staff interno (user_roles + profiles.ruolo), esclusi cliente/prospect,
-- e solo su titoli della propria sede oppure global viewer (admin/cfo).
CREATE POLICY "Staff insert titoli_regolazione_fattori"
ON public.titoli_regolazione_fattori
FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('cliente', 'prospect')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'cliente'
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice', 'contabilita', 'produttore', 'corrispondente', 'manager')
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id = titoli_regolazione_fattori.titolo_id
      AND (
        public.is_global_viewer()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'cfo')
        )
        OR t.ufficio_id = ANY (public.get_my_ufficio_ids())
      )
  )
);

CREATE POLICY "Staff update titoli_regolazione_fattori"
ON public.titoli_regolazione_fattori
FOR UPDATE TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('cliente', 'prospect')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'cliente'
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice', 'contabilita', 'produttore', 'corrispondente', 'manager')
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id = titoli_regolazione_fattori.titolo_id
      AND (
        public.is_global_viewer()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'cfo')
        )
        OR t.ufficio_id = ANY (public.get_my_ufficio_ids())
      )
  )
)
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('cliente', 'prospect')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'cliente'
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice', 'contabilita', 'produttore', 'corrispondente', 'manager')
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id = titoli_regolazione_fattori.titolo_id
      AND (
        public.is_global_viewer()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'cfo')
        )
        OR t.ufficio_id = ANY (public.get_my_ufficio_ids())
      )
  )
);

CREATE POLICY "Staff delete titoli_regolazione_fattori"
ON public.titoli_regolazione_fattori
FOR DELETE TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ruolo IN ('cliente', 'prospect')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'cliente'
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cfo')
    OR public.has_role(auth.uid(), 'ufficio')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'contabilita')
    OR public.has_role(auth.uid(), 'produttore')
    OR public.has_role(auth.uid(), 'corrispondente')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ruolo IN ('admin', 'cfo', 'ufficio', 'backoffice', 'contabilita', 'produttore', 'corrispondente', 'manager')
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id = titoli_regolazione_fattori.titolo_id
      AND (
        public.is_global_viewer()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.ruolo IN ('admin', 'cfo')
        )
        OR t.ufficio_id = ANY (public.get_my_ufficio_ids())
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titoli_regolazione_fattori TO authenticated;
