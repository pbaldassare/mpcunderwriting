import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, Save, Image as ImageIcon, Palette, Loader2, Copy } from "lucide-react";
import { ResendDomainStatus } from "./ResendDomainStatus";
import { SedeTemplateSelect, type UfficioOption } from "./SedeTemplateSelect";
import { useAuth } from "@/contexts/AuthContext";
import { canEditGlobalBranding, lockedSedeUfficioId } from "@/lib/sistemaSede";

interface Branding {
  id?: string;
  ufficio_id?: string | null;
  logo_url: string | null;
  colore_primario: string;
  firma_html: string;
  intestazione_html: string;
  mittente_default: string;
}

const EMPTY_BRANDING: Branding = {
  logo_url: null,
  colore_primario: "#0e7490",
  firma_html: "",
  intestazione_html: "",
  mittente_default: "ConsulNet <onboarding@resend.dev>",
};

export function EmailBrandingTab() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const lockedUfficio = lockedSedeUfficioId({
    ruolo: profile?.ruolo,
    ufficioId: profile?.ufficio_id,
  });
  const sedeLocked = lockedUfficio !== undefined;
  const [sedeId, setSedeId] = useState<string | null>(sedeLocked ? lockedUfficio : null);
  const [form, setForm] = useState<Partial<Branding>>(EMPTY_BRANDING);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (sedeLocked) setSedeId(lockedUfficio);
  }, [sedeLocked, lockedUfficio]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-branding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, codice_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return (data || []) as UfficioOption[];
    },
  });

  const { data: brandingRows = [], isLoading } = useQuery({
    queryKey: ["email_branding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_branding" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as Branding[];
    },
  });

  const exactSede = useMemo(
    () => brandingRows.find((r) => (r.ufficio_id || null) === (sedeId || null)) || null,
    [brandingRows, sedeId],
  );
  const globale = useMemo(
    () => brandingRows.find((r) => r.ufficio_id == null) || null,
    [brandingRows],
  );

  useEffect(() => {
    if (exactSede) setForm(exactSede);
    else if (globale && sedeId) setForm({ ...globale, id: undefined, ufficio_id: sedeId });
    else if (globale) setForm(globale);
    else setForm({ ...EMPTY_BRANDING, ufficio_id: sedeId });
  }, [exactSede, globale, sedeId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (sedeLocked && !sedeId) {
        throw new Error("Associa un ufficio al tuo profilo per salvare il branding della sede.");
      }
      if (!canEditGlobalBranding(profile?.ruolo) && !sedeId) {
        throw new Error("Le sedi possono modificare solo il proprio branding.");
      }
      const payload = {
        logo_url: form.logo_url ?? null,
        colore_primario: form.colore_primario || "#0e7490",
        firma_html: form.firma_html || "",
        intestazione_html: form.intestazione_html || "",
        mittente_default: form.mittente_default || "ConsulNet <onboarding@resend.dev>",
        ufficio_id: sedeId,
        singleton: sedeId ? false : true,
      };
      if (exactSede?.id) {
        const { error } = await supabase
          .from("email_branding" as any)
          .update(payload as any)
          .eq("id", exactSede.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_branding" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_branding"] });
      toast.success(sedeId ? "Branding sede salvato" : "Branding globale salvato");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo troppo grande (max 2MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${sedeId ? `sede-${sedeId}-` : "globale-"}logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo caricato — clicca Salva per confermare");
    } catch (err: any) {
      toast.error(err.message || "Upload fallito");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Caricamento...</div>;

  const previewColor = form.colore_primario || "#0e7490";

  return (
    <div className="space-y-4">
      <ResendDomainStatus />
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5 w-[320px]">
          <Label>Sede branding</Label>
          <SedeTemplateSelect
            uffici={sedeLocked && lockedUfficio ? uffici.filter((u) => u.id === lockedUfficio) : uffici}
            value={sedeId}
            onChange={setSedeId}
            allowGlobale={!sedeLocked}
            locked={sedeLocked}
          />
        </div>
        {sedeId && globale && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm({ ...globale, id: undefined, ufficio_id: sedeId })}
          >
            <Copy className="h-4 w-4 mr-1" /> Copia da globale
          </Button>
        )}
        <p className="text-xs text-muted-foreground pb-1">
          {exactSede
            ? "Questa sede ha un branding proprio."
            : sedeId
              ? "Nessun branding sede: al salvataggio si crea una copia (precompilata dal globale)."
              : "Branding globale: usato se la sede del template non ha una configurazione."}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Configurazione Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4" /> Logo intestazione</Label>
            <div className="flex items-center gap-2">
              <Input
                value={form.logo_url || ""}
                onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://... o carica un file"
                className="flex-1"
              />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="h-12 mt-2 border rounded p-1 bg-muted/30" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Colore primario (header email)</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="color"
                value={previewColor}
                onChange={(e) => setForm((f) => ({ ...f, colore_primario: e.target.value }))}
                className="w-16 h-10 p-1"
              />
              <Input
                value={previewColor}
                onChange={(e) => setForm((f) => ({ ...f, colore_primario: e.target.value }))}
                placeholder="#0e7490"
                className="flex-1 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mittente di default</Label>
            <Input
              value={form.mittente_default || ""}
              onChange={(e) => setForm((f) => ({ ...f, mittente_default: e.target.value }))}
              placeholder="ConsulNet <onboarding@resend.dev>"
            />
            <p className="text-xs text-muted-foreground">
              In test usa <code>onboarding@resend.dev</code>. Per usare un dominio custom occorre verificarlo su Resend.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Intestazione HTML (opzionale)</Label>
            <Textarea
              value={form.intestazione_html || ""}
              onChange={(e) => setForm((f) => ({ ...f, intestazione_html: e.target.value }))}
              placeholder="<p>Es. avviso legale, riferimento RUI…</p>"
              className="min-h-[60px] font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Firma HTML (footer)</Label>
            <Textarea
              value={form.firma_html || ""}
              onChange={(e) => setForm((f) => ({ ...f, firma_html: e.target.value }))}
              placeholder="<p>Cordiali saluti,<br/><strong>Sede di...</strong></p>"
              className="min-h-[100px] font-mono text-xs"
            />
          </div>

          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salva configurazione
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anteprima email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#f4f6f8] p-4 rounded-md">
            <div className="bg-white rounded-md overflow-hidden shadow-sm max-w-[560px] mx-auto border">
              <div style={{ background: previewColor }} className="px-5 py-4 text-white">
                {form.logo_url
                  ? <img src={form.logo_url} alt="Logo" className="h-10" />
                  : <div className="font-semibold text-lg">ConsulNet</div>}
              </div>
              {form.intestazione_html && (
                <div
                  className="px-5 pt-4 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: form.intestazione_html }}
                />
              )}
              <div className="px-5 py-5 text-sm leading-relaxed text-foreground">
                <p className="mb-3">Gentile Mario Rossi,</p>
                <p className="mb-3">questo è un esempio di come apparirà il corpo della Sua email con il branding configurato.</p>
                <p>Cordiali saluti.</p>
              </div>
              <div
                className="px-5 py-3 border-t text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: form.firma_html || "" }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Anteprima — il rendering reale può variare in base al client di posta
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
