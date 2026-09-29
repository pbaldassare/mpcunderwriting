-- Livella i privilegi RLS: tutti gli utenti autenticati ottengono gli stessi
-- diritti dell'admin su tutte le tabelle operative.
-- Le policy precedenti (filtrate per ruolo) vengono sostituite con policy
-- che verificano solo auth.uid() IS NOT NULL.
-- Le policy dei portali cliente/prospect (SELECT sui propri dati) rimangono.

-- Helper riutilizzabile
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated full access profiles" ON public.profiles;

CREATE POLICY "Authenticated full access profiles" ON public.profiles
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- titoli
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access titoli" ON public.titoli;
DROP POLICY IF EXISTS "Staff can view titoli" ON public.titoli;
DROP POLICY IF EXISTS "Staff can manage titoli" ON public.titoli;
DROP POLICY IF EXISTS "Authenticated full access titoli" ON public.titoli;

CREATE POLICY "Authenticated full access titoli" ON public.titoli
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- quietanze
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access quietanze" ON public.quietanze;
DROP POLICY IF EXISTS "Staff can manage quietanze" ON public.quietanze;
DROP POLICY IF EXISTS "Authenticated full access quietanze" ON public.quietanze;

CREATE POLICY "Authenticated full access quietanze" ON public.quietanze
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- clienti
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access clienti" ON public.clienti;
DROP POLICY IF EXISTS "Staff can view clienti" ON public.clienti;
DROP POLICY IF EXISTS "Staff can manage clienti" ON public.clienti;
DROP POLICY IF EXISTS "Authenticated full access clienti" ON public.clienti;

CREATE POLICY "Authenticated full access clienti" ON public.clienti
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- compagnie
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Staff can view compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Authenticated full access compagnie" ON public.compagnie;

CREATE POLICY "Authenticated full access compagnie" ON public.compagnie
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- compagnia_rapporti
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access compagnia_rapporti" ON public.compagnia_rapporti;
DROP POLICY IF EXISTS "Staff can view compagnia_rapporti" ON public.compagnia_rapporti;
DROP POLICY IF EXISTS "Authenticated full access compagnia_rapporti" ON public.compagnia_rapporti;

CREATE POLICY "Authenticated full access compagnia_rapporti" ON public.compagnia_rapporti
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- sinistri
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access sinistri" ON public.sinistri;
DROP POLICY IF EXISTS "Staff can manage sinistri" ON public.sinistri;
DROP POLICY IF EXISTS "Authenticated full access sinistri" ON public.sinistri;

CREATE POLICY "Authenticated full access sinistri" ON public.sinistri
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- sinistro_eventi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access sinistro_eventi" ON public.sinistro_eventi;
DROP POLICY IF EXISTS "Staff can manage sinistro_eventi" ON public.sinistro_eventi;
DROP POLICY IF EXISTS "Authenticated full access sinistro_eventi" ON public.sinistro_eventi;

CREATE POLICY "Authenticated full access sinistro_eventi" ON public.sinistro_eventi
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- trattative
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access trattative" ON public.trattative;
DROP POLICY IF EXISTS "Staff can manage trattative" ON public.trattative;
DROP POLICY IF EXISTS "Authenticated full access trattative" ON public.trattative;

CREATE POLICY "Authenticated full access trattative" ON public.trattative
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- rimessa_premi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access rimessa_premi" ON public.rimessa_premi;
DROP POLICY IF EXISTS "Staff gestisce rimesse" ON public.rimessa_premi;
DROP POLICY IF EXISTS "Authenticated full access rimessa_premi" ON public.rimessa_premi;

CREATE POLICY "Authenticated full access rimessa_premi" ON public.rimessa_premi
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- rimessa_dettaglio
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access rimessa_dettaglio" ON public.rimessa_dettaglio;
DROP POLICY IF EXISTS "Staff gestisce rimessa_dettaglio" ON public.rimessa_dettaglio;
DROP POLICY IF EXISTS "Authenticated full access rimessa_dettaglio" ON public.rimessa_dettaglio;

CREATE POLICY "Authenticated full access rimessa_dettaglio" ON public.rimessa_dettaglio
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- provvigioni_generate
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access provvigioni_generate" ON public.provvigioni_generate;
DROP POLICY IF EXISTS "Staff can view provvigioni_generate" ON public.provvigioni_generate;
DROP POLICY IF EXISTS "Authenticated full access provvigioni_generate" ON public.provvigioni_generate;

CREATE POLICY "Authenticated full access provvigioni_generate" ON public.provvigioni_generate
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- pagamenti_provvigioni
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access pagamenti_provvigioni" ON public.pagamenti_provvigioni;
DROP POLICY IF EXISTS "Staff can manage pagamenti_provvigioni" ON public.pagamenti_provvigioni;
DROP POLICY IF EXISTS "Authenticated full access pagamenti_provvigioni" ON public.pagamenti_provvigioni;

CREATE POLICY "Authenticated full access pagamenti_provvigioni" ON public.pagamenti_provvigioni
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- pagamenti_provvigioni_righe
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access pagamenti_provvigioni_righe" ON public.pagamenti_provvigioni_righe;
DROP POLICY IF EXISTS "Authenticated full access pagamenti_provvigioni_righe" ON public.pagamenti_provvigioni_righe;

CREATE POLICY "Authenticated full access pagamenti_provvigioni_righe" ON public.pagamenti_provvigioni_righe
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- movimenti_bancari
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access movimenti_bancari" ON public.movimenti_bancari;
DROP POLICY IF EXISTS "Staff gestisce movimenti_bancari" ON public.movimenti_bancari;
DROP POLICY IF EXISTS "Authenticated full access movimenti_bancari" ON public.movimenti_bancari;

CREATE POLICY "Authenticated full access movimenti_bancari" ON public.movimenti_bancari
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- incroci_bancari
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access incroci_bancari" ON public.incroci_bancari;
DROP POLICY IF EXISTS "Authenticated full access incroci_bancari" ON public.incroci_bancari;

CREATE POLICY "Authenticated full access incroci_bancari" ON public.incroci_bancari
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- movimenti_contabili
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access movimenti_contabili" ON public.movimenti_contabili;
DROP POLICY IF EXISTS "Staff can manage movimenti_contabili" ON public.movimenti_contabili;
DROP POLICY IF EXISTS "Authenticated full access movimenti_contabili" ON public.movimenti_contabili;

CREATE POLICY "Authenticated full access movimenti_contabili" ON public.movimenti_contabili
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- chiusure_contabili
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access chiusure_contabili" ON public.chiusure_contabili;
DROP POLICY IF EXISTS "Authenticated full access chiusure_contabili" ON public.chiusure_contabili;

CREATE POLICY "Authenticated full access chiusure_contabili" ON public.chiusure_contabili
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- cliente_anticipi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access cliente_anticipi" ON public.cliente_anticipi;
DROP POLICY IF EXISTS "Staff gestisce anticipi" ON public.cliente_anticipi;
DROP POLICY IF EXISTS "Authenticated full access cliente_anticipi" ON public.cliente_anticipi;

CREATE POLICY "Authenticated full access cliente_anticipi" ON public.cliente_anticipi
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- cliente_anticipi_utilizzi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access cliente_anticipi_utilizzi" ON public.cliente_anticipi_utilizzi;
DROP POLICY IF EXISTS "Authenticated full access cliente_anticipi_utilizzi" ON public.cliente_anticipi_utilizzi;

CREATE POLICY "Authenticated full access cliente_anticipi_utilizzi" ON public.cliente_anticipi_utilizzi
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- titoli_compensazioni
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access titoli_compensazioni" ON public.titoli_compensazioni;
DROP POLICY IF EXISTS "Staff gestisce compensazioni" ON public.titoli_compensazioni;
DROP POLICY IF EXISTS "Authenticated full access titoli_compensazioni" ON public.titoli_compensazioni;

CREATE POLICY "Authenticated full access titoli_compensazioni" ON public.titoli_compensazioni
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- giroconti_cliente (già creata nella migrazione 20260702160000, la ridefinisce)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff gestisce giroconti" ON public.giroconti_cliente;
DROP POLICY IF EXISTS "Authenticated full access giroconti_cliente" ON public.giroconti_cliente;

CREATE POLICY "Authenticated full access giroconti_cliente" ON public.giroconti_cliente
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- anagrafiche_professionali
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access anagrafiche_professionali" ON public.anagrafiche_professionali;
DROP POLICY IF EXISTS "Staff can view anagrafiche_professionali" ON public.anagrafiche_professionali;
DROP POLICY IF EXISTS "Authenticated full access anagrafiche_professionali" ON public.anagrafiche_professionali;

CREATE POLICY "Authenticated full access anagrafiche_professionali" ON public.anagrafiche_professionali
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- prospect
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access prospect" ON public.prospect;
DROP POLICY IF EXISTS "Staff can manage prospect" ON public.prospect;
DROP POLICY IF EXISTS "Authenticated full access prospect" ON public.prospect;

CREATE POLICY "Authenticated full access prospect" ON public.prospect
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- documenti
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access documenti" ON public.documenti;
DROP POLICY IF EXISTS "Authenticated can manage documenti" ON public.documenti;
DROP POLICY IF EXISTS "Authenticated full access documenti" ON public.documenti;

CREATE POLICY "Authenticated full access documenti" ON public.documenti
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- notifiche
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own notifiche" ON public.notifiche;
DROP POLICY IF EXISTS "Admin full access notifiche" ON public.notifiche;
DROP POLICY IF EXISTS "Authenticated full access notifiche" ON public.notifiche;

CREATE POLICY "Authenticated full access notifiche" ON public.notifiche
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- log_attivita
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access log_attivita" ON public.log_attivita;
DROP POLICY IF EXISTS "Authenticated insert log_attivita" ON public.log_attivita;
DROP POLICY IF EXISTS "Authenticated full access log_attivita" ON public.log_attivita;

CREATE POLICY "Authenticated full access log_attivita" ON public.log_attivita
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- anomalie_sistema
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access anomalie_sistema" ON public.anomalie_sistema;
DROP POLICY IF EXISTS "Authenticated full access anomalie_sistema" ON public.anomalie_sistema;

CREATE POLICY "Authenticated full access anomalie_sistema" ON public.anomalie_sistema
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- uffici
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access uffici" ON public.uffici;
DROP POLICY IF EXISTS "Staff can view uffici" ON public.uffici;
DROP POLICY IF EXISTS "Authenticated full access uffici" ON public.uffici;

CREATE POLICY "Authenticated full access uffici" ON public.uffici
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- conti_bancari
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access conti_bancari" ON public.conti_bancari;
DROP POLICY IF EXISTS "Staff can manage conti_bancari" ON public.conti_bancari;
DROP POLICY IF EXISTS "Authenticated full access conti_bancari" ON public.conti_bancari;

CREATE POLICY "Authenticated full access conti_bancari" ON public.conti_bancari
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- rami / gruppi_ramo / prodotti
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access rami" ON public.rami;
DROP POLICY IF EXISTS "Authenticated full access rami" ON public.rami;
CREATE POLICY "Authenticated full access rami" ON public.rami
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin full access gruppi_ramo" ON public.gruppi_ramo;
DROP POLICY IF EXISTS "Authenticated full access gruppi_ramo" ON public.gruppi_ramo;
CREATE POLICY "Authenticated full access gruppi_ramo" ON public.gruppi_ramo
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin full access prodotti" ON public.prodotti;
DROP POLICY IF EXISTS "Authenticated full access prodotti" ON public.prodotti;
CREATE POLICY "Authenticated full access prodotti" ON public.prodotti
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- premi_garanzia_polizza
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access premi_garanzia_polizza" ON public.premi_garanzia_polizza;
DROP POLICY IF EXISTS "Authenticated full access premi_garanzia_polizza" ON public.premi_garanzia_polizza;

CREATE POLICY "Authenticated full access premi_garanzia_polizza" ON public.premi_garanzia_polizza
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- note_restituzione / note_restituzione_dettaglio
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access note_restituzione" ON public.note_restituzione;
DROP POLICY IF EXISTS "Authenticated full access note_restituzione" ON public.note_restituzione;
CREATE POLICY "Authenticated full access note_restituzione" ON public.note_restituzione
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin full access note_restituzione_dettaglio" ON public.note_restituzione_dettaglio;
DROP POLICY IF EXISTS "Authenticated full access note_restituzione_dettaglio" ON public.note_restituzione_dettaglio;
CREATE POLICY "Authenticated full access note_restituzione_dettaglio" ON public.note_restituzione_dettaglio
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- estratti_conto
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access estratti_conto" ON public.estratti_conto;
DROP POLICY IF EXISTS "Authenticated full access estratti_conto" ON public.estratti_conto;

CREATE POLICY "Authenticated full access estratti_conto" ON public.estratti_conto
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated full access user_roles" ON public.user_roles;

CREATE POLICY "Authenticated full access user_roles" ON public.user_roles
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- impostazioni_sistema / impostazioni_ufficio
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access impostazioni_sistema" ON public.impostazioni_sistema;
DROP POLICY IF EXISTS "Authenticated full access impostazioni_sistema" ON public.impostazioni_sistema;
CREATE POLICY "Authenticated full access impostazioni_sistema" ON public.impostazioni_sistema
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin full access impostazioni_ufficio" ON public.impostazioni_ufficio;
DROP POLICY IF EXISTS "Authenticated full access impostazioni_ufficio" ON public.impostazioni_ufficio;
CREATE POLICY "Authenticated full access impostazioni_ufficio" ON public.impostazioni_ufficio
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Aggiorna GRANT su is_authenticated per completezza
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO service_role;
