
-- Step 1: Add user_id to clienti table
ALTER TABLE public.clienti ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_clienti_user_id ON public.clienti(user_id) WHERE user_id IS NOT NULL;

-- Step 2: Security definer helper function
CREATE OR REPLACE FUNCTION public.get_my_cliente_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM clienti WHERE user_id = auth.uid()
$$;

-- Step 3: RLS policies
CREATE POLICY "cliente_select_own" ON public.clienti
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "cliente_select_own_titoli" ON public.titoli
FOR SELECT TO authenticated
USING (cliente_anagrafica_id IN (SELECT public.get_my_cliente_ids()));
