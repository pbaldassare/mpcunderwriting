CREATE TABLE IF NOT EXISTS public.email_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  colore_primario text NOT NULL DEFAULT '#0e7490',
  firma_html text DEFAULT '<p>Cordiali saluti,<br/><strong>ConsulNet</strong></p>',
  intestazione_html text DEFAULT '',
  mittente_default text NOT NULL DEFAULT 'ConsulNet <onboarding@resend.dev>',
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_branding_singleton_unique UNIQUE (singleton)
);

ALTER TABLE public.email_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read email_branding"
ON public.email_branding FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert email_branding"
ON public.email_branding FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));

CREATE POLICY "Admins can update email_branding"
ON public.email_branding FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));

CREATE POLICY "Admins can delete email_branding"
ON public.email_branding FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));

-- Inline updated_at trigger function (project-scoped)
CREATE OR REPLACE FUNCTION public.email_branding_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_email_branding_updated_at
BEFORE UPDATE ON public.email_branding
FOR EACH ROW EXECUTE FUNCTION public.email_branding_set_updated_at();

INSERT INTO public.email_branding (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view branding files"
ON storage.objects FOR SELECT USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'branding' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));

CREATE POLICY "Admins can update branding files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));

CREATE POLICY "Admins can delete branding files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'branding' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.ruolo = 'admin'));