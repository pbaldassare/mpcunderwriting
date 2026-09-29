-- 1. Insert 'cliente' role for Comune di Varese user
INSERT INTO public.user_roles (user_id, role)
VALUES ('746c540d-7e65-417d-9834-39612c13213a', 'cliente')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Drop the broken policy
DROP POLICY IF EXISTS "Cliente select own sinistri" ON public.sinistri;

-- 3. Create correct policy using get_my_cliente_ids()
CREATE POLICY "Cliente select own sinistri"
ON public.sinistri
FOR SELECT
TO authenticated
USING (
  cliente_anagrafica_id IN (SELECT get_my_cliente_ids())
);