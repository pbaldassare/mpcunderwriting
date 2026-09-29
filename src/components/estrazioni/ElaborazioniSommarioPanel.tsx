import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { useAuth } from "@/contexts/AuthContext";
import { downloadPdfBytes } from "@/lib/portafoglioClienteAnalisi";
import { buildPdfSommarioCliente } from "@/lib/sommarioPolizze";
import {
  ELAB_TIPO_SOMMARIO,
  applyElaborazioneCampiToPolizze,
  buildCgaFromElaborazioneCampi,
  defaultSelectedTitoloIds,
  isPolizzaVigente,
  mergeCgaDettagli,
  preferDocumentoPerPolizza,
  toggleId,
} from "@/lib/elaborazioni/sommarioBatch";
import type { ValoriCampi } from "@/lib/elaborazioni/render";
import { useSommarioClientePortafoglio } from "@/hooks/useSommarioClientePortafoglio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/SearchableSelect";

type DocumentoRow = {
  id: string;
  nome_file: string;
  bucket_name: string;
  path_storage: string;
  categoria: string | null;
  entita_id: string;
  created_at: string;
};

type Props = {
  clienteId: string;
  clienteLabel: string;
  partitaIva?: string | null;
  codiceFiscale?: string | null;
};

async function analizzaDocumento(opts: {
  doc: DocumentoRow;
  clienteLabel: string;
  numeroPolizza?: string | null;
  prodotto?: string | null;
}): Promise<ValoriCampi> {
  const { data: file, error: dlErr } = await supabase.storage
    .from(opts.doc.bucket_name)
    .download(opts.doc.path_storage);
  if (dlErr || !file) {
    throw new Error(`Documento non scaricabile (${opts.doc.nome_file}): ${dlErr?.message ?? "assente"}`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!buf.length) throw new Error(`Documento vuoto: ${opts.doc.nome_file}`);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const contesto = [
    `Contraente atteso: ${opts.clienteLabel}`,
    opts.numeroPolizza ? `Numero polizza atteso: ${opts.numeroPolizza}` : null,
    opts.prodotto ? `Prodotto: ${opts.prodotto}` : null,
  ].filter(Boolean).join("\n");

  const { data, error } = await supabase.functions.invoke("elabora-documento-polizza", {
    body: {
      fileBase64: btoa(binary),
      mimeType: opts.doc.nome_file.toLowerCase().endsWith(".pdf") ? "application/pdf" : file.type || "application/pdf",
      contesto,
      campi: [
        { chiave: "numero_polizza", etichetta: "Numero polizza", tipo: "text" },
        { chiave: "compagnia", etichetta: "Compagnia", tipo: "text" },
        { chiave: "prodotto", etichetta: "Prodotto", tipo: "text" },
        { chiave: "data_scadenza", etichetta: "Data scadenza", tipo: "date" },
        { chiave: "frazionamento", etichetta: "Frazionamento", tipo: "text" },
        { chiave: "premio_lordo", etichetta: "Premio lordo", tipo: "number" },
        { chiave: "massimale", etichetta: "Massimale", tipo: "number" },
        { chiave: "franchigia", etichetta: "Franchigia", tipo: "number" },
        { chiave: "scoperto", etichetta: "Scoperto %", tipo: "number" },
        { chiave: "garanzie", etichetta: "Oggetto / garanzie", tipo: "text" },
        { chiave: "esclusioni", etichetta: "Esclusioni", tipo: "text" },
        { chiave: "note", etichetta: "Note", tipo: "text" },
      ],
    },
  });
  if (error) throw new Error(formatEdgeFunctionError(error, data as { error?: string } | null));
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return ((data as { campi?: ValoriCampi })?.campi ?? {}) as ValoriCampi;
}

export default function ElaborazioniSommarioPanel({
  clienteId,
  clienteLabel,
  partitaIva,
  codiceFiscale,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth() as { profile?: { id?: string; ufficio_id?: string | null } | null };
  const { template, polizze, garanzie, cgaDettagli, isLoading } = useSommarioClientePortafoglio(clienteId);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [docByTitolo, setDocByTitolo] = useState<Record<string, string>>({});
  const [estrattiByTitolo, setEstrattiByTitolo] = useState<Record<string, ValoriCampi>>({});
  const [busy, setBusy] = useState<"pdf" | "ai" | null>(null);
  const [aiProgress, setAiProgress] = useState("");

  useEffect(() => {
    setSelectedIds(defaultSelectedTitoloIds(polizze));
    setEstrattiByTitolo({});
    setDocByTitolo({});
  }, [clienteId, polizze]);

  const titoloIds = useMemo(() => polizze.map((p) => p.id), [polizze]);

  const { data: documenti = [] } = useQuery({
    queryKey: ["elab-sommario-documenti", titoloIds.join(",")],
    enabled: titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documenti")
        .select("id, nome_file, bucket_name, path_storage, categoria, entita_id, created_at")
        .eq("entita_tipo", "titolo")
        .in("entita_id", titoloIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoRow[];
    },
  });

  useEffect(() => {
    if (!documenti.length || !polizze.length) return;
    setDocByTitolo((prev) => {
      const next = { ...prev };
      for (const p of polizze) {
        if (next[p.id]) continue;
        const docs = documenti.filter((d) => d.entita_id === p.id);
        const pick = preferDocumentoPerPolizza(docs);
        if (pick) next[p.id] = pick.id;
      }
      return next;
    });
  }, [documenti, polizze]);

  const selectedPolizze = useMemo(
    () => polizze.filter((p) => selectedIds.includes(p.id)),
    [polizze, selectedIds],
  );

  const docsPerTitolo = useMemo(() => {
    const m = new Map<string, DocumentoRow[]>();
    for (const d of documenti) {
      (m.get(d.entita_id) || m.set(d.entita_id, []).get(d.entita_id)!).push(d);
    }
    return m;
  }, [documenti]);

  const genera = async () => {
    if (!selectedPolizze.length) {
      toast.error("Seleziona almeno una polizza");
      return;
    }
    try {
      setBusy("pdf");
      const enriched = applyElaborazioneCampiToPolizze(selectedPolizze, estrattiByTitolo);
      const extraCga = enriched.map((p) => buildCgaFromElaborazioneCampi(p, estrattiByTitolo[p.id]));
      const bytes = await buildPdfSommarioCliente({
        clienteLabel,
        polizze: enriched,
        garanzie: garanzie.filter((g) => selectedIds.includes(g.titolo_id)),
        cgaDettagli: mergeCgaDettagli(cgaDettagli, extraCga),
        layout: template?.layout_json,
        meta: { partitaIva, codiceFiscale },
      });
      const safe = clienteLabel.replace(/[^\w\-]+/g, "_").slice(0, 40);
      downloadPdfBytes(bytes, `sommario_polizze_${safe}_${format(new Date(), "yyyyMMdd")}.pdf`);

      const { error } = await supabase.from("elaborazioni").insert({
        cliente_id: clienteId,
        titolo_id: selectedPolizze[0]?.id ?? null,
        template_id: null,
        titolo: `Sommario polizze — ${clienteLabel} (${selectedPolizze.length})`,
        campi_estratti: estrattiByTitolo as never,
        contenuto: selectedPolizze.map((p) => p.numero_titolo).filter(Boolean).join(", "),
        stato: "generata",
        created_by: profile?.id ?? null,
        ufficio_id: profile?.ufficio_id ?? null,
        tipo: ELAB_TIPO_SOMMARIO,
        titolo_ids: selectedIds,
      } as never);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["elab-storico", clienteId] });
      toast.success(`Sommario generato su ${selectedPolizze.length} polizze (template cliente)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore generazione sommario");
    } finally {
      setBusy(null);
    }
  };

  const arricchisciIa = async () => {
    const jobs = selectedPolizze
      .map((p) => {
        const docs = docsPerTitolo.get(p.id) || [];
        const doc = docs.find((d) => d.id === docByTitolo[p.id]) || preferDocumentoPerPolizza(docs);
        return doc ? { p, doc } : null;
      })
      .filter(Boolean) as Array<{ p: (typeof selectedPolizze)[0]; doc: DocumentoRow }>;
    if (!jobs.length) {
      toast.error("Nessun documento sulle polizze selezionate. Puoi comunque generare il sommario dai dati CBnet.");
      return;
    }
    try {
      setBusy("ai");
      const next: Record<string, ValoriCampi> = { ...estrattiByTitolo };
      let ok = 0;
      for (let i = 0; i < jobs.length; i++) {
        const { p, doc } = jobs[i];
        setAiProgress(`${i + 1}/${jobs.length} · ${p.numero_titolo || "polizza"}`);
        try {
          next[p.id] = await analizzaDocumento({
            doc,
            clienteLabel,
            numeroPolizza: p.numero_titolo,
            prodotto: p.prodotto_nome,
          });
          ok += 1;
        } catch (e) {
          toast.error(`${p.numero_titolo || "Polizza"}: ${e instanceof Error ? e.message : "analisi fallita"}`);
        }
      }
      setEstrattiByTitolo(next);
      toast.success(`IA completata su ${ok}/${jobs.length} documenti`);
    } finally {
      setBusy(null);
      setAiProgress("");
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Sommario portafoglio</p>
          <p className="text-xs text-muted-foreground">
            Il template del cliente unisce tutte le polizze selezionate in un unico documento
            (tabella + scheda per ciascuna).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={template?.layout_key === "varese" ? "default" : "secondary"}>
            {template?.layout_key === "varese" ? "Layout Comune di Varese" : "Layout standard"}
          </Badge>
          {template?.nome_file ? (
            <span className="text-xs text-muted-foreground">{template.nome_file}</span>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => navigate(`/archivi/clienti/${clienteId}`)}
            >
              Allega Word in anagrafica
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSelectedIds(polizze.map((p) => p.id))}
        >
          Tutte ({polizze.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSelectedIds(defaultSelectedTitoloIds(polizze))}
        >
          Solo vigenti
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
          Nessuna
        </Button>
        <span className="text-xs text-muted-foreground self-center">
          {selectedIds.length} selezionate
        </span>
      </div>

      {polizze.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nessuna polizza sul cliente.</p>
      ) : (
        <ScrollArea className="h-72 rounded-md border">
          <div className="divide-y">
            {polizze.map((p) => {
              const docs = docsPerTitolo.get(p.id) || [];
              const checked = selectedIds.includes(p.id);
              return (
                <div key={p.id} className="px-3 py-2 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => setSelectedIds((prev) => toggleId(prev, p.id))}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm">{p.numero_titolo || "—"}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {p.stato || "—"}
                        </Badge>
                        {isPolizzaVigente(p.stato) ? null : (
                          <span className="text-[10px] text-muted-foreground">non vigente</span>
                        )}
                        {estrattiByTitolo[p.id] ? (
                          <Badge className="text-[10px] px-1 py-0">IA</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.prodotto_nome || p.ramo_nome, p.compagnia_nome].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </label>
                  {checked && docs.length > 0 && (
                    <div className="pl-6 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Documento per IA (opzionale)</Label>
                      <SearchableSelect
                        options={docs.map((d) => ({
                          value: d.id,
                          label: d.nome_file,
                          description: d.categoria || undefined,
                        }))}
                        value={docByTitolo[p.id] || ""}
                        onValueChange={(id) => setDocByTitolo((prev) => ({ ...prev, [p.id]: id }))}
                        placeholder="Nessun documento"
                        clearable
                        clearLabel="Nessuno"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={arricchisciIa}
          disabled={!selectedIds.length || !!busy}
        >
          {busy === "ai" ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {aiProgress || "Analisi…"}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Arricchisci con IA</>
          )}
        </Button>
        <Button onClick={genera} disabled={!selectedIds.length || !!busy}>
          {busy === "pdf" ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione…</>
          ) : (
            <><FileText className="w-4 h-4 mr-2" /> Genera sommario ({selectedIds.length})</>
          )}
        </Button>
      </div>
    </div>
  );
}
