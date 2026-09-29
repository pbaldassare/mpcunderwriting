import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, ExternalLink } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import {
  type SinistroReminderRow,
  REMINDER_CATEGORIA_LABEL,
} from "@/lib/sinistroPrescrizioniReminder";

const todayISO = () => format(new Date(), "yyyy-MM-dd");

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const parsed = parseISO(d);
  return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : "—";
};

export default function SinistroReminderPopupGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<SinistroReminderRow[]>([]);
  const [current, setCurrent] = useState<SinistroReminderRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data: dueReminders = [] } = useQuery({
    queryKey: ["sinistro-reminder-popup", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const oggi = todayISO();
      const { data, error } = await supabase
        .from("sinistro_reminder" as any)
        .select(`
          *,
          sinistri(
            id, numero_sinistro,
            clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
            titoli(numero_titolo)
          )
        `)
        .eq("assegnato_a", user!.id)
        .eq("stato", "attivo")
        .lte("data_scadenza", oggi)
        .is("popup_mostrato_at", null)
        .order("data_scadenza", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SinistroReminderRow[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (dueReminders.length > 0 && queue.length === 0 && !current) {
      setQueue(dueReminders);
      setCurrent(dueReminders[0]);
      setOpen(true);
    }
  }, [dueReminders, queue.length, current]);

  const dismissCurrent = async (markRead: boolean) => {
    if (!current) return;
    await supabase
      .from("sinistro_reminder" as any)
      .update({
        popup_mostrato_at: new Date().toISOString(),
        ...(markRead ? { letto: true } : {}),
      })
      .eq("id", current.id);

    qc.invalidateQueries({ queryKey: ["sinistro-reminder-popup"] });
    qc.invalidateQueries({ queryKey: ["sinistri-reminder-list"] });

    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length > 0) {
      setCurrent(rest[0]);
    } else {
      setCurrent(null);
      setOpen(false);
    }
  };

  if (!current) return null;

  const sinistro = current.sinistri;
  const clienteNome = resolveClienteNome(sinistro?.clienti);
  const polizza = sinistro?.titoli?.numero_titolo || "—";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismissCurrent(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Reminder sinistro in scadenza
            {queue.length > 1 && (
              <Badge variant="secondary" className="ml-1 text-xs">{queue.length} totali</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{REMINDER_CATEGORIA_LABEL[current.categoria] || current.categoria}</Badge>
            <Badge variant="secondary">Scadenza {fmtDate(current.data_scadenza || current.data_promemoria)}</Badge>
          </div>
          <p className="font-medium">{current.testo}</p>
          <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
            <p><span className="text-muted-foreground">Sinistro:</span> <strong>{sinistro?.numero_sinistro || "—"}</strong></p>
            <p><span className="text-muted-foreground">Cliente:</span> {clienteNome}</p>
            <p><span className="text-muted-foreground">Polizza:</span> {polizza}</p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => dismissCurrent(true)}>
            Segna come letto
          </Button>
          <Button
            variant="default"
            className="gap-1.5"
            onClick={() => {
              const sid = sinistro?.id || current.sinistro_id;
              dismissCurrent(true);
              navigate(`/sinistri/${sid}`);
            }}
          >
            <ExternalLink className="h-4 w-4" /> Apri sinistro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
