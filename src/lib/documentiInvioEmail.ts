import { supabase } from "@/integrations/supabase/client";
import { htmlToPlainText, plainTextToEmailHtml, sendEmail } from "@/lib/sendEmail";
import { logAttivita } from "@/lib/logAttivita";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { uint8ToBase64 } from "@/lib/documentiEcCliente";

export const DOC_CATEGORIA_INVIATO_EMAIL = "documento_inviato_email";
export const LOG_AZIONE_DOCUMENTO_EMAIL = "documento_email_inviato";

export type DestinatarioTipoInvioDoc = "cliente" | "compagnia";

export type InvioEmailDocumentoMeta = {
  destinatario: string | null;
  oggetto: string | null;
  inviato_il: string | null;
  send_id: string | null;
  destinatario_tipo?: string | null;
};

export type DestinatarioInvioDocOption = {
  tipo: DestinatarioTipoInvioDoc;
  label: string;
  email: string;
};

export type ContestoInvioDocumento = {
  numeroPolizza: string | null;
  clienteNome: string | null;
  compagniaNome: string | null;
  destinatari: DestinatarioInvioDocOption[];
};

export type StoricoInvioDocumento = {
  cliente: InvioEmailDocumentoMeta | null;
  compagnia: InvioEmailDocumentoMeta | null;
  countCliente: number;
  countCompagnia: number;
};

/** Metadati invio per documenti categoria documento_inviato_email (riga archiviata). */
export async function fetchMetadatiInvioDocumentoEmail(
  documentiIds: string[],
): Promise<Map<string, InvioEmailDocumentoMeta>> {
  const wanted = new Set(documentiIds);
  const out = new Map<string, InvioEmailDocumentoMeta>();
  if (wanted.size === 0) return out;

  const { data, error } = await supabase
    .from("log_attivita")
    .select("dettagli_json, created_at")
    .eq("azione", LOG_AZIONE_DOCUMENTO_EMAIL)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  for (const row of data ?? []) {
    const d = row.dettagli_json as Record<string, unknown> | null;
    const ids = (d?.documenti_ids as string[] | undefined) ?? [];
    const meta: InvioEmailDocumentoMeta = {
      destinatario: (d?.destinatario as string) ?? null,
      oggetto: (d?.oggetto as string) ?? null,
      inviato_il: (d?.inviato_il as string) ?? (row.created_at as string) ?? null,
      send_id: (d?.send_id as string) ?? null,
      destinatario_tipo: (d?.destinatario_tipo as string) ?? null,
    };
    for (const id of ids) {
      if (wanted.has(id) && !out.has(id)) out.set(id, meta);
    }
    if (out.size >= wanted.size) break;
  }
  return out;
}

/**
 * Storico invii per documento origine: se già mandato a cliente e/o compagnia
 * (ultimo invio + conteggio). Usato per badge sulla riga originale.
 */
export async function fetchStoricoInviiPerDocumentoOrigine(
  documentoOrigineIds: string[],
): Promise<Map<string, StoricoInvioDocumento>> {
  const wanted = new Set(documentoOrigineIds);
  const out = new Map<string, StoricoInvioDocumento>();
  if (wanted.size === 0) return out;

  for (const id of wanted) {
    out.set(id, { cliente: null, compagnia: null, countCliente: 0, countCompagnia: 0 });
  }

  const { data, error } = await supabase
    .from("log_attivita")
    .select("dettagli_json, created_at")
    .eq("azione", LOG_AZIONE_DOCUMENTO_EMAIL)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  for (const row of data ?? []) {
    const d = row.dettagli_json as Record<string, unknown> | null;
    const origineId = (d?.documento_origine_id as string | undefined) || null;
    if (!origineId || !wanted.has(origineId)) continue;

    const tipo = String(d?.destinatario_tipo || "").toLowerCase();
    if (tipo !== "cliente" && tipo !== "compagnia") continue;

    const meta: InvioEmailDocumentoMeta = {
      destinatario: (d?.destinatario as string) ?? null,
      oggetto: (d?.oggetto as string) ?? null,
      inviato_il: (d?.inviato_il as string) ?? (row.created_at as string) ?? null,
      send_id: (d?.send_id as string) ?? null,
      destinatario_tipo: tipo,
    };

    const cur = out.get(origineId)!;
    if (tipo === "cliente") {
      cur.countCliente += 1;
      if (!cur.cliente) cur.cliente = meta;
    } else {
      cur.countCompagnia += 1;
      if (!cur.compagnia) cur.compagnia = meta;
    }
  }

  return out;
}

function clienteDisplay(c: {
  ragione_sociale?: string | null;
  cognome?: string | null;
  nome?: string | null;
} | null): string | null {
  if (!c) return null;
  return c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() || null;
}

function firstEmail(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    const t = (v || "").trim();
    if (t.includes("@")) return t;
  }
  return null;
}

/** Risolve email cliente/compagnia in base all'entità del documento. */
export async function fetchContestoInvioDocumento(opts: {
  entitaTipo: string;
  entitaId: string;
}): Promise<ContestoInvioDocumento> {
  const { entitaTipo, entitaId } = opts;
  const empty: ContestoInvioDocumento = {
    numeroPolizza: null,
    clienteNome: null,
    compagniaNome: null,
    destinatari: [],
  };

  if (entitaTipo === "titolo") {
    const { data: t, error } = await supabase
      .from("titoli")
      .select(
        `id, numero_titolo,
         cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, email, pec, referente_email, ragione_sociale, cognome, nome),
         compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, mail, pec, email_messe_a_cassa, mail_avvisi),
         compagnia_rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(id, email_messe_a_cassa, email_referente, email_estratto_conto)`,
      )
      .eq("id", entitaId)
      .maybeSingle();
    if (error) throw error;
    if (!t) return empty;

    const cli = t.cliente_anagrafica as any;
    const comp = t.compagnia_diretta as any;
    const rapp = t.compagnia_rapporto as any;
    const destinatari: DestinatarioInvioDocOption[] = [];
    const emailCli = firstEmail(cli?.email, cli?.pec, cli?.referente_email);
    if (emailCli) {
      destinatari.push({
        tipo: "cliente",
        label: `Cliente — ${clienteDisplay(cli) || "anagrafica"}`,
        email: emailCli,
      });
    } else {
      destinatari.push({
        tipo: "cliente",
        label: `Cliente — ${clienteDisplay(cli) || "anagrafica"} (email mancante)`,
        email: "",
      });
    }
    const emailComp = firstEmail(
      rapp?.email_messe_a_cassa,
      rapp?.email_referente,
      rapp?.email_estratto_conto,
      comp?.email_messe_a_cassa,
      comp?.mail_avvisi,
      comp?.mail,
      comp?.pec,
    );
    destinatari.push({
      tipo: "compagnia",
      label: `Compagnia — ${comp?.nome || "agenzia"}`,
      email: emailComp || "",
    });

    return {
      numeroPolizza: t.numero_titolo || null,
      clienteNome: clienteDisplay(cli),
      compagniaNome: comp?.nome || null,
      destinatari,
    };
  }

  if (entitaTipo === "cliente") {
    const { data: c, error } = await supabase
      .from("clienti")
      .select("id, email, pec, referente_email, ragione_sociale, cognome, nome")
      .eq("id", entitaId)
      .maybeSingle();
    if (error) throw error;
    const emailCli = firstEmail(c?.email, c?.pec, c?.referente_email);
    return {
      numeroPolizza: null,
      clienteNome: clienteDisplay(c),
      compagniaNome: null,
      destinatari: [
        {
          tipo: "cliente",
          label: `Cliente — ${clienteDisplay(c) || "anagrafica"}`,
          email: emailCli || "",
        },
      ],
    };
  }

  if (entitaTipo === "sinistro") {
    const { data: s, error } = await supabase
      .from("sinistri")
      .select(
        `id,
         clienti:clienti!sinistri_cliente_anagrafica_id_fkey(id, email, pec, referente_email, ragione_sociale, cognome, nome),
         compagnie:compagnie!sinistri_compagnia_id_fkey(id, nome, mail, pec, email_messe_a_cassa, mail_avvisi)`,
      )
      .eq("id", entitaId)
      .maybeSingle();
    if (error) throw error;
    const cli = s?.clienti as any;
    const comp = s?.compagnie as any;
    const destinatari: DestinatarioInvioDocOption[] = [];
    destinatari.push({
      tipo: "cliente",
      label: `Cliente — ${clienteDisplay(cli) || "anagrafica"}`,
      email: firstEmail(cli?.email, cli?.pec, cli?.referente_email) || "",
    });
    if (comp) {
      destinatari.push({
        tipo: "compagnia",
        label: `Compagnia — ${comp.nome || "agenzia"}`,
        email: firstEmail(comp.email_messe_a_cassa, comp.mail_avvisi, comp.mail, comp.pec) || "",
      });
    }
    return {
      numeroPolizza: null,
      clienteNome: clienteDisplay(cli),
      compagniaNome: comp?.nome || null,
      destinatari,
    };
  }

  return empty;
}

export function defaultOggettoInvioDocumento(nomeFile: string, numeroPolizza: string | null): string {
  const pol = numeroPolizza ? ` — Polizza ${numeroPolizza}` : "";
  return `Documento: ${nomeFile}${pol}`;
}

export function defaultCorpoInvioDocumento(opts: {
  nomeFile: string;
  clienteNome: string | null;
  compagniaNome: string | null;
  numeroPolizza: string | null;
  destinatarioTipo: DestinatarioTipoInvioDoc;
}): string {
  const saluto =
    opts.destinatarioTipo === "compagnia"
      ? `Gentile ${opts.compagniaNome || "Compagnia"},`
      : `Gentile ${opts.clienteNome || "Cliente"},`;
  const pol = opts.numeroPolizza ? ` relativo alla polizza ${opts.numeroPolizza}` : "";
  return [
    saluto,
    "",
    `in allegato troverete il documento ${opts.nomeFile}${pol}.`,
    "",
    "Cordiali saluti,",
    "Consulbrokers",
  ].join("\n");
}

export function applyTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

type DocumentoRow = {
  id: string;
  nome_file: string;
  path_storage: string;
  bucket_name: string;
  entita_tipo: string;
  entita_id: string;
};

/** Invia email con allegato, archivia copia come documento inviato e scrive log. */
export async function inviaDocumentoPerEmail(opts: {
  documento: DocumentoRow;
  to: string;
  subject: string;
  html: string;
  destinatarioTipo: DestinatarioTipoInvioDoc;
  templateId?: string | null;
}): Promise<{ ok: boolean; error?: string; documentoId?: string | null; archiveError?: string | null }> {
  const to = opts.to.trim();
  if (!to.includes("@")) return { ok: false, error: "Email destinatario non valida" };
  if (!opts.subject.trim()) return { ok: false, error: "Oggetto obbligatorio" };
  if (!opts.html.trim()) return { ok: false, error: "Corpo email obbligatorio" };

  const { data: blob, error: dlErr } = await supabase.storage
    .from(opts.documento.bucket_name)
    .download(opts.documento.path_storage);
  if (dlErr || !blob) {
    return { ok: false, error: dlErr?.message || "Impossibile scaricare il documento" };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const b64 = uint8ToBase64(bytes);
  const sentAt = new Date();
  const corpoHtml = /<\w+[\s>]/.test(opts.html) ? opts.html : plainTextToEmailHtml(opts.html);

  const sendRes = await sendEmail({
    to,
    subject: opts.subject.trim(),
    html: corpoHtml,
    apply_branding: true,
    template_id: opts.templateId || undefined,
    attachments: [{ filename: opts.documento.nome_file, content: b64 }],
  });

  if (!sendRes.success) {
    await logAttivita({
      azione: "documento_email_errore",
      entita_tipo: opts.documento.entita_tipo,
      entita_id: opts.documento.entita_id,
      dettagli_json: {
        documento_origine_id: opts.documento.id,
        destinatario: to,
        destinatario_tipo: opts.destinatarioTipo,
        oggetto: opts.subject,
        errore: sendRes.error,
      },
    });
    return { ok: false, error: sendRes.error || "Invio email fallito" };
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const archiveName = `Inviato — ${opts.documento.nome_file}`;
  const path = `${opts.documento.entita_tipo}/${opts.documento.entita_id}/inviati/${Date.now()}_${sanitizeStorageFileName(opts.documento.nome_file)}`;

  let documentoId: string | null = null;
  let archiveError: string | null = null;
  try {
    const contentType = blob.type || "application/octet-stream";
    const { error: upErr } = await supabase.storage.from(opts.documento.bucket_name).upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data: doc, error: insErr } = await supabase
      .from("documenti")
      .insert({
        nome_file: archiveName,
        path_storage: path,
        bucket_name: opts.documento.bucket_name,
        entita_tipo: opts.documento.entita_tipo,
        entita_id: opts.documento.entita_id,
        categoria: DOC_CATEGORIA_INVIATO_EMAIL,
        visibile_al_cliente: opts.destinatarioTipo === "cliente",
        caricato_da: userId,
        caricato_da_cliente: false,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    documentoId = doc?.id ?? null;
  } catch (e: any) {
    archiveError = e?.message || String(e);
  }

  await logAttivita({
    azione: LOG_AZIONE_DOCUMENTO_EMAIL,
    entita_tipo: opts.documento.entita_tipo,
    entita_id: opts.documento.entita_id,
    dettagli_json: {
      documento_origine_id: opts.documento.id,
      documenti_ids: documentoId ? [documentoId] : [],
      destinatario: to,
      destinatario_tipo: opts.destinatarioTipo,
      oggetto: opts.subject.trim(),
      send_id: sendRes.id ?? null,
      path_storage: documentoId ? path : null,
      archive_error: archiveError,
      inviato_il: sentAt.toISOString(),
      nome_file: opts.documento.nome_file,
    },
  });

  return { ok: true, documentoId, archiveError };
}
