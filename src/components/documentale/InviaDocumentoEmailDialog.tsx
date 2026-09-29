import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  applyTemplateVars,
  defaultCorpoInvioDocumento,
  defaultOggettoInvioDocumento,
  fetchContestoInvioDocumento,
  inviaDocumentoPerEmail,
  type DestinatarioTipoInvioDoc,
  type StoricoInvioDocumento,
} from "@/lib/documentiInvioEmail";
import { htmlToPlainText } from "@/lib/sendEmail";
import { format } from "date-fns";

type DocumentoInvio = {
  id: string;
  nome_file: string;
  path_storage: string;
  bucket_name: string;
  entita_tipo: string;
  entita_id: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoInvio | null;
  storicoInvii?: StoricoInvioDocumento | null;
  onSent?: () => void;
};

export function InviaDocumentoEmailDialog({ open, onOpenChange, documento, storicoInvii = null, onSent }: Props) {
  const [destTipo, setDestTipo] = useState<DestinatarioTipoInvioDoc>("cliente");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [templateId, setTemplateId] = useState<string>("__default__");
  const [sending, setSending] = useState(false);

  const { data: contesto, isLoading: loadingCtx } = useQuery({
    queryKey: ["invio-doc-contesto", documento?.entita_tipo, documento?.entita_id],
    enabled: open && !!documento,
    queryFn: () =>
      fetchContestoInvioDocumento({
        entitaTipo: documento!.entita_tipo,
        entitaId: documento!.entita_id,
      }),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["template_email_invio_documento"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_email")
        .select("id, nome, oggetto, corpo, attivo")
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const destOptions = contesto?.destinatari ?? [];
  const selectedDest = useMemo(
    () => destOptions.find((d) => d.tipo === destTipo) || destOptions[0] || null,
    [destOptions, destTipo],
  );

  const vars = useMemo(
    () => ({
      cliente: contesto?.clienteNome || "",
      compagnia: contesto?.compagniaNome || "",
      polizza: contesto?.numeroPolizza || "",
      documento: documento?.nome_file || "",
    }),
    [contesto, documento?.nome_file],
  );

  useEffect(() => {
    if (!open || !documento || !contesto) return;
    const tipo: DestinatarioTipoInvioDoc =
      destOptions.some((d) => d.tipo === "cliente") ? "cliente" : (destOptions[0]?.tipo ?? "cliente");
    setDestTipo(tipo);
    const dest = destOptions.find((d) => d.tipo === tipo) || destOptions[0];
    setTo(dest?.email || "");
    setTemplateId("__default__");
    setSubject(defaultOggettoInvioDocumento(documento.nome_file, contesto.numeroPolizza));
    setHtml(
      defaultCorpoInvioDocumento({
        nomeFile: documento.nome_file,
        clienteNome: contesto.clienteNome,
        compagniaNome: contesto.compagniaNome,
        numeroPolizza: contesto.numeroPolizza,
        destinatarioTipo: tipo,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documento?.id, contesto]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!documento || !contesto) return;
    if (id === "__default__") {
      setSubject(defaultOggettoInvioDocumento(documento.nome_file, contesto.numeroPolizza));
      setHtml(
        defaultCorpoInvioDocumento({
          nomeFile: documento.nome_file,
          clienteNome: contesto.clienteNome,
          compagniaNome: contesto.compagniaNome,
          numeroPolizza: contesto.numeroPolizza,
          destinatarioTipo: destTipo,
        }),
      );
      return;
    }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(applyTemplateVars(t.oggetto || "", vars));
    setHtml(
      htmlToPlainText(
        applyTemplateVars(t.corpo || "", vars),
      ),
    );
  };

  const onChangeDestTipo = (tipo: DestinatarioTipoInvioDoc) => {
    setDestTipo(tipo);
    const dest = destOptions.find((d) => d.tipo === tipo);
    if (dest) setTo(dest.email || "");
    if (templateId === "__default__" && documento && contesto) {
      setHtml(
        defaultCorpoInvioDocumento({
          nomeFile: documento.nome_file,
          clienteNome: contesto.clienteNome,
          compagniaNome: contesto.compagniaNome,
          numeroPolizza: contesto.numeroPolizza,
          destinatarioTipo: tipo,
        }),
      );
    }
  };

  const giaInviatoAlDestinatario =
    destTipo === "cliente" ? !!storicoInvii?.cliente : !!storicoInvii?.compagnia;
  const countGiaInviati =
    destTipo === "cliente" ? (storicoInvii?.countCliente ?? 0) : (storicoInvii?.countCompagnia ?? 0);
  const ultimoInvio =
    destTipo === "cliente" ? storicoInvii?.cliente : storicoInvii?.compagnia;

  const handleSend = async () => {
    if (!documento) return;
    if (giaInviatoAlDestinatario) {
      const quando = ultimoInvio?.inviato_il
        ? format(new Date(ultimoInvio.inviato_il), "dd/MM/yyyy HH:mm")
        : "";
      const ok = window.confirm(
        `Questo documento è già stato inviato ${destTipo === "cliente" ? "al cliente" : "alla compagnia"}` +
          (quando ? ` (${quando})` : "") +
          (countGiaInviati > 1 ? ` — ${countGiaInviati} invii` : "") +
          ".\n\nVuoi inviarlo di nuovo?",
      );
      if (!ok) return;
    }
    setSending(true);
    try {
      const res = await inviaDocumentoPerEmail({
        documento,
        to,
        subject,
        html,
        destinatarioTipo: destTipo,
        templateId: templateId === "__default__" ? null : templateId,
      });
      if (!res.ok) {
        toast.error(res.error || "Invio fallito");
        return;
      }
      if (res.archiveError) {
        toast.warning(`Email inviata, ma archivio documento fallito: ${res.archiveError}`);
      } else {
        toast.success(
          giaInviatoAlDestinatario
            ? "Email reinviata e documento archiviato"
            : "Email inviata e documento archiviato",
        );
      }
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Errore invio");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Invia documento
          </DialogTitle>
        </DialogHeader>

        {loadingCtx || !documento ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex items-start gap-2">
              <Paperclip className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium truncate">{documento.nome_file}</div>
                {contesto?.numeroPolizza && (
                  <div className="text-xs text-muted-foreground">Polizza {contesto.numeroPolizza}</div>
                )}
              </div>
            </div>

            {(storicoInvii?.cliente || storicoInvii?.compagnia) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                <div className="font-semibold">Già inviato in precedenza (puoi comunque reinviarlo)</div>
                {storicoInvii.cliente && (
                  <div>
                    Cliente: {storicoInvii.cliente.destinatario || "—"}
                    {storicoInvii.cliente.inviato_il
                      ? ` · ${format(new Date(storicoInvii.cliente.inviato_il), "dd/MM/yyyy HH:mm")}`
                      : ""}
                    {storicoInvii.countCliente > 1 ? ` · ${storicoInvii.countCliente} volte` : ""}
                  </div>
                )}
                {storicoInvii.compagnia && (
                  <div>
                    Compagnia: {storicoInvii.compagnia.destinatario || "—"}
                    {storicoInvii.compagnia.inviato_il
                      ? ` · ${format(new Date(storicoInvii.compagnia.inviato_il), "dd/MM/yyyy HH:mm")}`
                      : ""}
                    {storicoInvii.countCompagnia > 1 ? ` · ${storicoInvii.countCompagnia} volte` : ""}
                  </div>
                )}
              </div>
            )}

            {destOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Destinatario</Label>
                <Select value={destTipo} onValueChange={(v) => onChangeDestTipo(v as DestinatarioTipoInvioDoc)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {destOptions.map((d) => (
                      <SelectItem key={d.tipo} value={d.tipo}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDest && !selectedDest.email && (
                  <p className="text-[11px] text-amber-700">
                    Email mancante in anagrafica: inseriscila manualmente sotto.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invio-doc-to">Email</Label>
              <Input
                id="invio-doc-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="destinatario@esempio.it"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Predefinito invio documento</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Variabili template: {"{{cliente}}"}, {"{{compagnia}}"}, {"{{polizza}}"}, {"{{documento}}"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invio-doc-oggetto">Oggetto</Label>
              <Input
                id="invio-doc-oggetto"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invio-doc-corpo">Messaggio</Label>
              <Textarea
                id="invio-doc-corpo"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                className="text-sm whitespace-pre-wrap"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending || !documento || !to.includes("@")}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Invio…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-1" /> {giaInviatoAlDestinatario ? "Reinvia" : "Invia"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
