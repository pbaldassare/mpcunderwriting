import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  scheduledForMessaCassaSeraleOggi,
  shouldScheduleMessaCassaSerale,
} from "@/lib/messaCassaSerale";

export type NotificaMessaCassaInvokeResult = {
  ok?: boolean;
  skipped?: boolean;
  recipient?: string;
  recipients?: string[];
  invii?: number;
  invii_ok?: number;
  invii_ko?: number;
  agenzie?: number;
  send_id?: string | null;
  documenti_archiviati?: number;
  path_storage?: string;
  error?: string;
  archive_error?: string;
  coda_flush?: number;
};

export type NotificaMessaCassaOutcome = {
  mode: "sent" | "scheduled" | "skipped";
  data: NotificaMessaCassaInvokeResult | null;
  error: Error | null;
};

/** Invoca notifica agenzia. Più titoli di agenzie diverse → un invio (mail+PDF) per agenzia. */
export async function invokeNotificaMessaCassa(
  titoloIds: string[],
  opts?: { force?: boolean; flushCoda?: boolean },
): Promise<{ data: NotificaMessaCassaInvokeResult | null; error: Error | null }> {
  const ids = [...new Set(titoloIds.filter(Boolean))];
  const flushCoda = opts?.flushCoda !== false;
  if (ids.length === 0 && !flushCoda) return { data: null, error: null };

  const body: Record<string, unknown> = {
    force: opts?.force ?? false,
    flush_coda: flushCoda,
  };
  if (ids.length === 1) body.titolo_id = ids[0];
  else if (ids.length > 1) body.titolo_ids = ids;

  const { data, error } = await supabase.functions.invoke("notifica-messa-cassa-agenzia", { body });
  return { data: (data ?? null) as NotificaMessaCassaInvokeResult | null, error: error ?? null };
}

export async function enqueueNotificaMessaCassaSerale(
  titoloIds: string[],
): Promise<{ error: Error | null }> {
  const ids = [...new Set(titoloIds.filter(Boolean))];
  if (ids.length === 0) return { error: null };

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase.from("messa_cassa_notifiche_coda") as any).insert({
    titolo_ids: ids,
    scheduled_for: scheduledForMessaCassaSeraleOggi(),
    status: "pending",
    created_by: userData.user?.id ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Se «messa a cassa serale» ed è prima delle 19:30 (Italia) mette in coda;
 * altrimenti invia subito (e svuota eventuali scadenze già dovute).
 */
export async function scheduleOrInvokeNotificaMessaCassa(
  titoloIds: string[],
  opts?: { serale?: boolean; force?: boolean },
): Promise<NotificaMessaCassaOutcome> {
  const ids = [...new Set(titoloIds.filter(Boolean))];
  if (ids.length === 0) return { mode: "skipped", data: null, error: null };

  if (shouldScheduleMessaCassaSerale(!!opts?.serale)) {
    const { error } = await enqueueNotificaMessaCassaSerale(ids);
    if (error) return { mode: "scheduled", data: null, error };
    return { mode: "scheduled", data: { ok: true }, error: null };
  }

  const { data, error } = await invokeNotificaMessaCassa(ids, {
    force: opts?.force,
    flushCoda: true,
  });
  return { mode: "sent", data, error };
}

export function handleNotificaMessaCassaOutcome(
  outcome: NotificaMessaCassaOutcome,
  onArchived?: () => void,
): void {
  if (outcome.mode === "scheduled") {
    if (outcome.error) {
      toast.warning("Pianificazione notifica serale non riuscita");
      return;
    }
    toast.success("Comunicazione messa a cassa pianificata per le 19:30");
    return;
  }

  const { data, error } = outcome;
  if (error || (data && data.ok === false && !data.skipped && !data.invii_ok)) {
    toast.warning("Notifica agenzia non inviata");
  } else if (data?.invii_ko) {
    toast.warning(`Notifiche: ${data.invii_ok} agenzie ok, ${data.invii_ko} con errore`);
  } else if ((data?.agenzie ?? 0) > 1) {
    toast.success(`Notifiche inviate a ${data.agenzie} agenzie (ognuna solo le proprie polizze)`);
  } else if (data?.archive_error) {
    toast.warning(`Email inviata ma archivio PDF fallito: ${data.archive_error}`);
  }
  if (data?.documenti_archiviati) onArchived?.();
}
