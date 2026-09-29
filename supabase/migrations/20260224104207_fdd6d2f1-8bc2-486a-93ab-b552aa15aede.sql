
-- Tabella distinte pagamenti provvigioni
CREATE TABLE public.pagamenti_provvigioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ufficio_id uuid REFERENCES public.uffici(id),
  pagato_a_user_id uuid NOT NULL REFERENCES public.profiles(id),
  periodo_da date NOT NULL,
  periodo_a date NOT NULL,
  totale_importo numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT 'bonifico',
  riferimento text,
  note text,
  creato_da uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabella righe pagamento
CREATE TABLE public.pagamenti_provvigioni_righe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL REFERENCES public.pagamenti_provvigioni(id) ON DELETE CASCADE,
  provvigione_id uuid NOT NULL REFERENCES public.provvigioni_generate(id),
  importo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indici
CREATE INDEX idx_pagamenti_provvigioni_user ON public.pagamenti_provvigioni(pagato_a_user_id);
CREATE INDEX idx_pagamenti_provvigioni_ufficio ON public.pagamenti_provvigioni(ufficio_id);
CREATE INDEX idx_pagamenti_provvigioni_periodo ON public.pagamenti_provvigioni(periodo_da, periodo_a);
CREATE INDEX idx_pagamenti_righe_pagamento ON public.pagamenti_provvigioni_righe(pagamento_id);
CREATE INDEX idx_pagamenti_righe_provvigione ON public.pagamenti_provvigioni_righe(provvigione_id);

-- Trigger validazione metodo
CREATE OR REPLACE FUNCTION public.validate_pagamenti_provvigioni()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.metodo NOT IN ('bonifico','contanti','altro') THEN
    RAISE EXCEPTION 'Invalid metodo: %', NEW.metodo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pagamenti_provvigioni
BEFORE INSERT OR UPDATE ON public.pagamenti_provvigioni
FOR EACH ROW EXECUTE FUNCTION public.validate_pagamenti_provvigioni();

-- RLS pagamenti_provvigioni
ALTER TABLE public.pagamenti_provvigioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all pagamenti_provvigioni"
ON public.pagamenti_provvigioni FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select pagamenti_provvigioni"
ON public.pagamenti_provvigioni FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cfo'));

CREATE POLICY "CFO insert pagamenti_provvigioni"
ON public.pagamenti_provvigioni FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cfo'));

CREATE POLICY "Ufficio select own pagamenti_provvigioni"
ON public.pagamenti_provvigioni FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio') AND ufficio_id = get_my_ufficio_id());

-- RLS pagamenti_provvigioni_righe
ALTER TABLE public.pagamenti_provvigioni_righe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all pagamenti_righe"
ON public.pagamenti_provvigioni_righe FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select pagamenti_righe"
ON public.pagamenti_provvigioni_righe FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cfo'));

CREATE POLICY "CFO insert pagamenti_righe"
ON public.pagamenti_provvigioni_righe FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cfo'));

CREATE POLICY "Ufficio select own pagamenti_righe"
ON public.pagamenti_provvigioni_righe FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio') AND pagamento_id IN (
  SELECT id FROM pagamenti_provvigioni WHERE ufficio_id = get_my_ufficio_id()
));
