// Helper: invia notifiche agli utenti della sede + audit log su eventi
// dei movimenti bancari (approvato, ricongiunto, messo a cassa, incassato).
import { supabase } from "@/integrations/supabase/client";
import { fmtEuro } from "@/lib/formatCurrency";
import { logAttivita } from "@/lib/logAttivita";

export type EventoMovBancario = "approvato" | "ricongiunto" | "messo_a_cassa" | "incassato";

interface Params {
  evento: EventoMovBancario;
  movimentoId: string;
  ufficioId: string | null;
  importo: number;
  clienteLabel: string;
  statoNuovo: string;
  statoPrecedente?: string;
  note?: string;
}

const TITOLI: Record<EventoMovBancario, string> = {
  approvato: "Movimento bancario approvato",
  ricongiunto: "Movimento ricongiunto",
  messo_a_cassa: "Movimento messo a cassa",
  incassato: "Movimento incassato",
};

export async function notificaSedeMovimentoBancario({
  evento, movimentoId, ufficioId, importo, clienteLabel, statoNuovo, statoPrecedente, note,
}: Params): Promise<void> {
  const messaggio = `${clienteLabel} · ${fmtEuro(importo)} · stato: ${statoNuovo}${note ? ` · ${note}` : ""}`;

  // 1) Audit log (sempre, anche senza sede)
  await logAttivita({
    azione: `mov_bancario_${evento}`,
    entita_tipo: "movimento_bancario",
    entita_id: movimentoId,
    ufficio_id: ufficioId ?? undefined,
    dettagli_json: {
      evento,
      importo,
      cliente: clienteLabel,
      stato_precedente: statoPrecedente ?? null,
      stato_nuovo: statoNuovo,
      note: note ?? null,
    },
    severity: "info",
  });

  // 2) Notifiche agli utenti della sede
  if (!ufficioId) return;
  const { data: profili } = await supabase
    .from("profiles")
    .select("id, ruolo, attivo, ufficio_id")
    .eq("ufficio_id", ufficioId)
    .eq("attivo", true);

  const destinatari = (profili ?? []).filter(
    (p: any) => !["cliente", "prospect"].includes(p.ruolo),
  );
  if (destinatari.length === 0) return;

  const rows = destinatari.map((p: any) => ({
    destinatario_id: p.id,
    ufficio_id: ufficioId,
    tipo: `mov_bancario_${evento}`,
    titolo: TITOLI[evento],
    messaggio,
    entita_tipo: "movimento_bancario",
    entita_id: movimentoId,
    priorita: "normale",
  }));

  await supabase.from("notifiche").insert(rows as any);
}

