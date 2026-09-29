
-- Distinte giornaliere
CREATE TABLE public.distinte_giornaliere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_distinta DATE NOT NULL,
  ufficio_id UUID REFERENCES public.uffici(id),
  stato TEXT NOT NULL DEFAULT 'aperta',
  totale_contanti NUMERIC DEFAULT 0,
  totale_assegni NUMERIC DEFAULT 0,
  totale_bonifici NUMERIC DEFAULT 0,
  totale_pos NUMERIC DEFAULT 0,
  totale_generale NUMERIC DEFAULT 0,
  saldo_cassa_atteso NUMERIC DEFAULT 0,
  differenza_cassa NUMERIC DEFAULT 0,
  note TEXT,
  creato_da UUID REFERENCES public.profiles(id),
  chiuso_da UUID REFERENCES public.profiles(id),
  chiuso_il TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_distinta, ufficio_id)
);

-- Righe distinta
CREATE TABLE public.distinte_giornaliere_righe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distinta_id UUID NOT NULL REFERENCES public.distinte_giornaliere(id) ON DELETE CASCADE,
  movimento_id UUID REFERENCES public.movimenti_contabili(id),
  tipo_pagamento TEXT NOT NULL,
  importo NUMERIC NOT NULL DEFAULT 0,
  descrizione TEXT,
  riferimento TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chiusure contabili
CREATE TABLE public.chiusure_contabili (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'mensile',
  ufficio_id UUID REFERENCES public.uffici(id),
  stato TEXT NOT NULL DEFAULT 'in_corso',
  step_movimenti BOOLEAN DEFAULT false,
  step_riconciliazione BOOLEAN DEFAULT false,
  step_quadratura_iva BOOLEAN DEFAULT false,
  step_scadenziario BOOLEAN DEFAULT false,
  step_report BOOLEAN DEFAULT false,
  note TEXT,
  avviato_da UUID REFERENCES public.profiles(id),
  completato_da UUID REFERENCES public.profiles(id),
  completato_il TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(periodo, tipo, ufficio_id)
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_distinta_stato()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stato NOT IN ('aperta','chiusa','riaperta') THEN
    RAISE EXCEPTION 'Invalid stato distinta: %', NEW.stato;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_distinta_stato
  BEFORE INSERT OR UPDATE ON public.distinte_giornaliere
  FOR EACH ROW EXECUTE FUNCTION public.validate_distinta_stato();

CREATE OR REPLACE FUNCTION public.validate_chiusura_stato()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stato NOT IN ('in_corso','completata','errore') THEN
    RAISE EXCEPTION 'Invalid stato chiusura: %', NEW.stato;
  END IF;
  IF NEW.tipo NOT IN ('mensile','trimestrale','annuale') THEN
    RAISE EXCEPTION 'Invalid tipo chiusura: %', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_chiusura_stato
  BEFORE INSERT OR UPDATE ON public.chiusure_contabili
  FOR EACH ROW EXECUTE FUNCTION public.validate_chiusura_stato();

-- RLS
ALTER TABLE public.distinte_giornaliere ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distinte_giornaliere_righe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chiusure_contabili ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage distinte" ON public.distinte_giornaliere
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage distinte righe" ON public.distinte_giornaliere_righe
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage chiusure" ON public.chiusure_contabili
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
