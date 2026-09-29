import { supabase } from "@/integrations/supabase/client";

export interface RelatedUser {
  userId: string;
  ruolo: string;
  nome: string;
}

/**
 * Given an entity type and ID, finds ALL related user IDs:
 * - cliente (user_id)
 * - produttore
 * - responsabile
 * - assegnato_a
 * - staff dell'ufficio
 * - codici commerciali (AE, corrispondenti, agenti)
 */
export async function findAllRelatedUsers(
  entitaTipo: string,
  entitaId: string
): Promise<RelatedUser[]> {
  const result: RelatedUser[] = [];
  const seen = new Set<string>();

  const add = (userId: string | null | undefined, ruolo: string, nome?: string) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    result.push({ userId, ruolo, nome: nome || "" });
  };

  try {
    if (entitaTipo === "cliente") {
      await resolveCliente(entitaId, add);
    } else if (entitaTipo === "titolo") {
      await resolveTitolo(entitaId, add);
    } else if (entitaTipo === "sinistro") {
      await resolveSinistro(entitaId, add);
    } else if (entitaTipo === "trattativa") {
      await resolveTrattativa(entitaId, add);
    } else if (entitaTipo === "prospect") {
      await resolveProspect(entitaId, add);
    }
  } catch (e) {
    console.error("findAllRelatedUsers error:", e);
  }

  return result;
}

type AddFn = (userId: string | null | undefined, ruolo: string, nome?: string) => void;

async function resolveCliente(clienteId: string, add: AddFn) {
  // 1. Cliente user_id
  const { data: cliente } = await supabase
    .from("clienti")
    .select("user_id, ufficio_id, nome, cognome, ragione_sociale")
    .eq("id", clienteId)
    .maybeSingle();

  if (cliente?.user_id) {
    add(cliente.user_id, "cliente", cliente.ragione_sociale || `${cliente.cognome || ""} ${cliente.nome || ""}`.trim());
  }

  // 2. Codici commerciali → profilo_id (AE, corrispondenti, agenti)
  const { data: commerciali } = await supabase
    .from("codici_commerciali_cliente")
    .select("profilo_id, ruolo, profiles:profilo_id(nome, cognome)")
    .eq("cliente_id", clienteId)
    .not("profilo_id", "is", null);

  (commerciali || []).forEach((c: any) => {
    const nome = c.profiles ? `${c.profiles.cognome || ""} ${c.profiles.nome || ""}`.trim() : "";
    add(c.profilo_id, c.ruolo || "commerciale", nome);
  });

  // 3. Staff dell'ufficio associato al cliente
  if (cliente?.ufficio_id) {
    await addUfficioStaff(cliente.ufficio_id, add);
  }
}

async function resolveTitolo(titoloId: string, add: AddFn) {
  const { data: titolo } = await supabase
    .from("titoli")
    .select("cliente_anagrafica_id, produttore_id, ufficio_id")
    .eq("id", titoloId)
    .maybeSingle();

  if (!titolo) return;

  // Produttore
  if (titolo.produttore_id) {
    const { data: prod } = await supabase
      .from("profiles")
      .select("id, nome, cognome")
      .eq("id", titolo.produttore_id)
      .maybeSingle();
    if (prod) add(prod.id, "produttore", `${prod.cognome || ""} ${prod.nome || ""}`.trim());
  }

  // Staff ufficio
  if (titolo.ufficio_id) {
    await addUfficioStaff(titolo.ufficio_id, add);
  }

  // Cliente + suoi commerciali
  if (titolo.cliente_anagrafica_id) {
    await resolveCliente(titolo.cliente_anagrafica_id, add);
  }
}

async function resolveSinistro(sinistroId: string, add: AddFn) {
  const { data: sinistro } = await supabase
    .from("sinistri")
    .select("cliente_anagrafica_id, titolo_id, responsabile_id, ufficio_id")
    .eq("id", sinistroId)
    .maybeSingle();

  if (!sinistro) return;

  // Responsabile
  if (sinistro.responsabile_id) {
    const { data: resp } = await supabase
      .from("profiles")
      .select("id, nome, cognome")
      .eq("id", sinistro.responsabile_id)
      .maybeSingle();
    if (resp) add(resp.id, "responsabile", `${resp.cognome || ""} ${resp.nome || ""}`.trim());
  }

  // Staff ufficio sinistro
  if (sinistro.ufficio_id) {
    await addUfficioStaff(sinistro.ufficio_id, add);
  }

  // Polizza collegata (produttore, ufficio polizza, commerciali)
  if (sinistro.titolo_id) {
    await resolveTitolo(sinistro.titolo_id, add);
  } else if (sinistro.cliente_anagrafica_id) {
    // Se non c'è polizza, risolvi comunque il cliente
    await resolveCliente(sinistro.cliente_anagrafica_id, add);
  }
}

async function resolveTrattativa(trattativaId: string, add: AddFn) {
  const { data: trattativa } = await supabase
    .from("trattative")
    .select("cliente_id, prospect_id, ufficio_id, assegnato_a")
    .eq("id", trattativaId)
    .maybeSingle();

  if (!trattativa) return;

  // Assegnato a
  if (trattativa.assegnato_a) {
    const { data: ass } = await supabase
      .from("profiles")
      .select("id, nome, cognome")
      .eq("id", trattativa.assegnato_a)
      .maybeSingle();
    if (ass) add(ass.id, "assegnato", `${ass.cognome || ""} ${ass.nome || ""}`.trim());
  }

  // Staff ufficio
  if (trattativa.ufficio_id) {
    await addUfficioStaff(trattativa.ufficio_id, add);
  }

  // Cliente + commerciali
  if (trattativa.cliente_id) {
    await resolveCliente(trattativa.cliente_id, add);
  }
}

async function resolveProspect(prospectId: string, add: AddFn) {
  const { data: prospect } = await supabase
    .from("prospect")
    .select("user_id, assegnato_a, ufficio_id, nome, cognome, ragione_sociale")
    .eq("id", prospectId)
    .maybeSingle();

  if (!prospect) return;

  // Prospect user
  if (prospect.user_id) {
    add(prospect.user_id, "prospect", prospect.ragione_sociale || `${prospect.cognome || ""} ${prospect.nome || ""}`.trim());
  }

  // Assegnato a
  if (prospect.assegnato_a) {
    const { data: ass } = await supabase
      .from("profiles")
      .select("id, nome, cognome")
      .eq("id", prospect.assegnato_a)
      .maybeSingle();
    if (ass) add(ass.id, "assegnato", `${ass.cognome || ""} ${ass.nome || ""}`.trim());
  }

  // Staff ufficio
  if (prospect.ufficio_id) {
    await addUfficioStaff(prospect.ufficio_id, add);
  }

  // Trattative collegate → assegnato_a
  const { data: trattative } = await supabase
    .from("trattative")
    .select("assegnato_a")
    .eq("prospect_id", prospectId)
    .not("assegnato_a", "is", null);

  for (const t of trattative || []) {
    if (t.assegnato_a) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .eq("id", t.assegnato_a)
        .maybeSingle();
      if (p) add(p.id, "assegnato", `${p.cognome || ""} ${p.nome || ""}`.trim());
    }
  }
}

async function addUfficioStaff(ufficioId: string, add: AddFn) {
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, nome, cognome, ruolo")
    .eq("ufficio_id", ufficioId)
    .eq("attivo", true)
    .in("ruolo", ["admin", "ufficio", "produttore", "backoffice", "contabilita", "cfo", "responsabile_sede"]);

  (staff || []).forEach((s: any) => {
    add(s.id, s.ruolo || "staff", `${s.cognome || ""} ${s.nome || ""}`.trim());
  });
}
