-- Bozze apertura sinistro: stato dedicato + metadati wizard
ALTER TABLE public.sinistri DROP CONSTRAINT IF EXISTS sinistri_stato_check;
ALTER TABLE public.sinistri ADD CONSTRAINT sinistri_stato_check
  CHECK (stato IN (
    'bozza',
    'in_valutazione',
    'aperto',
    'in_lavorazione',
    'in_attesa_documenti',
    'in_liquidazione',
    'chiuso',
    'respinto'
  ));

ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS bozza_wizard_json jsonb;

COMMENT ON COLUMN public.sinistri.bozza_wizard_json IS
  'Metadati wizard apertura (step corrente, prescrizioni/reminder opzionali) per sinistri in stato bozza';

-- Checklist di default solo alla finalizzazione (non sulle bozze)
CREATE OR REPLACE FUNCTION public.trg_sinistri_default_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stato = 'bozza' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sinistro_checklist WHERE sinistro_id = NEW.id) THEN
    INSERT INTO public.sinistro_checklist (sinistro_id, descrizione, obbligatorio) VALUES
      (NEW.id, 'Denuncia sinistro compilata', true),
      (NEW.id, 'Documentazione fotografica', true),
      (NEW.id, 'Copia polizza allegata', true),
      (NEW.id, 'Modulo CID/CAI compilato', false);
  END IF;
  RETURN NEW;
END;
$$;

-- data_apertura opzionale finché la pratica resta bozza
ALTER TABLE public.sinistri ALTER COLUMN data_apertura DROP NOT NULL;
