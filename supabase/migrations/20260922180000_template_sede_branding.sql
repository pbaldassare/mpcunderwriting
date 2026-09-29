-- Template email associati a una sede + branding personalizzabile per sede.
-- La riga branding esistente (ufficio_id NULL) resta il fallback globale.

ALTER TABLE public.template_email
  ADD COLUMN IF NOT EXISTS ufficio_id uuid REFERENCES public.uffici(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS template_email_ufficio_idx
  ON public.template_email (ufficio_id);

ALTER TABLE public.email_branding
  ADD COLUMN IF NOT EXISTS ufficio_id uuid REFERENCES public.uffici(id) ON DELETE CASCADE;

ALTER TABLE public.email_branding
  DROP CONSTRAINT IF EXISTS email_branding_singleton_unique;

CREATE UNIQUE INDEX IF NOT EXISTS email_branding_ufficio_uidx
  ON public.email_branding (ufficio_id)
  WHERE ufficio_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_branding_globale_uidx
  ON public.email_branding ((1))
  WHERE ufficio_id IS NULL;

COMMENT ON COLUMN public.template_email.ufficio_id IS
  'Sede di default a cui è associato il template. NULL = globale (tutte le sedi).';

COMMENT ON COLUMN public.email_branding.ufficio_id IS
  'Sede del branding. NULL = branding globale di fallback.';
