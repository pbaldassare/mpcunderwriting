-- Flag per escludere il Produttore Sede dalle provvigioni su un cliente specifico.
-- Significativo solo per ruolo 'Produttore Sede'; l'AE mantiene la propria quota.
ALTER TABLE public.codici_commerciali_cliente
  ADD COLUMN IF NOT EXISTS escludi_provvigioni boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.codici_commerciali_cliente.escludi_provvigioni IS
  'Se true, il Produttore Sede assegnato non matura provvigioni sulle nuove polizze di questo cliente.';
