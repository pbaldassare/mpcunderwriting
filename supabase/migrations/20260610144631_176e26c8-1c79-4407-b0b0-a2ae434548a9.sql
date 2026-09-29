UPDATE public.email_branding
SET mittente_default = 'ConsulNet <noreply@cbnet.it>'
WHERE mittente_default IS DISTINCT FROM 'ConsulNet <noreply@cbnet.it>';

-- Se non esistono righe, creo la riga di default
INSERT INTO public.email_branding (mittente_default, colore_primario)
SELECT 'ConsulNet <noreply@cbnet.it>', '#0e7490'
WHERE NOT EXISTS (SELECT 1 FROM public.email_branding);