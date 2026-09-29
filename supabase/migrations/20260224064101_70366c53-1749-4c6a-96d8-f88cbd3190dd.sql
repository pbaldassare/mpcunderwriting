
-- Enum per ruoli
CREATE TYPE public.app_role AS ENUM ('admin', 'ufficio', 'produttore', 'contabilita', 'cfo', 'cliente');

-- Tabella user_roles (per RLS senza ricorsione)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Funzione security definer per check ruolo
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 1) uffici
CREATE TABLE public.uffici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_ufficio text NOT NULL,
  codice_ufficio text UNIQUE,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.uffici ENABLE ROW LEVEL SECURITY;

-- 2) profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  cognome text,
  email text,
  ruolo text CHECK (ruolo IN ('admin','ufficio','produttore','contabilita','cfo','cliente')),
  ufficio_id uuid REFERENCES public.uffici(id),
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) ruoli_template
CREATE TABLE public.ruoli_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_template text,
  ruolo_base text,
  descrizione text,
  permessi_json jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ruoli_template ENABLE ROW LEVEL SECURITY;

-- 4) log_attivita
CREATE TABLE public.log_attivita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  azione text,
  entita_tipo text,
  entita_id uuid,
  dettagli_json jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.log_attivita ENABLE ROW LEVEL SECURITY;

-- Helper: get ufficio_id dell'utente corrente (security definer, no recursion)
CREATE OR REPLACE FUNCTION public.get_my_ufficio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ===================== RLS POLICIES =====================

-- user_roles: solo admin può gestire, utenti possono vedere i propri
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES policies
CREATE POLICY "Admin select all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'cfo'));

CREATE POLICY "Ufficio select same office" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ufficio')
    AND ufficio_id = public.get_my_ufficio_id()
  );

CREATE POLICY "User select own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "User update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- UFFICI policies
CREATE POLICY "Admin select all uffici" ON public.uffici
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manage uffici" ON public.uffici
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select all uffici" ON public.uffici
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'cfo'));

CREATE POLICY "Ufficio select own office" ON public.uffici
  FOR SELECT TO authenticated
  USING (id = public.get_my_ufficio_id());

-- RUOLI_TEMPLATE policies (solo admin)
CREATE POLICY "Admin manage ruoli_template" ON public.ruoli_template
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated select ruoli_template" ON public.ruoli_template
  FOR SELECT TO authenticated
  USING (true);

-- LOG_ATTIVITA policies
CREATE POLICY "Admin select all logs" ON public.log_attivita
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CFO select all logs" ON public.log_attivita
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'cfo'));

CREATE POLICY "User select own logs" ON public.log_attivita
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated insert logs" ON public.log_attivita
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
