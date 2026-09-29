import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendEmail, plainTextToEmailHtml } from "@/lib/sendEmail";
import {
  defaultCorpoRichiestaQuietanza,
  defaultOggettoRichiestaQuietanza,
  resolveAgenziaEmail,
  type RichiestaQuietanzaRiga,
} from "@/lib/richiestaQuietanza";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  righe: RichiestaQuietanzaRiga[];
  onSent?: () => void;
};

export function RichiestaQuietanzaEmailDialog({ open, onOpenChange, righe, onSent }: Props) {
  const { user } = useAuth();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [agenziaNome, setAgenziaNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const compagniaId = righe[0]?.compagnia_id || "";

  useEffect(() => {
    if (!open || !righe.length || !compagniaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { email, nome } = await resolveAgenziaEmail(compagniaId);
        if (cancelled) return;
        const displayNome = nome || righe[0]?.compagnia_nome || "Agenzia";
        setAgenziaNome(displayNome);
        setTo(email);
        setSubject(defaultOggettoRichiestaQuietanza(displayNome));
        setBody(defaultCorpoRichiestaQuietanza(displayNome, righe));
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Errore caricamento destinatario");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, compagniaId, righe]);

  const handleSend = async () => {
    const dest = to.trim();
    if (!dest) {
      toast.error("Inserisci un indirizzo email destinatario");
      return;
    }
    if (!subject.trim()) {
      toast.error("Oggetto obbligatorio");
      return;
    }
    if (!body.trim()) {
      toast.error("Messaggio obbligatorio");
      return;
    }
    try {
      setSending(true);
      const plain = body.trim();
      const result = await sendEmail({
        to: dest,
        subject: subject.trim(),
        html: plainTextToEmailHtml(plain),
        apply_branding: true,
      });

      const ok = result.success;
      const { data: header, error: headerErr } = await supabase
        .from("richieste_quietanza" as any)
        .insert({
          compagnia_id: compagniaId || null,
          compagnia_nome: agenziaNome || righe[0]?.compagnia_nome || null,
          destinatario_email: dest,
          oggetto: subject.trim(),
          corpo_html: plain,
          num_titoli: righe.length,
          stato: ok ? "inviato" : "errore",
          errore: ok ? null : result.error || "Invio fallito",
          resend_id: result.id || null,
          inviato_da: user?.id || null,
        })
        .select("id")
        .single();

      if (headerErr) throw headerErr;

      const richiestaId = (header as unknown as { id: string })?.id;
      if (richiestaId) {
        const { error: righeErr } = await supabase.from("richieste_quietanza_righe" as any).insert(
          righe.map((r) => ({
            richiesta_id: richiestaId,
            titolo_id: r.id,
            numero_polizza: r.numero_titolo,
            ramo: r.ramo_nome,
            cliente_nome: r.cliente_nome_display,
            premio_lordo: r.premio_lordo,
            data_scadenza: r.garanzia_a || r.data_scadenza,
            tacito_rinnovo: r.tacito_rinnovo,
          })),
        );
        if (righeErr) console.error("Errore salvataggio righe richiesta quietanza:", righeErr);
      }

      if (!ok) throw new Error(result.error || "Invio fallito");

      toast.success(`Richiesta inviata a ${dest} (${righe.length} polizze)`);
      onOpenChange(false);
      onSent?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore invio email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Anteprima richiesta quietanza
          </DialogTitle>
          <DialogDescription>
            {righe.length} polizz{righe.length === 1 ? "a" : "e"} selezionat{righe.length === 1 ? "a" : "e"} per{" "}
            {agenziaNome || "agenzia"}. Puoi modificare destinatario, oggetto e testo prima dell&apos;invio.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento anteprima…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rq-to">Destinatario (agenzia)</Label>
              <Input
                id="rq-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email@agenzia.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-subject">Oggetto</Label>
              <Input id="rq-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-body">Messaggio</Label>
              <Textarea
                id="rq-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[280px] text-sm whitespace-pre-wrap"
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Anteprima elenco</p>
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {righe.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="font-mono">{r.numero_titolo || "—"}</span>
                    <span className="text-muted-foreground truncate">{r.cliente_nome_display}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || loading || !righe.length}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Invia richiesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
