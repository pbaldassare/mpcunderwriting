-- Mittente predefinito delle email: dominio mpcunderwriting.it, già verificato su Resend.
ALTER TABLE public.email_branding
  ALTER COLUMN mittente_default SET DEFAULT 'MPC Underwriting <noreply@mpcunderwriting.it>';

ALTER TABLE public.email_branding
  ALTER COLUMN firma_html SET DEFAULT '<p>Cordiali saluti,<br/><strong>MPC Underwriting</strong></p>';
