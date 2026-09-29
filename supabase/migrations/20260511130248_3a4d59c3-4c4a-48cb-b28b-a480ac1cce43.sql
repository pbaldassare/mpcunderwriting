-- 1) Cambia tipo colonna uso da text a uuid (sicuro: nessun record valorizzato)
ALTER TABLE public.veicoli_polizza
  ALTER COLUMN uso DROP DEFAULT,
  ALTER COLUMN uso TYPE uuid USING NULLIF(uso, '')::uuid;

-- 2) Aggiunge FK verso rca_usi (ON DELETE SET NULL per non bloccare cancellazioni)
ALTER TABLE public.veicoli_polizza
  ADD CONSTRAINT veicoli_polizza_uso_fkey
  FOREIGN KEY (uso) REFERENCES public.rca_usi(id) ON DELETE SET NULL;

-- 3) Indice di supporto al join
CREATE INDEX IF NOT EXISTS idx_veicoli_polizza_uso ON public.veicoli_polizza(uso);