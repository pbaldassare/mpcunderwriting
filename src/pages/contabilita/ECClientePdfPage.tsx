import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Mail } from "lucide-react";
import { buildECClientePdf, type ECClienteData, type ECClienteRow } from "@/lib/ec-cliente-pdf";
import { exportECClienteXlsx } from "@/lib/ec-cliente-xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { ecClienteDefaultSelected, ecClienteTitoloEligible } from "@/lib/ecClienteTitoli";
import { uint8ToBase64 } from "@/lib/documentiEcCliente";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  RAGIONE_SOCIALE_CONSULBROKERS,
  resolveClienteEmail,
  resolveClienteIndirizzo,
  resolveClienteIntestazione,
  resolveClienteNome,
} from "@/lib/ecClienteAnagrafica";

const FOOTER_LINES_DEFAULT = [
  "Via Mergellina, 2 – 80121 Napoli (IT) Tel. +39 081 7648268",
  "Corso di Porta Nuova, 16 - 20121 Milano (IT) Tel. +39 345 7353364",
  "Codice Fiscale, Partita IVA e Registrazione al Registro di Impresa di Napoli: 0120975037. R.E.A. 1001556",
  "Capitale Sociale I.V.: 40.000,00 Euro",
  "Iscrizione al Registro Unico degli Intermediari: B000180506",
];

const NOTE_LEGALI_DEFAULT = [
  "Esente da Iva art. 10 DPR 633 del 26/10/72.",
  "Esente da bollo art. 34 DPR 601 del 29/09/73",
];

const ECClientePdfPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const clienteId = params.get("clienteId") || "";
  const titoliIdsParam = params.get("titoliIds") || "";
  const periodoDal = params.get("periodoDal") || "";
  const periodoAl = params.get("periodoAl") || "";
  const apriInvia = params.get("invia") === "1";

  const titoliIdsFromUrl = useMemo(() => titoliIdsParam ? titoliIdsParam.split(",").filter(Boolean) : [], [titoliIdsParam]);
  const today = format(new Date(), "yyyy-MM-dd");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const initSelectionRef = useRef(false);

  const [luogoData, setLuogoData] = useState("");
  const [oggetto, setOggetto] = useState("Estratto conto premi");
  const [introTesto, setIntroTesto] = useState("Vi trasmettiamo l'estratto conto delle operazioni condotte, pregandoVi di provvedere al saldo secondo quanto previsto dall'Art. 1901 c.c. e comunque entro i termini previsti dalle polizze.");
  const [intestatarioConto, setIntestatarioConto] = useState("");
  const [bancaConto, setBancaConto] = useState("");
  const [iban, setIban] = useState("");
  const [ragioneSocialeFooter, setRagioneSocialeFooter] = useState(RAGIONE_SOCIALE_CONSULBROKERS);
  const [noteFinali, setNoteFinali] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initSelectionRef.current = false;
    setSelectedIds(new Set());
  }, [clienteId]);

  // Cliente
  const { data: cliente } = useQuery({
    queryKey: ["ec-cli-pdf-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, sesso, email, pec, referente_email, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_sede, cap_sede, citta_sede, provincia_sede, indirizzo_fiscale, cap_fiscale, citta_fiscale, provincia_fiscale")
        .eq("id", clienteId)
        .maybeSingle();
      return data as any;
    },
  });

  // Sede mittente (per intestazione: città, indirizzo, ecc.)
  const { data: sede } = useQuery({
    queryKey: ["ec-cli-pdf-sede", profile?.ufficio_id],
    enabled: !!profile?.ufficio_id,
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("id", profile!.ufficio_id!)
        .maybeSingle();
      return data as any;
    },
  });

  // Conto bancario di incasso: catena Specialist → Sede del cliente → default Consulbrokers
  const { data: conto } = useQuery({
    queryKey: ["ec-cli-pdf-conto-resolved", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { resolveIbanCliente } = await import("@/lib/resolveIbanCliente");
      return await resolveIbanCliente(clienteId!);
    },
  });

  useEffect(() => {
    const cittaSede = sede?.citta || "Napoli";
    setLuogoData(`${cittaSede}, ${format(new Date(), "dd/MM/yyyy")}`);
  }, [sede]);

  useEffect(() => {
    if (conto) {
      if (conto.iban) setIban(conto.iban);
      if (conto.intestato_a) setIntestatarioConto(conto.intestato_a);
      if (conto.banca) setBancaConto(conto.banca);
    }
  }, [conto]);

  // Email specialist (Backoffice) assegnato al cliente — copia in CC
  const { data: specialistEmail } = useQuery({
    queryKey: ["ec-cli-pdf-specialist", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data: assegn } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id")
        .eq("cliente_id", clienteId)
        .eq("ruolo", "Backoffice")
        .maybeSingle();
      if (!assegn?.profilo_id) return "";
      const { data: prof } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", assegn.profilo_id)
        .maybeSingle();
      return (prof?.email || "").trim();
    },
  });

  const emailDestinatario = resolveClienteEmail(cliente);

  // Tutte le quietanze candidabili del cliente (selezione manuale con checkbox)
  const { data: titoliCandidati = [] } = useQuery({
    queryKey: ["ec-cli-pdf-titoli-candidati", clienteId, periodoDal, periodoAl],
    enabled: !!clienteId,
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select("id, numero_titolo, prodotto_nome, descrizione_polizza, premio_lordo, garanzia_da, garanzia_a, durata_da, data_messa_cassa, data_decorrenza_rinnovo, stato, sostituisce_polizza, ramo_id, compagnia_id, rami:ramo_id(codice, descrizione), compagnie:compagnia_id(nome, gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione))")
        .eq("cliente_anagrafica_id", clienteId)
        .is("data_messa_cassa", null)
        .not("sostituisce_polizza", "is", null)
        .in("stato", ["attivo", "sospeso"]);
      if (periodoDal) q = q.gte("garanzia_da", periodoDal);
      if (periodoAl) q = q.lte("garanzia_da", periodoAl);
      const { data, error } = await q.order("garanzia_da", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!titoliCandidati.length || initSelectionRef.current) return;
    initSelectionRef.current = true;
    const fromUrl = titoliIdsFromUrl.length > 0
      ? titoliIdsFromUrl.filter((id) => titoliCandidati.some((t: any) => t.id === id))
      : titoliCandidati.filter((t: any) => ecClienteDefaultSelected(t, today)).map((t: any) => t.id);
    setSelectedIds(new Set(fromUrl));
  }, [titoliCandidati, titoliIdsFromUrl, today]);

  const titoli = useMemo(
    () => titoliCandidati.filter((t: any) => selectedIds.has(t.id)),
    [titoliCandidati, selectedIds],
  );

  const toggleTitolo = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selezionaDefault = () => {
    setSelectedIds(new Set(
      titoliCandidati.filter((t: any) => ecClienteDefaultSelected(t, today)).map((t: any) => t.id),
    ));
  };

  // Compensazioni applicate (può essere vuoto: solo polizze già messe a cassa le hanno)
  const { data: compensazioniByTitolo = {} } = useQuery({
    queryKey: ["ec-cli-pdf-compensazioni", (titoli || []).map((t: any) => t.id).join(",")],
    enabled: (titoli || []).length > 0,
    queryFn: async () => {
      const ids = (titoli || []).map((t: any) => t.id);
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select("titolo_id, causale_codice, causale_descrizione, segno, importo, note")
        .in("titolo_id", ids);
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data || []).forEach((c: any) => {
        (map[c.titolo_id] = map[c.titolo_id] || []).push({
          codice: c.causale_codice,
          descrizione: c.causale_descrizione,
          segno: c.segno,
          importo: Number(c.importo),
          note: c.note || undefined,
        });
      });
      return map;
    },
  });

  // Giroconti inter-cliente del cliente (come pagatore → AVERE, come beneficiario → DARE)
  const { data: giroconti = [] } = useQuery({
    queryKey: ["ec-cli-pdf-giroconti", clienteId, periodoDal, periodoAl],
    enabled: !!clienteId,
    queryFn: async () => {
      let q = (supabase.from("giroconti_cliente") as any)
        .select("id, data, importo, note, cliente_pagatore_id, cliente_beneficiario_id, titolo_id, titoli:titolo_id(numero_titolo)")
        .or(`cliente_pagatore_id.eq.${clienteId},cliente_beneficiario_id.eq.${clienteId}`);
      if (periodoDal) q = q.gte("data", periodoDal);
      if (periodoAl) q = q.lte("data", periodoAl);
      const { data, error } = await q.order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const buildData = (): ECClienteData => {
    const righe: ECClienteRow[] = (titoli || []).map((t: any) => {
      const ramoR = t.rami;
      const ramo = ramoR ? (ramoR.descrizione || ramoR.codice || "") : "";
      const rischio = t.prodotto_nome || t.descrizione_polizza || "";
      const eff = t.garanzia_da || t.durata_da;
      const effetto = eff ? format(new Date(eff), "dd/MM/yyyy") : "";
      return {
        polizza: t.numero_titolo || "",
        ramo,
        rischio,
        compagnia: t.compagnie?.gruppi_compagnia?.descrizione || t.compagnie?.gruppo_compagnia || t.compagnie?.nome || "",
        effetto,
        premio: Number(t.premio_lordo) || 0,
        compensazioni: compensazioniByTitolo[t.id] || undefined,
      };
    });
    // Giroconti inter-cliente → righe dare/avere
    const girocontiRows = (giroconti || []).map((g: any) => {
      const isBeneficiario = g.cliente_beneficiario_id === clienteId;
      const dataG = g.data ? format(new Date(g.data), "dd/MM/yyyy") : "";
      const numTitolo = g.titoli?.numero_titolo || "";
      const descrizione = g.note
        || (isBeneficiario
          ? `Quietanza ${numTitolo} saldata con acconti di altro cliente`
          : `Acconto usato per quietanza ${numTitolo} di altro cliente`);
      return {
        data: dataG,
        descrizione,
        verso: (isBeneficiario ? "dare" : "avere") as "dare" | "avere",
        importo: Number(g.importo) || 0,
      };
    });

    // Totale dovuto = somma premi + Σ compensazioni segno '-' (aumentano dovuto) − Σ segno '+' (riducono dovuto)
    // + giroconti DARE (beneficiario) − giroconti AVERE (pagatore)
    const totale = righe.reduce((s, r) => {
      const comp = r.compensazioni || [];
      const plus = comp.filter((c) => c.segno === "+").reduce((a, c) => a + c.importo, 0);
      const minus = comp.filter((c) => c.segno === "-").reduce((a, c) => a + c.importo, 0);
      return s + r.premio + minus - plus;
    }, 0) + girocontiRows.reduce((s, g) => s + (g.verso === "dare" ? g.importo : -g.importo), 0);

    // Cliente (intestazione PDF)
    const addr = resolveClienteIndirizzo(cliente);

    return {
      sedeNome: sede?.nome_ufficio || "",
      sedeIndirizzo: sede?.indirizzo || "",
      sedeCap: sede?.cap || "",
      sedeCitta: sede?.citta || "",
      sedeProvincia: sede?.provincia || "",
      sedeTelefono: sede?.telefono || "",
      sedeEmail: sede?.email || "",
      clienteIntestazione: resolveClienteIntestazione(cliente),
      clienteNome: resolveClienteNome(cliente),
      clienteIndirizzo: addr.indirizzo,
      clienteCap: addr.cap,
      clienteCitta: addr.citta,
      clienteProvincia: addr.provincia,
      luogoData,
      oggetto,
      introTesto,
      righe,
      giroconti: girocontiRows,
      totale,
      intestatarioConto,
      bancaConto,
      iban,
      ragioneSocialeFooter,
      noteLegali: NOTE_LEGALI_DEFAULT,
      footerLines: FOOTER_LINES_DEFAULT,
    };
  };

  const fileName = () => {
    const cli = (cliente?.ragione_sociale || `${cliente?.cognome || ""}_${cliente?.nome || ""}`).replace(/\s+/g, "_") || "cliente";
    return `EC_${cli}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  };

  const handleStampa = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    } catch (e: any) { toast.error("Errore stampa: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleScarica = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error("Errore download: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const handleEsportaExcel = () => {
    try {
      const cli = (cliente?.ragione_sociale || `${cliente?.cognome || ""}_${cliente?.nome || ""}`).replace(/\s+/g, "_") || "cliente";
      const name = `EC_${cli}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      // Stato riconciliazione: in un E/C cliente vengono incluse solo le polizze
      // non ancora messe a cassa (premio da incassare). Una polizza è
      // "riconciliata" se ha già `data_messa_cassa` valorizzata (incasso
      // contabilizzato); le altre sono in attesa di pagamento.
      const riconciliazione: Record<string, { stato: "riconciliato" | "non_riconciliato"; nota?: string }> = {};
      for (const t of titoli || []) {
        const ric = !!t.data_messa_cassa;
        riconciliazione[t.numero_titolo || ""] = {
          stato: ric ? "riconciliato" : "non_riconciliato",
          nota: ric ? "Premio già incassato e messo a cassa" : "Premio in attesa di pagamento",
        };
      }
      exportECClienteXlsx(buildData(), name, {
        filtri: {
          periodoDal: periodoDal || undefined,
          periodoAl: periodoAl || undefined,
          categoria: "Premi da incassare (E/C cliente)",
        },
        riconciliazione,
      });
      toast.success("Excel scaricato");
    } catch (e: any) {
      toast.error("Errore export Excel: " + (e?.message || e));
    }
  };

  const handleSalva = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (clienteId) {
        const path = `${clienteId}/ec_cliente/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_generali",
          entita_tipo: "cliente",
          entita_id: clienteId,
          categoria: "EC Cliente",
          visibile_al_cliente: true,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;

        await logAttivita({
          azione: "stampa_ec_cliente",
          entita_tipo: "cliente",
          entita_id: clienteId,
          dettagli_json: { titoli: titoli?.length || 0, totale: buildData().totale },
        });
        toast.success("E/C cliente salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const handleInviaMail = async () => {
    if (!clienteId) {
      toast.error("Cliente mancante");
      return;
    }
    if (titoli.length === 0) {
      toast.error("Seleziona almeno una quietanza");
      return;
    }
    if (!emailDestinatario.trim()) {
      toast.error("Email cliente mancante in anagrafica");
      return;
    }
    try {
      setBusy(true);
      const data = buildData();
      const bytes = await buildECClientePdf(data);
      const name = fileName();
      const { data: res, error } = await supabase.functions.invoke("invia-ec-cliente", {
        body: {
          cliente_id: clienteId,
          titolo_ids: titoli.map((t: any) => t.id),
          subject: oggetto,
          html: introTesto.replace(/\n/g, "<br/>"),
          pdf_base64: uint8ToBase64(bytes),
          file_name: name,
          totale: data.totale,
          cc_specialist: specialistEmail || undefined,
        },
      });
      if (error) throw error;
      if (!res?.ok) throw new Error(res?.error || "Invio email fallito");
      toast.success(`E/C inviato a ${res.recipient || emailDestinatario}${res.cc_specialist ? ` (copia a ${res.cc_specialist})` : ""}`);
      if (res.archive_error) toast.warning(`Email inviata ma archivio PDF: ${res.archive_error}`);
    } catch (e: any) {
      toast.error("Errore invio email: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (apriInvia && titoli.length > 0 && emailDestinatario) {
      const el = document.getElementById("ec-cliente-invio-email");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [apriInvia, titoli.length, emailDestinatario]);

  const conteggio = titoli.length;
  const totale = titoli.reduce((s: number, t: any) => s + (Number(t.premio_lordo) || 0), 0);

  const clienteLabel = cliente?.ragione_sociale || `${cliente?.cognome || ""} ${cliente?.nome || ""}`.trim();

  const isDefaultSelected = (t: any) => ecClienteDefaultSelected(t, today);
  const isEligible = (t: any) => ecClienteTitoloEligible(t, today);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Estratto Conto Cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona le quietanze da includere. Di default sono preselezionate solo quelle <strong>non incassate</strong> con <strong>inizio garanzia ≤ oggi</strong>.
        </p>
      </div>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Dati Documento</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input value={clienteLabel} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Polizze incluse</Label>
            <Input value={`${conteggio} polizze — Totale € ${totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} disabled />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <Label className="block">Quietanze da includere nell&apos;E/C</Label>
            <Button type="button" variant="outline" size="sm" onClick={selezionaDefault}>
              Ripristina selezione default
            </Button>
          </div>
          <TableScrollArea className="rounded-md border border-border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-primary/10 text-primary">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  <th className="text-left px-3 py-2 font-semibold">N. Titolo</th>
                  <th className="text-left px-3 py-2 font-semibold">Garanzia</th>
                  <th className="text-left px-3 py-2 font-semibold">Rischio</th>
                  <th className="text-left px-3 py-2 font-semibold">Compagnia</th>
                  <th className="text-center px-3 py-2 font-semibold">Inizio garanzia</th>
                  <th className="text-right px-3 py-2 font-semibold">Premio</th>
                </tr>
              </thead>
              <tbody>
                {titoliCandidati.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Nessuna quietanza disponibile</td></tr>
                )}
                {titoliCandidati.map((t: any, i: number) => {
                  const ramo = t.rami ? (t.rami.descrizione || t.rami.codice || "") : "";
                  const rischio = t.prodotto_nome || t.descrizione_polizza || "";
                  const eff = t.garanzia_da || t.durata_da;
                  const effetto = eff ? format(new Date(eff), "dd/MM/yyyy") : "";
                  const premio = Number(t.premio_lordo) || 0;
                  const checked = selectedIds.has(t.id);
                  const future = t.garanzia_da && t.garanzia_da > today;
                  return (
                    <tr key={t.id} className={i % 2 ? "bg-muted/30" : ""}>
                      <td className="px-2 py-2 text-center">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleTitolo(t.id, !!v)}
                          aria-label={`Includi ${t.numero_titolo}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{t.numero_titolo || ""}</td>
                      <td className="px-3 py-2">{ramo}</td>
                      <td className="px-3 py-2">{rischio}</td>
                      <td className="px-3 py-2">{t.compagnie?.nome || ""}</td>
                      <td className="px-3 py-2 text-center">
                        {effetto}
                        {future && <span className="block text-[10px] text-muted-foreground">futura</span>}
                        {!future && isDefaultSelected(t) && <span className="block text-[10px] text-primary">default</span>}
                        {!isEligible(t) && !future && <span className="block text-[10px] text-amber-600">fuori default</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">€ {premio.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
              {titoli.length > 0 && (
                <tfoot className="bg-primary/10 text-primary font-semibold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right">Totale selezionato EURO</td>
                    <td className="px-3 py-2 text-right">€ {totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </TableScrollArea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Luogo e data</Label>
            <Input value={luogoData} onChange={(e) => setLuogoData(e.target.value)} placeholder="Es: Napoli, 18/03/2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Oggetto</Label>
            <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Testo introduttivo</Label>
            <Textarea value={introTesto} onChange={(e) => setIntroTesto(e.target.value)} rows={3} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Coordinate Bancarie</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Intestatario conto</Label>
            <Input value={intestatarioConto} onChange={(e) => setIntestatarioConto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Banca</Label>
            <Input value={bancaConto} onChange={(e) => setBancaConto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input value={iban} onChange={(e) => setIban(e.target.value)} />
            {conto?.fonte && conto.fonte !== "nessuno" && (
              <p className="text-[11px] text-muted-foreground">
                Fonte:{" "}
                {conto.fonte === "specialist" && "Specialist assegnato al cliente"}
                {conto.fonte === "sede" && "Sede del cliente"}
                {conto.fonte === "default" && "Conto di default Consulbrokers"}
                {" "}— modificabile prima della stampa.
              </p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ragione sociale (firma)</Label>
            <Input value={ragioneSocialeFooter} onChange={(e) => setRagioneSocialeFooter(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset id="ec-cliente-invio-email" className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Invio email al cliente</legend>
        <p className="text-xs text-muted-foreground">
          L&apos;email allega il PDF dell&apos;E/C e lo archivia automaticamente nei documenti del cliente (come l&apos;avviso incasso messa a cassa).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Destinatario (da anagrafica cliente)</Label>
            <Input
              value={emailDestinatario || "— email non presente in anagrafica —"}
              disabled
              className={!emailDestinatario ? "border-destructive text-destructive" : ""}
            />
            {!emailDestinatario && (
              <p className="text-[11px] text-destructive">
                Compila il campo Email (o PEC / referente) nella scheda cliente prima di inviare.
              </p>
            )}
          </div>
          {specialistEmail && (
            <div className="space-y-1.5 md:col-span-2">
              <Label>Copia a specialist</Label>
              <Input value={specialistEmail} disabled />
            </div>
          )}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Testo email</Label>
            <p className="text-[11px] text-muted-foreground mb-1">
              Uguale al testo introduttivo del documento (modificabile sopra).
            </p>
            <Textarea value={introTesto} disabled rows={4} className="bg-muted/40" />
          </div>
        </div>
        <Button onClick={handleInviaMail} disabled={busy || titoli.length === 0 || !emailDestinatario.trim()}>
          <Mail className="h-4 w-4 mr-2" /> Invia mail con PDF allegato
        </Button>
      </fieldset>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>Chiudi</Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleStampa} disabled={busy || titoli.length === 0}>Stampa</Button>
          <Button variant="outline" onClick={handleScarica} disabled={busy || titoli.length === 0}>Scarica PDF</Button>
          <Button variant="outline" onClick={handleEsportaExcel} disabled={busy || titoli.length === 0}>Esporta Excel</Button>
          <Button onClick={handleSalva} disabled={busy || titoli.length === 0}>Salva PDF</Button>
        </div>
      </div>
    </div>
  );
};

export default ECClientePdfPage;
