import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Shield, Building2, Calendar, CreditCard, FileText, Upload, User, Eye, Trash2, AlertTriangle, ChevronRight, Info, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import UploadDocPolizzaDialog from "@/components/cliente/UploadDocPolizzaDialog";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fmtEuro as fmt } from "@/lib/formatCurrency";

const statoBadge: Record<string, string> = {
  attivo: "bg-emerald-100 text-emerald-800",
  scaduto: "bg-red-100 text-red-800",
  sospeso: "bg-yellow-100 text-yellow-800",
  incassato: "bg-blue-100 text-blue-800",
};

const statoQuietanza: Record<string, string> = {
  da_incassare: "bg-amber-100 text-amber-800 border-amber-300",
  incassato: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sospesa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  annullata: "bg-red-100 text-red-800 border-red-300",
  stornata: "bg-orange-100 text-orange-800 border-orange-300",
};

const fmtDate = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: it }) : "—";
const boolLabel = (v: any) => v === true ? "Sì" : v === false ? "No" : "—";

const ClientePolizzaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [titolo, setTitolo] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [sinistri, setSinistri] = useState<any[]>([]);
  const [quietanze, setQuietanze] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const refreshDocs = async () => {
    if (!id) return;
    const { data } = await supabase.from("documenti").select("*").eq("entita_tipo", "titolo").eq("entita_id", id).order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("titoli").select("*, compagnie(nome, codice), rami(codice, descrizione)").eq("id", id).maybeSingle(),
      supabase.from("documenti").select("*").eq("entita_tipo", "titolo").eq("entita_id", id).order("created_at", { ascending: false }),
      supabase.from("sinistri").select("id, numero_sinistro, stato, data_evento, ramo_sinistro").eq("titolo_id", id).neq("stato", "archiviato").order("data_apertura", { ascending: false }),
      supabase.from("quietanze").select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_incasso").eq("titolo_id", id).order("numero_rata", { ascending: true }),
    ]).then(([tRes, dRes, sRes, qRes]) => {
      setTitolo(tRes.data);
      setDocs(dRes.data ?? []);
      setSinistri(sRes.data ?? []);
      setQuietanze(qRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (location.hash === "#scadenziario") {
      const el = document.getElementById("scadenziario");
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [loading, location.hash]);

  const prossimaRata = useMemo(() => {
    const today = new Date();
    return quietanze
      .filter((q: any) => q.stato !== "incassato" && q.stato !== "annullata" && q.stato !== "stornata")
      .map((q: any) => ({ ...q, _date: q.garanzia_a ?? q.data_scadenza }))
      .filter((q: any) => q._date && new Date(q._date) >= new Date(today.toDateString()))
      .sort((a: any, b: any) => new Date(a._date).getTime() - new Date(b._date).getTime())[0];
  }, [quietanze]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!titolo) return <p className="text-muted-foreground">Polizza non trovata.</p>;

  const compagniaNome = titolo.compagnie?.nome ?? "—";
  const ramoLabel = titolo.rami ? `${titolo.rami.codice ?? ""} ${titolo.rami.descrizione ?? ""}`.trim() : "—";

  const anagrafica: { label: string; value: any }[] = [
    { label: "Numero polizza", value: titolo.numero_titolo },
    { label: "Compagnia / Agenzia", value: compagniaNome },
    { label: "Ramo / Garanzia", value: ramoLabel },
    { label: "Prodotto", value: titolo.prodotto_nome },
    { label: "CIG", value: titolo.cig_rif },
    { label: "Targa / Telaio", value: titolo.targa_telaio },
    { label: "Stato", value: titolo.stato },
    { label: "Tipo portafoglio", value: titolo.tipo_portafoglio },
    { label: "Vincolo", value: titolo.vincolo },
    { label: "Produttore", value: titolo.produttore_nome },
  ];

  const durata: { label: string; value: any }[] = [
    { label: "Decorrenza", value: fmtDate(titolo.durata_da) },
    { label: "Scadenza", value: fmtDate(titolo.durata_a ?? titolo.data_scadenza) },
    { label: "Anni durata", value: titolo.anni_durata },
    { label: "Frazionamento", value: titolo.frazionamento ?? titolo.periodicita },
    { label: "Tacito rinnovo", value: boolLabel(titolo.tacito_rinnovo) },
    { label: "Disdetta (giorni)", value: titolo.disdetta_giorni },
    { label: "Regolazione", value: boolLabel(titolo.regolazione) },
    { label: "Indicizzata", value: boolLabel(titolo.indicizzata) },
  ];

  const premio: { label: string; value: any }[] = [
    { label: "Premio netto", value: titolo.premio_netto != null ? fmt(titolo.premio_netto) : "—" },
    { label: "Tasse", value: titolo.tasse != null ? fmt(titolo.tasse) : "—" },
    { label: "Addizionali", value: titolo.addizionali != null ? fmt(titolo.addizionali) : "—" },
    { label: "SSN", value: titolo.ssn != null ? fmt(titolo.ssn) : "—" },
    { label: "Premio lordo", value: titolo.premio_lordo != null ? fmt(titolo.premio_lordo) : "—" },
    { label: "Provv. firma", value: titolo.provvigioni_firma != null ? fmt(titolo.provvigioni_firma) : "—" },
    { label: "Provv. quietanza", value: titolo.provvigioni_quietanza != null ? fmt(titolo.provvigioni_quietanza) : "—" },
  ];

  const statoContratto: { label: string; value: any }[] = [
    { label: "Data sospensione", value: fmtDate(titolo.data_sospensione) },
    { label: "Data riattivazione", value: fmtDate(titolo.data_riattivazione) },
    { label: "Data annullamento", value: fmtDate(titolo.data_annullamento) },
    { label: "Motivo annullamento", value: titolo.motivo_annullamento },
  ].filter(r => r.value && r.value !== "—");

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/cliente/polizze")}>
        <ArrowLeft className="h-4 w-4" />Torna alle polizze
      </Button>

      {/* Header */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Polizza</p>
              <h2 className="text-2xl font-bold text-foreground">{titolo.numero_titolo}</h2>
              <p className="text-sm text-teal-700 font-medium mt-1">{compagniaNome} · {ramoLabel}</p>
            </div>
            <Badge className={`text-sm px-4 py-1.5 ${statoBadge[titolo.stato] ?? "bg-muted"}`}>{titolo.stato?.toUpperCase()}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Anagrafica + Durata */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4 text-teal-600" />Anagrafica polizza</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {anagrafica.map(r => (
              <div key={r.label} className="flex justify-between gap-4 py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-right">{r.value || "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-teal-600" />Durata & rinnovo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {durata.map(r => (
              <div key={r.label} className="flex justify-between gap-4 py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-right">{r.value ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Premio */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-teal-600" />Premio annuo (riferimento)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {premio.map(r => (
              <div key={r.label} className="rounded border p-2.5 bg-muted/20">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="font-semibold text-foreground">{r.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stato contratto (solo se ha valori) */}
      {statoContratto.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-teal-600" />Stato contratto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {statoContratto.map(r => (
              <div key={r.label} className="flex justify-between gap-4 py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-right">{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scadenziario (Rate / Quietanze) */}
      <Card id="scadenziario" className="scroll-mt-24">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-teal-600" />Scadenziario (Rate / Quietanze)</CardTitle>
            {prossimaRata && (
              <div className="text-xs text-muted-foreground">
                Prossima rata: <span className="font-medium text-foreground">{fmtDate(prossimaRata._date)}</span>
                {prossimaRata.premio_lordo != null && <> — <span className="font-medium text-foreground">{fmt(prossimaRata.premio_lordo)}</span></>}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {quietanze.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nessuna quietanza registrata.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rata</TableHead>
                  <TableHead>Decorrenza</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Giorni</TableHead>
                  <TableHead className="text-right">Premio lordo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Incasso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quietanze.map((q: any) => {
                  const scad = q.garanzia_a ?? q.data_scadenza;
                  const gg = scad ? differenceInDays(new Date(scad), new Date()) : null;
                  const incassata = q.stato === "incassato";
                  const ggBadge = gg == null || incassata ? "bg-muted text-muted-foreground" :
                    gg < 0 ? "bg-red-200 text-red-900" :
                    gg <= 30 ? "bg-red-100 text-red-800" :
                    gg <= 60 ? "bg-orange-100 text-orange-800" :
                    gg <= 90 ? "bg-yellow-100 text-yellow-800" :
                    "bg-muted text-muted-foreground";
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.numero_rata}{q.numero_rate_totali ? ` / ${q.numero_rate_totali}` : ""}</TableCell>
                      <TableCell>{fmtDate(q.garanzia_da)}</TableCell>
                      <TableCell>{fmtDate(scad)}</TableCell>
                      <TableCell>
                        {gg == null ? "—" : incassata ? <span className="text-xs text-muted-foreground">—</span> : (
                          <Badge variant="outline" className={`${ggBadge} border-transparent`}>{gg < 0 ? `${Math.abs(gg)} gg fa` : `${gg} gg`}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{q.premio_lordo != null ? fmt(q.premio_lordo) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statoQuietanza[q.stato] ?? ""}>{q.stato}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(q.data_incasso)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      {/* Copertura */}
      {titolo.descrizione_polizza && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-teal-600" />Descrizione Copertura</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{titolo.descrizione_polizza}</p>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      {titolo.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-teal-600" />Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{titolo.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Documenti */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documenti allegati</CardTitle>
          {titolo.cliente_anagrafica_id && (
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Carica documento
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento disponibile.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.nome_file}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {d.categoria && <Badge variant="secondary" className="text-[10px]">{d.categoria}</Badge>}
                      {d.caricato_da_cliente && (
                        <Badge className="bg-teal-100 text-teal-800 text-[10px] gap-1"><User className="h-3 w-3" />Caricato da te</Badge>
                      )}
                      {d.created_at && (
                        <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(d)} title="Anteprima"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(d)} title="Scarica"><Download className="h-4 w-4" /></Button>
                    {d.caricato_da_cliente && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDoc(d)} title="Elimina" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sinistri collegati */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" /> Sinistri collegati
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sinistri.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun sinistro collegato a questa polizza.</p>
          ) : (
            <div className="space-y-2">
              {sinistri.map((s) => (
                <Link
                  key={s.id}
                  to={`/cliente/sinistri/${s.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">{s.ramo_sinistro || "—"}</Badge>
                    <span className="font-medium truncate">{s.numero_sinistro || "—"}</span>
                    <span className="text-xs text-muted-foreground">{s.stato?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {s.data_evento && <span>{format(new Date(s.data_evento), "dd/MM/yyyy")}</span>}
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DocPreviewDialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)} doc={previewDoc} />

      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{deleteDoc?.nome_file}</strong>. L'operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteDoc) return;
                try {
                  await supabase.storage.from(deleteDoc.bucket_name).remove([deleteDoc.path_storage]);
                  const { error } = await supabase.from("documenti").delete().eq("id", deleteDoc.id);
                  if (error) throw error;
                  toast.success("Documento eliminato");
                  setDeleteDoc(null);
                  refreshDocs();
                } catch (e: any) {
                  toast.error(e.message ?? "Errore eliminazione");
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {titolo.cliente_anagrafica_id && (
        <UploadDocPolizzaDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          titoloId={titolo.id}
          clienteAnagraficaId={titolo.cliente_anagrafica_id}
          onUploaded={refreshDocs}
        />
      )}
    </div>
  );
};

export default ClientePolizzaDetail;
