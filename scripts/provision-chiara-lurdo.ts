/**
 * Account Chiara Lurdo: responsabile sede Parma, collegata anche a Milano.
 *   bun scripts/provision-chiara-lurdo.ts
 *
 * Email: clurdo@consulbrokers.it
 * Password default: Leone123!
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

const EMAIL = "clurdo@consulbrokers.it";
const PASSWORD = "Leone123!";
const NOME = "Chiara";
const COGNOME = "Lurdo";
const RUOLO = "ufficio";
const PARMA_ID = "a0d09b81-777d-43be-9615-e9d051786e2c";
const MILANO_ID = "193e0821-4105-4ad6-a72e-0ebb6c116797";

const PERMESSI: Record<string, boolean> = {
  titoli: true,
  sinistri: true,
  trattative: true,
  calendario: true,
  contabilita: true,
  rimesse: true,
  ec_clienti: true,
  chiusure: true,
  report: true,
  estrazioni: true,
  anagrafiche: true,
  agenzie: true,
  documentale: true,
  template: true,
  provvigioni: true,
  tabelle_base: false,
  uffici: false,
  manutenzione: false,
  riceve_provvigioni: false,
  pagamenti_provvigioni: false,
};

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = listed?.users?.find((u) => u.email?.toLowerCase() === EMAIL)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: NOME, cognome: COGNOME },
    });
    if (error || !data.user) throw new Error(error?.message || "createUser failed");
    userId = data.user.id;
    console.log("created", EMAIL);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    console.log("updated", EMAIL);
  }

  const { error: pErr } = await admin.from("profiles").upsert({
    id: userId,
    nome: NOME,
    cognome: COGNOME,
    email: EMAIL,
    ruolo: RUOLO,
    ufficio_id: PARMA_ID,
    attivo: true,
    permessi_json: PERMESSI,
  }, { onConflict: "id" });
  if (pErr) throw new Error(pErr.message);

  await admin.from("user_roles").delete().eq("user_id", userId).neq("role", RUOLO);
  const { error: rErr } = await admin.from("user_roles").upsert(
    { user_id: userId, role: RUOLO },
    { onConflict: "user_id,role" },
  );
  if (rErr) throw new Error(rErr.message);

  await admin.from("profilo_sedi").upsert([
    { profilo_id: userId, ufficio_id: PARMA_ID, primaria: true },
    { profilo_id: userId, ufficio_id: MILANO_ID, primaria: false },
  ], { onConflict: "profilo_id,ufficio_id" });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
