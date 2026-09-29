-- Terza fonte bandi: Infordat (oltre TED e Mondo Appalti).
ALTER TABLE public.bandi_pubblici
  DROP CONSTRAINT IF EXISTS bandi_pubblici_fonte_check;
ALTER TABLE public.bandi_pubblici
  ADD CONSTRAINT bandi_pubblici_fonte_check
  CHECK (fonte IN ('ted', 'mondoappalti', 'infordat'));

ALTER TABLE public.ricerche_bandi
  DROP CONSTRAINT IF EXISTS ricerche_bandi_fonte_check;
ALTER TABLE public.ricerche_bandi
  ADD CONSTRAINT ricerche_bandi_fonte_check
  CHECK (fonte IN ('ted', 'mondoappalti', 'infordat', 'entrambe', 'tutte'));

INSERT INTO public.impostazioni_sistema (chiave, valore_json, descrizione)
VALUES
  ('infordat_username', '""'::jsonb, 'Username banca dati Infordat per la ricerca bandi'),
  ('infordat_password', '""'::jsonb, 'Password banca dati Infordat per la ricerca bandi')
ON CONFLICT (chiave) DO NOTHING;
