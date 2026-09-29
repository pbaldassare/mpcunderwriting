import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { Shield, Calendar, X, FileSpreadsheet, FileText, ChevronRight, ChevronDown, ExternalLink, Download, Receipt, Paperclip } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fmtEuro as fmt } from "@/lib/formatCurrency";
import { DatePicker } from "@/components/contabilita/DatePicker";

const statoQuietanzaBadge: Record<string, string> = {
  da_incassare: "bg-amber-100 text-amber-800 border-amber-300",
  incassato: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sospesa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  annullata: "bg-red-100 text-red-800 border-red-300",
  stornata: "bg-orange-100 text-orange-800 border-orange-300",
};



const ClientePolizze = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [titoli, setTitoli] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filtri
  const [ramo, setRamo] = useState<string>("");
  const [compagnia, setCompagnia] = useState<string>("");
  const [search, setSearch] = useState("");
  const [scadDa, setScadDa] = useState<Date | null>(null);
  const [scadA, setScadA] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, { loading: boolean; quietanze: any[]; documenti: any[] }>>({});


  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const ids = clienteIds.map((c: any) => c);

      const [titoliRes, cgaRes] = await Promise.all([
        supabase
          .from("titoli")
          .select("id, numero_titolo, stato, premio_lordo, premio_netto, cig_rif, data_scadenza, durata_da, periodicita, descrizione_polizza, produttore_nome, targa_telaio, prodotto_nome, compagnie(nome), rami(descrizione)")
          .in("cliente_anagrafica_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("polizza_cga")
          .select("id, numero_polizza, stato, data_decorrenza, data_scadenza, premio_lordo_totale, premio_imponibile_totale, frazionamento, prodotti_cga(nome_prodotto, compagnia, ramo)")
          .in("cliente_id", ids)
          .eq("stato", "approvato")
          .order("created_at", { ascending: false }),
      ]);

      const fromTitoli = (titoliRes.data ?? []).map((t: any) => ({
        ...t,
        _source: "titoli" as const,
        _detailPath: `/cliente/polizze/${t.id}`,
      }));

      const fromCga = (cgaRes.data ?? []).map((p: any) => ({
        id: p.id,
        _source: "cga" as const,
        _detailPath: `/cliente/assistente?polizza=${p.id}`,
        numero_titolo: p.numero_polizza ?? "—",
        stato: "attivo",
        premio_lordo: p.premio_lordo_totale,
        premio_netto: p.premio_imponibile_totale,
        cig_rif: null,
        data_scadenza: p.data_scadenza,
        durata_da: p.data_decorrenza,
        periodicita: p.frazionamento,
        descrizione_polizza: p.prodotti_cga?.ramo ?? null,
        produttore_nome: null,
        targa_telaio: null,
        prodotto_nome: p.prodotti_cga?.nome_prodotto ?? p.prodotti_cga?.ramo ?? null,
        compagnie: p.prodotti_cga?.compagnia ? { nome: p.prodotti_cga.compagnia } : null,
        rami: p.prodotti_cga?.ramo ? { descrizione: p.prodotti_cga.ramo } : null,
      }));

      setTitoli([...fromCga, ...fromTitoli]);
      setLoading(false);
    };
    load();
  }, [user]);

  const ramiOptions = useMemo(() => {
    const set = new Map<string, string>();
    titoli.forEach(t => { const r = t.rami?.descrizione; if (r) set.set(r, r); });
    return [{ value: "", label: "Tutti i rami" }, ...Array.from(set.values()).sort().map(r => ({ value: r, label: r }))];
  }, [titoli]);

  const compagnieOptions = useMemo(() => {
    const set = new Map<string, string>();
    titoli.forEach(t => { const c = t.compagnie?.nome; if (c) set.set(c, c); });
    return [{ value: "", label: "Tutte le compagnie" }, ...Array.from(set.values()).sort().map(c => ({ value: c, label: c }))];
  }, [titoli]);

  const filtered = useMemo(() => {
    return titoli.filter(t => {
      if (ramo && t.rami?.descrizione !== ramo) return false;
      if (compagnia && t.compagnie?.nome !== compagnia) return false;
      if (scadDa && (!t.data_scadenza || new Date(t.data_scadenza) < scadDa)) return false;
      if (scadA && (!t.data_scadenza || new Date(t.data_scadenza) > scadA)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.numero_titolo ?? ""} ${t.targa_telaio ?? ""} ${t.prodotto_nome ?? ""} ${t.descrizione_polizza ?? ""} ${t.cig_rif ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [titoli, ramo, compagnia, scadDa, scadA, search]);

  const resetFiltri = () => {
    setRamo(""); setCompagnia(""); setSearch(""); setScadDa(null); setScadA(null);
  };

  const filtriAttivi = ramo || compagnia || search || scadDa || scadA;

  const toggleExpand = async (t: any) => {
    const willOpen = expandedId !== t.id;
    setExpandedId(willOpen ? t.id : null);
    if (!willOpen) return;
    if (t._source !== "titoli") return;
    if (expandedData[t.id]) return;
    setExpandedData(prev => ({ ...prev, [t.id]: { loading: true, quietanze: [], documenti: [] } }));
    const [qRes, dRes] = await Promise.all([
      supabase
        .from("quietanze")
        .select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_incasso")
        .eq("titolo_id", t.id)
        .order("numero_rata", { ascending: true }),
      supabase
        .from("documenti")
        .select("id, nome_file, bucket_name, path_storage, created_at, categoria")
        .eq("entita_tipo", "titolo")
        .eq("entita_id", t.id)
        .order("created_at", { ascending: false }),
    ]);
    setExpandedData(prev => ({
      ...prev,
      [t.id]: { loading: false, quietanze: qRes.data ?? [], documenti: dRes.data ?? [] },
    }));
  };

  const downloadDoc = async (d: any) => {
    const { data } = await supabase.storage.from(d.bucket_name).createSignedUrl(d.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const buildExportRows = () =>
    filtered.map(t => ({
      Compagnia: t.compagnie?.nome ?? "",
      Produttore: t.produttore_nome ?? "",
      Prodotto: t.rami?.descrizione ?? t.prodotto_nome ?? t.descrizione_polizza ?? "",

      "N° Polizza": t.numero_titolo ?? "",
      Targa: t.targa_telaio ?? "",
      CIG: t.cig_rif ?? "",
      "Data Scadenza": t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy") : "",
      Periodicita: t.periodicita ?? "",
      "Premio Imponibile": t.premio_netto ?? 0,
      "Premio Lordo": t.premio_lordo ?? 0,
    }));

  const fileBase = `polizze_${format(new Date(), "yyyyMMdd")}`;

  const exportCSV = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(";"),
      ...rows.map(r => headers.map(h => escape(r[h])).join(";"))
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Polizze");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );

  const today = new Date();
  const totale = filtered.reduce((sum, t) => sum + (t.premio_lordo ?? 0), 0);
  const totaleImponibile = filtered.reduce((sum, t) => sum + (t.premio_netto ?? 0), 0);

  return (
    <div data-tour="cl-pol-page" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-teal-700 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
              Elenco Posizioni Assicurative
            </h1>
            <p className="text-sm text-muted-foreground">{filtered.length} di {titoli.length} polizze</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length} className="gap-1.5">
            <FileText className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportXLSX} disabled={!filtered.length} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtri */}
      <Card data-tour="cl-pol-filters">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

            <SearchableSelect options={ramiOptions} value={ramo} onValueChange={setRamo} placeholder="Garanzia" />
            <SearchableSelect options={compagnieOptions} value={compagnia} onValueChange={setCompagnia} placeholder="Compagnia" />
            <Input placeholder="Cerca polizza / targa / prodotto / CIG" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex gap-2">
              <DatePicker value={scadDa} onChange={setScadDa} placeholder="Scad. da" />
              <DatePicker value={scadA} onChange={setScadA} placeholder="Scad. a" />
            </div>
            {filtriAttivi && (
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="gap-1.5 self-center">
                <X className="h-4 w-4" /> Reset filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nessuna polizza trovata.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <Table>
              <TableHeader>
                <TableRow className="bg-teal-700 hover:bg-teal-700">
                  <TableHead className="text-white w-10"></TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Mandato / Agenzia</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Prodotto</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">N° Polizza / Targa</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">CIG</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Data Scadenza</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-center">Fraz.</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-right">Premio Imponibile</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-right">Premio Annuo Lordo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t, idx) => {
                  const giorni = t.data_scadenza ? differenceInDays(new Date(t.data_scadenza), today) : null;
                  const compagnia = t.compagnie?.nome ?? "—";
                  const prodotto = t.rami?.descrizione ?? t.prodotto_nome ?? t.descrizione_polizza ?? "—";
                  const polizzaTarga = [t.numero_titolo, t.targa_telaio].filter(Boolean).join(" / ") || "N/D";
                  const isExpanded = expandedId === t.id;
                  const expData = expandedData[t.id];

                  return (
                    <Fragment key={t.id}>
                    <TableRow
                      onClick={() => toggleExpand(t)}
                      className={`cursor-pointer transition-colors hover:bg-teal-50 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"} ${isExpanded ? "bg-teal-50" : ""}`}
                    >
                      <TableCell className="py-2.5 w-10">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-teal-700" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>

                      <TableCell className="py-2.5">
                        <p className="font-semibold text-sm text-foreground">{compagnia}</p>
                        {t.produttore_nome && <p className="text-xs text-muted-foreground">{t.produttore_nome}</p>}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <p className="text-sm font-medium text-teal-800">{prodotto}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <p className="text-sm font-mono text-foreground">{polizzaTarga}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <p className="text-xs font-mono text-muted-foreground">{t.cig_rif ?? "—"}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it }) : "—"}</span>
                        </div>
                        {giorni !== null && giorni >= 0 && giorni <= 90 && (
                          <Badge className={`mt-0.5 text-[10px] ${giorni <= 30 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{giorni} gg</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <span className="text-sm">{t.periodicita ?? "—"}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className="text-sm text-foreground">{t.premio_netto ? fmt(t.premio_netto) : "—"}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className="text-sm font-bold text-foreground">{t.premio_lordo ? fmt(t.premio_lordo) : "—"}</span>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${t.id}-exp`} className="bg-teal-50/60 hover:bg-teal-50/60">
                        <TableCell colSpan={9} className="py-4">
                          <div className="px-4 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Decorrenza</p><p>{t.durata_da ? format(new Date(t.durata_da), "dd/MM/yyyy", { locale: it }) : "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Scadenza</p><p>{t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it }) : "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Periodicità</p><p>{t.periodicita ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Compagnia</p><p>{compagnia}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Produttore</p><p>{t.produttore_nome ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Ramo / Prodotto</p><p>{prodotto}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">N° Polizza</p><p className="font-mono">{t.numero_titolo ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Targa / Telaio</p><p className="font-mono">{t.targa_telaio ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">CIG</p><p className="font-mono">{t.cig_rif ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Descrizione</p><p>{t.descrizione_polizza ?? "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Premio Imponibile</p><p>{t.premio_netto ? fmt(t.premio_netto) : "—"}</p></div>
                              <div><p className="text-xs uppercase text-teal-700 font-semibold tracking-wider">Premio Lordo</p><p className="font-bold">{t.premio_lordo ? fmt(t.premio_lordo) : "—"}</p></div>
                            </div>

                            {t._source === "titoli" && (
                              <div className="pt-3 border-t border-teal-200" onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs uppercase text-teal-700 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                                  <Receipt className="h-3.5 w-3.5" /> Annualità / Quietanze
                                </p>
                                {expData?.loading ? (
                                  <Skeleton className="h-16 w-full" />
                                ) : !expData || expData.quietanze.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">Nessuna quietanza registrata.</p>
                                ) : (
                                  <div className="rounded border border-teal-200 overflow-hidden bg-white">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-teal-100 hover:bg-teal-100">
                                          <TableHead className="text-teal-900 text-[10px] uppercase">Rata</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase">Da</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase">A</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase">Scadenza</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase text-right">Premio</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase">Stato</TableHead>
                                          <TableHead className="text-teal-900 text-[10px] uppercase">Incasso</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expData.quietanze.map((q: any) => (
                                          <TableRow key={q.id} className="text-xs">
                                            <TableCell className="py-1.5">{q.numero_rata ?? "—"}{q.numero_rate_totali ? ` / ${q.numero_rate_totali}` : ""}</TableCell>
                                            <TableCell className="py-1.5">{q.garanzia_da ? format(new Date(q.garanzia_da), "dd/MM/yyyy") : "—"}</TableCell>
                                            <TableCell className="py-1.5">{q.garanzia_a ? format(new Date(q.garanzia_a), "dd/MM/yyyy") : "—"}</TableCell>
                                            <TableCell className="py-1.5">{q.data_scadenza ? format(new Date(q.data_scadenza), "dd/MM/yyyy") : "—"}</TableCell>
                                            <TableCell className="py-1.5 text-right font-medium">{q.premio_lordo != null ? fmt(q.premio_lordo) : "—"}</TableCell>
                                            <TableCell className="py-1.5">
                                              <Badge className={`text-[10px] ${statoQuietanzaBadge[q.stato] ?? "bg-muted text-muted-foreground"}`}>{q.stato?.replace(/_/g, " ") ?? "—"}</Badge>
                                            </TableCell>
                                            <TableCell className="py-1.5">{q.data_incasso ? format(new Date(q.data_incasso), "dd/MM/yyyy") : "—"}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            )}

                            {t._source === "titoli" && (
                              <div className="pt-3 border-t border-teal-200" onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs uppercase text-teal-700 font-semibold tracking-wider mb-2 flex items-center gap-1.5">
                                  <Paperclip className="h-3.5 w-3.5" /> Documenti della polizza
                                </p>
                                {expData?.loading ? (
                                  <Skeleton className="h-12 w-full" />
                                ) : !expData || expData.documenti.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">Nessun documento disponibile.</p>
                                ) : (
                                  <div className="space-y-1 bg-white rounded border border-teal-200 p-2">
                                    {expData.documenti.map((d: any) => (
                                      <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 px-2 hover:bg-teal-50 rounded">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <FileText className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                          <span className="text-xs truncate">{d.nome_file}</span>
                                          {d.categoria && <Badge variant="secondary" className="text-[10px] shrink-0">{d.categoria}</Badge>}
                                          {d.created_at && <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(d.created_at), "dd/MM/yyyy", { locale: it })}</span>}
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => downloadDoc(d)}>
                                          <Download className="h-3.5 w-3.5" /> Scarica
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex justify-end pt-2 border-t border-teal-200">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); navigate(t._detailPath); }}
                                className="bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
                              >
                                <ExternalLink className="h-4 w-4" /> Apri dettaglio polizza
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-teal-50 border-t-2 border-teal-700">
                  <TableCell colSpan={7} className="font-bold text-sm text-teal-900 uppercase">Totale</TableCell>
                  <TableCell className="text-right font-bold text-sm text-teal-900">{fmt(totaleImponibile)}</TableCell>
                  <TableCell className="text-right font-bold text-base text-teal-900">{fmt(totale)}</TableCell>
                </TableRow>
              </TableFooter>

            </Table>
        </div>
      )}
    </div>
  );
};

export default ClientePolizze;
