-- Snapshot pre-evento polizza (sospensione/riattivazione/sostituzione/estinzione)
CREATE TABLE IF NOT EXISTS public.titoli_eventi_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES public.titoli(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  evento_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  payload_jsonb jsonb NOT NULL,
  CONSTRAINT titoli_eventi_snapshot_tipo_chk CHECK (tipo_evento IN ('sospensione','riattivazione','sostituzione','estinzione'))
);

CREATE INDEX IF NOT EXISTS idx_titoli_eventi_snapshot_titolo ON public.titoli_eventi_snapshot(titolo_id, evento_at DESC);

ALTER TABLE public.titoli_eventi_snapshot ENABLE ROW LEVEL SECURITY;

-- Lettura: chiunque possa leggere il titolo (riusiamo la stessa logica permissiva attuale su titoli)
DROP POLICY IF EXISTS "Eventi snapshot leggibili agli autenticati" ON public.titoli_eventi_snapshot;
CREATE POLICY "Eventi snapshot leggibili agli autenticati"
ON public.titoli_eventi_snapshot
FOR SELECT
TO authenticated
USING (true);

-- Insert: autenticati (i dialog scrivono lato client)
DROP POLICY IF EXISTS "Eventi snapshot insertabili agli autenticati" ON public.titoli_eventi_snapshot;
CREATE POLICY "Eventi snapshot insertabili agli autenticati"
ON public.titoli_eventi_snapshot
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
