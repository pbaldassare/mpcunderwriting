import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildPrecontrattualePdf, type PrecontrattualeData } from "@/lib/precontrattuale-pdf";
import PdfPreview from "@/components/PdfPreview";
import { SearchableSelect } from "@/components/SearchableSelect";
import { PageContainer } from "@/components/shared/PageContainer";



const DocPrecontrattualePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteIdParamRaw = searchParams.get("clienteId");
  const titoloIdParam = searchParams.get("titoloId");

  // Carica titolo se presente (per prefill polizza + derivare cliente)
  const { data: titoloData } = useQuery({
    queryKey: ["doc-precontr-titolo", titoloIdParam],
    enabled: !!titoloIdParam,
    queryFn: async () => {
      if (!titoloIdParam) return null;
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, appendice, cliente_anagrafica_id, compagnia_id, ramo_id, data_scadenza, garanzia_da, durata_da, periodicita, premio_lordo, compagnie:compagnia_id(nome, codice), rami:ramo_id(codice, descrizione)")
        .eq("id", titoloIdParam)
        .maybeSingle();
      return data as any;
    },
  });

  const clienteIdParam = clienteIdParamRaw || (titoloData?.cliente_anagrafica_id ?? null);

  // Contratto intermediato
  const [codiceCliente, setCodiceCliente] = useState("");
  const [contraente, setContraente] = useState("");
  const [polizza, setPolizza] = useState("");
  const [appendice, setAppendice] = useState("");
  const [riferimento, setRiferimento] = useState("");
  const [codiceCompagnia, setCodiceCompagnia] = useState("");
  const [compagniaNome, setCompagniaNome] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [cap, setCap] = useState("");
  const [citta, setCitta] = useState("");
  const [provincia, setProvincia] = useState("");
  const [nazione, setNazione] = useState("Italia");
  const [gruppo, setGruppo] = useState("");
  const [ramo, setRamo] = useState("");
  const [dataDecorrenza, setDataDecorrenza] = useState("");
  const [dataScadenza, setDataScadenza] = useState("");
  const [frazionamento, setFrazionamento] = useState("");
  const [premioLordo, setPremioLordo] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");

  // Intermediario RUI
  const [intermediario, setIntermediario] = useState("");
  const [sede, setSede] = useState<string>("");
  const [nomeCognomeRui, setNomeCognomeRui] = useState("");
  const [sezioneRui, setSezioneRui] = useState("");
  const [numeroRui, setNumeroRui] = useState("");
  const [dataIscrizione, setDataIscrizione] = useState("");
  const [indirizzoRui, setIndirizzoRui] = useState("");
  const [capRui, setCapRui] = useState("");
  const [cittaRui, setCittaRui] = useState("");
  const [provinciaRui, setProvinciaRui] = useState("");
  const [emailRui, setEmailRui] = useState("");
  const [telRui, setTelRui] = useState("");
  const [qualitaDi, setQualitaDi] = useState("Ditta individuale");

  // Sezione I
  const [modelloDistribuzione, setModelloDistribuzione] = useState("L'intermediario agisce su incarico del cliente");
  const [collaborazioneAltri, setCollaborazioneAltri] = useState(false);

  // Sezione II
  const [sezioneII, setSezioneII] = useState("consulenza_imparziale");

  // Sezione III
  const [tipoRemunerazione, setTipoRemunerazione] = useState("Commissione inclusa nel premio assicurativo");

  // Sezione IV
  const [sezioneIV, setSezioneIV] = useState("patrimonio_autonomo");
  const [fideiussione, setFideiussione] = useState(false);
  const [pagamentoNonLiberatorio, setPagamentoNonLiberatorio] = useState(false);

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup-doc", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, partita_iva")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCliente.length >= 2,
  });

  const { data: compagniaData } = useQuery({
    queryKey: ["agenzia-lookup-doc", codiceCompagnia],
    queryFn: async () => {
      if (!codiceCompagnia || codiceCompagnia.length < 2) return null;
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .or(`codice.ilike.%${codiceCompagnia}%,nome.ilike.%${codiceCompagnia}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCompagnia.length >= 2,
  });

  const { data: aeList } = useQuery({
    queryKey: ["interm-ae-list-doc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla, sezione_rui, numero_rui, iscrizione_rui, nome_rui, indirizzo, cap, citta, provincia, email, telefono")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: specialistList } = useQuery({
    queryKey: ["interm-specialist-list-doc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, email, telefono, indirizzo, cap, citta, provincia, nome_rui, sezione_rui, numero_rui, data_iscrizione_rui, ufficio_id")
        .eq("ruolo", "backoffice")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: produttoreList } = useQuery({
    queryKey: ["interm-produttore-list-doc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla, sezione_rui, numero_rui, iscrizione_rui, nome_rui, indirizzo, cap, citta, provincia, email, telefono, tipo")
        .in("tipo", ["produttore_sede", "corrispondente"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: ufficiList } = useQuery({
    queryKey: ["uffici-list-doc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .order("nome_ufficio");
      return data || [];
    },
  });

  // ============== PREFILL DA CLIENTE ==============
  // Query: cliente + sede + specialist (Backoffice in codici_commerciali_cliente -> profile)
  const { data: prefillData } = useQuery({
    queryKey: ["doc-precontr-prefill", clienteIdParam],
    enabled: !!clienteIdParam,
    queryFn: async () => {
      if (!clienteIdParam) return null;

      const { data: cliRaw } = await supabase
        .from("clienti")
        .select(
          "id, nome, cognome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva, " +
          "indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, " +
          "indirizzo_sede, cap_sede, citta_sede, provincia_sede, ufficio_id"
        )
        .eq("id", clienteIdParam)
        .maybeSingle();
      const cli: any = cliRaw;
      if (!cli) return null;

      const { data: ufficioRaw } = cli.ufficio_id
        ? await supabase
            .from("uffici")
            .select("id, nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
            .eq("id", cli.ufficio_id)
            .maybeSingle()
        : { data: null as any };
      const ufficio: any = ufficioRaw;

      const { data: assegn } = await supabase.from("codici_commerciali_cliente")
        .select("profilo_id")
        .eq("cliente_id", clienteIdParam)
        .eq("ruolo", "Backoffice")
        .maybeSingle();

      let specialist: any = null;
      if (assegn?.profilo_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, nome, cognome, email, telefono, indirizzo, cap, citta, provincia, nome_rui, sezione_rui, numero_rui, data_iscrizione_rui")
          .eq("id", assegn.profilo_id)
          .maybeSingle();
        specialist = p;
      }
      return { cliente: cli, ufficio, specialist };
    },
  });

  // Helper: parsa "Via Roma 1, 80100 Napoli, NA" in {via, cap, citta, prov}
  const parseIndirizzoSede = (full?: string | null) => {
    if (!full) return { via: "", cap: "", citta: "", prov: "" };
    const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
    let via = parts[0] || "";
    let cap = "", citta = "", prov = "";
    // cerca "CAP città" oppure singoli pezzi
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const m = p.match(/^(\d{5})\s+(.+)$/);
      if (m) { cap = m[1]; citta = m[2]; }
      else if (p.length === 2 && /^[A-Za-z]{2}$/.test(p)) { prov = p.toUpperCase(); }
      else if (!citta) { citta = p; }
    }
    return { via, cap, citta, prov };
  };

  useEffect(() => {
    if (!prefillData) return;
    const { cliente: cli, ufficio, specialist } = prefillData;

    // --- CLIENTE ---
    setCodiceCliente(cli.codice_fiscale || cli.partita_iva || "");
    setCodiceFiscale(cli.codice_fiscale || "");
    setPartitaIva(cli.partita_iva || "");
    const nomeCli = cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim();
    if (nomeCli) setContraente(nomeCli);

    const isPrivato = cli.tipo_cliente === "privato";
    const ind = isPrivato ? cli.indirizzo_residenza : (cli.indirizzo_sede || cli.indirizzo_residenza);
    const c   = isPrivato ? cli.cap_residenza : (cli.cap_sede || cli.cap_residenza);
    const ci  = isPrivato ? cli.citta_residenza : (cli.citta_sede || cli.citta_residenza);
    const pr  = isPrivato ? cli.provincia_residenza : (cli.provincia_sede || cli.provincia_residenza);
    setIndirizzo(ind || "");
    setCap(c || "");
    setCitta(ci || "");
    setProvincia(pr || "");
    setNazione("Italia");

    // --- INTERMEDIARIO RUI: Specialist + Sede ---
    if (specialist) {
      setIntermediario(`sp:${specialist.id}`);
      setNomeCognomeRui(
        specialist.nome_rui ||
          `${specialist.cognome || ""} ${specialist.nome || ""}`.trim()
      );
      setSezioneRui(specialist.sezione_rui || "");
      setNumeroRui(specialist.numero_rui || "");
      setDataIscrizione(
        specialist.data_iscrizione_rui
          ? new Date(specialist.data_iscrizione_rui).toLocaleDateString("it-IT")
          : ""
      );
      setEmailRui(specialist.email || ufficio?.email || "");
      setTelRui(specialist.telefono || ufficio?.telefono || "");
    }
    // Indirizzo intermediario = SEDE: preferisci campi strutturati, fallback al parser legacy
    if (ufficio) {
      if (ufficio.cap || ufficio.citta || ufficio.provincia) {
        setIndirizzoRui(ufficio.indirizzo || "");
        setCapRui(ufficio.cap || "");
        setCittaRui(ufficio.citta || "");
        setProvinciaRui(ufficio.provincia || "");
      } else {
        const parsed = parseIndirizzoSede(ufficio.indirizzo);
        setIndirizzoRui(parsed.via || ufficio.indirizzo || "");
        setCapRui(parsed.cap);
        setCittaRui(parsed.citta);
        setProvinciaRui(parsed.prov);
      }
      setSede(ufficio.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillData]);

  // Prefill dati POLIZZA quando arriviamo da TitoloDetail
  useEffect(() => {
    if (!titoloData) return;
    setPolizza(titoloData.numero_titolo || "");
    setAppendice(titoloData.appendice || "");
    const ramoTxt = titoloData.rami
      ? `${titoloData.rami.codice || ""} ${titoloData.rami.descrizione || ""}`.trim()
      : "";
    if (ramoTxt) setRamo(ramoTxt);
    const cmp = titoloData.compagnie;
    if (cmp?.codice) setCodiceCompagnia(cmp.codice);
    else if (cmp?.nome) setCodiceCompagnia(cmp.nome);
    if (cmp?.nome) setCompagniaNome(cmp.nome);

    // Date: preferisci garanzia_da, fallback durata_da
    const fmt = (d?: string | null) =>
      d ? new Date(d).toLocaleDateString("it-IT") : "";
    setDataDecorrenza(fmt(titoloData.garanzia_da || titoloData.durata_da));
    setDataScadenza(fmt(titoloData.data_scadenza));

    // Frazionamento da periodicita
    const periodMap: Record<string, string> = {
      A: "Annuale", S: "Semestrale", Q: "Quadrimestrale", T: "Trimestrale",
      B: "Bimestrale", M: "Mensile", U: "Unica",
      annuale: "Annuale", semestrale: "Semestrale", trimestrale: "Trimestrale",
      mensile: "Mensile", unica: "Unica",
    };
    const per = (titoloData.periodicita || "").toString();
    setFrazionamento(periodMap[per] || periodMap[per?.toUpperCase?.()] || per || "");

    // Premio lordo formattato
    if (titoloData.premio_lordo != null) {
      const n = Number(titoloData.premio_lordo);
      if (!Number.isNaN(n)) {
        setPremioLordo(n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titoloData]);

  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  // Lista UNICA: AE + Specialist + Produttori, ordinata per cognome.
  // Ogni value è prefissato con l'origine (ae:/sp:/pr:) per leggere dalla sorgente giusta.
  const intermediarioOptions = (() => {
    const ae = (aeList || []).map((a: any) => ({
      value: `ae:${a.id}`,
      label: `${a.cognome || ""} ${a.nome || ""}`.trim() || a.sigla || a.codice || "—",
      description: a.email || "",
      searchText: `${a.sigla || ""} ${a.codice || ""} ${a.cognome || ""} ${a.nome || ""} ${a.numero_rui || ""}`,
      _sortKey: (a.cognome || "").toLowerCase(),
    }));
    const sp = (specialistList || []).map((s: any) => ({
      value: `sp:${s.id}`,
      label: `${s.cognome || ""} ${s.nome || ""}`.trim() || s.email || "—",
      description: s.email || "",
      searchText: `${s.cognome || ""} ${s.nome || ""} ${s.numero_rui || ""}`,
      _sortKey: (s.cognome || "").toLowerCase(),
    }));
    const pr = (produttoreList || []).map((p: any) => ({
      value: `pr:${p.id}`,
      label: `${p.cognome || ""} ${p.nome || ""}`.trim() || p.sigla || p.codice || "—",
      description: p.email || "",
      searchText: `${p.sigla || ""} ${p.codice || ""} ${p.cognome || ""} ${p.nome || ""} ${p.numero_rui || ""}`,
      _sortKey: (p.cognome || "").toLowerCase(),
    }));
    return [...ae, ...sp, ...pr]
      .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
      .map(({ _sortKey, ...rest }) => rest);
  })();

  const applyIntermediario = (id: string) => {
    setIntermediario(id);
    if (!id) return;
    const [origin, realId] = id.split(":");
    if (origin === "sp") {
      const s: any = (specialistList || []).find((x: any) => x.id === realId);
      if (!s) return;
      setNomeCognomeRui(s.nome_rui || `${s.cognome || ""} ${s.nome || ""}`.trim());
      setSezioneRui(s.sezione_rui || "");
      setNumeroRui(s.numero_rui || "");
      setDataIscrizione(s.data_iscrizione_rui ? new Date(s.data_iscrizione_rui).toLocaleDateString("it-IT") : "");
      setIndirizzoRui(s.indirizzo || "");
      setCapRui(s.cap || "");
      setCittaRui(s.citta || "");
      setProvinciaRui(s.provincia || "");
      setEmailRui(s.email || "");
      setTelRui(s.telefono || "");
      return;
    }
    const list: any[] = origin === "pr" ? (produttoreList || []) : (aeList || []);
    const r: any = list.find((x: any) => x.id === realId);
    if (!r) return;
    setNomeCognomeRui(r.nome_rui || `${r.cognome || ""} ${r.nome || ""}`.trim());
    setSezioneRui(r.sezione_rui || "");
    setNumeroRui(r.numero_rui || "");
    setDataIscrizione(r.iscrizione_rui || "");
    setIndirizzoRui(r.indirizzo || "");
    setCapRui(r.cap || "");
    setCittaRui(r.citta || "");
    setProvinciaRui(r.provincia || "");
    setEmailRui(r.email || "");
    setTelRui(r.telefono || "");
  };

  const composeIndirizzoSede = (u: any) => {
    if (!u) return "";
    const cityPart = [u.cap, u.citta].filter(Boolean).join(" ");
    const tail = [cityPart, u.provincia ? `(${u.provincia})` : ""].filter(Boolean).join(" ");
    return [u.indirizzo, tail].filter(Boolean).join(", ");
  };

  const ufficiOptions = (ufficiList || []).map((u: any) => ({
    value: u.id,
    label: u.nome_ufficio || "—",
    description: composeIndirizzoSede(u),
    searchText: composeIndirizzoSede(u),
  }));

  const applySede = (id: string) => {
    setSede(id);
    if (!id) return;
    const u: any = (ufficiList || []).find((x: any) => x.id === id);
    if (!u) return;
    if (u.cap || u.citta || u.provincia) {
      setIndirizzoRui(u.indirizzo || "");
      setCapRui(u.cap || "");
      setCittaRui(u.citta || "");
      setProvinciaRui(u.provincia || "");
    } else {
      const parsed = parseIndirizzoSede(u.indirizzo);
      setIndirizzoRui(parsed.via || u.indirizzo || "");
      setCapRui(parsed.cap || "");
      setCittaRui(parsed.citta || "");
      setProvinciaRui(parsed.prov || "");
    }
    if (u.email) setEmailRui(u.email);
    if (u.telefono) setTelRui(u.telefono);
  };

  const buildData = (): PrecontrattualeData => {
    const cli = prefillData?.cliente as any;
    const nomeRagSoc =
      contraente ||
      cli?.ragione_sociale ||
      `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() ||
      (clienteData?.ragione_sociale || `${clienteData?.cognome || ""} ${clienteData?.nome || ""}`.trim());

    const sezioneIIMap: Record<string, string> = {
      consulenza_119ter_c3: "L'intermediario fornisce una consulenza ai sensi dell'art. 119-ter comma 3 del Codice delle Assicurazioni.",
      consulenza_imparziale: "L'intermediario informa che ha fornito una consulenza fondata su un'analisi imparziale e personale ai sensi dell'articolo 119-ter, comma 4, del Codice in quanto fondata sull'analisi di un numero sufficiente di prodotti assicurativi disponibili sul mercato che gli consenta di formulare una raccomandazione personalizzata.",
      distribuzione_obblighi: "L'intermediario informa che distribuisce contratti in assenza di obblighi contrattuali che impongano loro di offrire esclusivamente i contratti di una o più imprese di assicurazione.",
    };
    const sezioneIVMap: Record<string, string> = {
      patrimonio_autonomo: "I premi pagati dal contraente agli intermediari e le somme destinate ai risarcimenti o ai pagamenti dovuti alle imprese di assicurazione, se regolati per il tramite dell'intermediario, costituiscono patrimonio autonomo e separato dal patrimonio dell'intermediario stesso.",
      fideiussione_117: "Ha costituito ai sensi dell'art. 117 comma 3 bis del Codice delle Assicurazioni una fideiussione a garanzia della capacità finanziaria richiesta dalla stessa norma, pari al 4% dei premi incassati, con un minimo di € 18.750,00.",
    };

    return {
      clienteNomeRagSoc: nomeRagSoc || "-",
      clienteCF: codiceFiscale,
      clientePIVA: partitaIva,
      clienteIndirizzo: indirizzo,
      clienteCap: cap,
      clienteCitta: citta,
      clienteProvincia: provincia,
      polizzaNumero: polizza,
      polizzaRiferimento: riferimento,
      polizzaCompagniaTesto: compagniaNome || compagniaData?.nome || "",
      polizzaRamo: ramo,
      polizzaAppendice: appendice,
      polizzaDataDecorrenza: dataDecorrenza,
      polizzaDataScadenza: dataScadenza,
      polizzaFrazionamento: frazionamento,
      polizzaPremioLordo: premioLordo,
      specialistNomeCognome: nomeCognomeRui,
      specialistSezioneRui: sezioneRui,
      specialistNumeroRui: numeroRui,
      specialistDataIscrizione: dataIscrizione,
      specialistEmail: emailRui,
      specialistTelefono: telRui,
      specialistIndirizzo: [indirizzoRui, capRui, cittaRui, provinciaRui].filter(Boolean).join(" - "),
      sedeNome: (ufficiList || []).find((x: any) => x.id === sede)?.nome_ufficio || "",
      sedeIndirizzoCompleto: composeIndirizzoSede((ufficiList || []).find((x: any) => x.id === sede)),
      sedeEmail: (ufficiList || []).find((x: any) => x.id === sede)?.email || "",
      sedeTelefono: (ufficiList || []).find((x: any) => x.id === sede)?.telefono || "",
      modelloDistribuzione,
      collaborazioneAltri,
      sezioneII_testo: sezioneIIMap[sezioneII] || "",
      tipoRemunerazione,
      sezioneIV_testo: sezioneIVMap[sezioneIV] || "",
      pagamentoNonLiberatorio,
      dataOggi: new Date().toLocaleDateString("it-IT"),
    };
  };

  const generateBlob = async (): Promise<Blob> => {
    const bytes = await buildPrecontrattualePdf(buildData());
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  };

  const handleAnteprima = async () => {
    try {
      setIsBuilding(true);
      const bytes = await buildPrecontrattualePdf(buildData());
      setPreviewBytes(bytes);
    } catch (e: any) {
      toast.error("Errore generazione anteprima: " + (e?.message || e));
    } finally {
      setIsBuilding(false);
    }
  };

  const handleStampa = async () => {
    try {
      setIsBuilding(true);
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.addEventListener("load", () => {
          try { w.print(); } catch {}
        });
      }
    } catch (e: any) {
      toast.error("Errore stampa: " + (e?.message || e));
    } finally {
      setIsBuilding(false);
    }
  };

  const fileName = () => {
    const cli = prefillData?.cliente as any;
    const surname = (cli?.cognome || cli?.ragione_sociale || "Cliente").replace(/\s+/g, "_");
    const today = new Date().toISOString().slice(0, 10);
    return `Precontrattuale_${surname}_${today}.pdf`;
  };

  const handleSalva = async () => {
    try {
      setIsBuilding(true);
      const bytes = await buildPrecontrattualePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();

      // Download locale
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      // Upload su Archivio Documentale (solo se abbiamo cliente)
      if (clienteIdParam) {
        const path = `${clienteIdParam}/precontrattuale/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_clienti")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;

        const { data: userData } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_clienti",
          entita_tipo: "cliente",
          entita_id: clienteIdParam,
          categoria: "Precontrattuale",
          visibile_al_cliente: true,
          caricato_da: userData?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;

        toast.success("PDF salvato e archiviato in Archivio Documentale");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <PageContainer variant="form">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documentazione Precontrattuale</h1>
        <p className="text-sm text-muted-foreground mt-1">Generazione documentazione precontrattuale</p>
      </div>

      {/* CONTRATTO INTERMEDIATO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Contratto Intermediato</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Colonna sinistra */}
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="cliente-doc">Cliente</Label>
                <div className="relative">
                  <Input id="cliente-doc" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice" className="max-w-[150px]" />
                  <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              {clienteData && (
                <p className="text-sm text-foreground pb-2">
                  {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contraente-doc">Contraente (Nome / Ragione Sociale)</Label>
              <Input id="contraente-doc" value={contraente} onChange={(e) => setContraente(e.target.value)} placeholder="Nome Cognome o Ragione Sociale" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="indirizzo-doc">Indirizzo</Label>
              <AddressAutocomplete id="indirizzo-doc" value={indirizzo} onChange={setIndirizzo} onSelect={(c) => { setCap(c.cap); setCitta(c.citta); setProvincia(c.provincia); }} />
            </div>
            <div className="flex gap-2">
              <div className="space-y-1.5 w-[80px]">
                <Label htmlFor="cap-doc">CAP</Label>
                <Input id="cap-doc" value={cap} onChange={(e) => setCap(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="citta-doc">Città</Label>
                <Input id="citta-doc" value={citta} onChange={(e) => setCitta(e.target.value)} />
              </div>
              <div className="space-y-1.5 w-[60px]">
                <Label htmlFor="prov-doc">Prov</Label>
                <Input id="prov-doc" value={provincia} onChange={(e) => setProvincia(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 max-w-[250px]">
              <Label>Nazione</Label>
              <select value={nazione} onChange={(e) => setNazione(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="Italia">Italia</option>
                <option value="Altro">Altro</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="cf-doc">Codice Fiscale</Label>
                <Input id="cf-doc" value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="piva-doc">Partita IVA</Label>
                <Input id="piva-doc" value={partitaIva} onChange={(e) => setPartitaIva(e.target.value)} />
              </div>
            </div>
          </div>
          {/* Colonna destra */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="polizza-doc">Polizza</Label>
                <Input id="polizza-doc" value={polizza} onChange={(e) => setPolizza(e.target.value)} />
              </div>
              <div className="space-y-1.5 w-[80px]">
                <Label htmlFor="app-doc">App</Label>
                <Input id="app-doc" value={appendice} onChange={(e) => setAppendice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rif-doc">Riferimento</Label>
              <Input id="rif-doc" value={riferimento} onChange={(e) => setRiferimento(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-doc">Agenzia</Label>
              <div className="relative max-w-[200px]">
                <Input id="comp-doc" value={codiceCompagnia} onChange={(e) => setCodiceCompagnia(e.target.value)} placeholder="Codice" />
                <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              </div>
              {compagniaData && <p className="text-xs text-muted-foreground">{compagniaData.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gruppo</Label>
              <select value={gruppo} onChange={(e) => setGruppo(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— Seleziona —</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Garanzia</Label>
              <select value={ramo} onChange={(e) => setRamo(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— Seleziona —</option>
                {ramo && <option value={ramo}>{ramo}</option>}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="dec-doc">Decorrenza</Label>
                <Input id="dec-doc" value={dataDecorrenza} onChange={(e) => setDataDecorrenza(e.target.value)} placeholder="gg/mm/aaaa" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="scad-doc">Scadenza</Label>
                <Input id="scad-doc" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} placeholder="gg/mm/aaaa" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="fraz-doc">Frazionamento</Label>
                <Input id="fraz-doc" value={frazionamento} onChange={(e) => setFrazionamento(e.target.value)} placeholder="Annuale / Semestrale ..." />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="premio-doc">Premio Lordo (€)</Label>
                <Input id="premio-doc" value={premioLordo} onChange={(e) => setPremioLordo(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {/* INTERMEDIARIO ISCRITTO AL RUI */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Intermediario Iscritto al RUI</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Intermediario</Label>
              <SearchableSelect
                options={intermediarioOptions}
                value={intermediario}
                onValueChange={applyIntermediario}
                placeholder="— Cerca e seleziona —"
                emptyText="Nessun intermediario trovato."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sede</Label>
              <SearchableSelect
                options={ufficiOptions}
                value={sede}
                onValueChange={applySede}
                placeholder="— Cerca e seleziona Sede —"
                emptyText="Nessuna sede trovata."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nome-rui">Nome e Cognome</Label>
              <Input id="nome-rui" value={nomeCognomeRui} onChange={(e) => setNomeCognomeRui(e.target.value)} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1.5 w-[100px]">
                <Label>Sezione</Label>
                <select value={sezioneRui} onChange={(e) => setSezioneRui(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">-</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="num-rui">Numero</Label>
                <Input id="num-rui" value={numeroRui} onChange={(e) => setNumeroRui(e.target.value)} />
              </div>
              <div className="space-y-1.5 w-[130px]">
                <Label htmlFor="data-iscr">Data Iscr.</Label>
                <Input id="data-iscr" value={dataIscrizione} onChange={(e) => setDataIscrizione(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ind-rui">Indirizzo</Label>
              <AddressAutocomplete id="ind-rui" value={indirizzoRui} onChange={setIndirizzoRui} onSelect={(c) => { setCapRui(c.cap); setCittaRui(c.citta); setProvinciaRui(c.provincia); }} />
            </div>
            <div className="flex gap-2">
              <div className="space-y-1.5 w-[80px]">
                <Label htmlFor="cap-rui">CAP</Label>
                <Input id="cap-rui" value={capRui} onChange={(e) => setCapRui(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="citta-rui">Città</Label>
                <Input id="citta-rui" value={cittaRui} onChange={(e) => setCittaRui(e.target.value)} />
              </div>
              <div className="space-y-1.5 w-[60px]">
                <Label htmlFor="prov-rui">Prov</Label>
                <Input id="prov-rui" value={provinciaRui} onChange={(e) => setProvinciaRui(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="email-rui">E-mail</Label>
                <Input id="email-rui" value={emailRui} onChange={(e) => setEmailRui(e.target.value)} />
              </div>
              <div className="space-y-1.5 w-[140px]">
                <Label htmlFor="tel-rui">Tel</Label>
                <Input id="tel-rui" value={telRui} onChange={(e) => setTelRui(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>In qualità di</Label>
              <select value={qualitaDi} onChange={(e) => setQualitaDi(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="Ditta individuale">Ditta individuale</option>
                <option value="Società di persone">Società di persone</option>
                <option value="Società di capitali">Società di capitali</option>
                <option value="Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)">Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)</option>
              </select>
            </div>
          </div>
        </div>
      </fieldset>

      {/* SEZIONE I */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sezione I – Modello di Distribuzione</legend>
        <Textarea
          value={modelloDistribuzione}
          onChange={(e) => setModelloDistribuzione(e.target.value)}
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Checkbox id="collab-altri" checked={collaborazioneAltri} onCheckedChange={(v) => setCollaborazioneAltri(!!v)} />
          <Label htmlFor="collab-altri" className="font-semibold cursor-pointer">Collaborazione con altri intermediari</Label>
        </div>
      </fieldset>

      {/* SEZIONE II */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sezione II – Informazioni sull'Attività di Distribuzione e Consulenza</legend>
        <RadioGroup value={sezioneII} onValueChange={setSezioneII} className="space-y-3">
          <div className="flex items-start gap-2">
            <RadioGroupItem value="consulenza_119ter_c3" id="sez2-a" className="mt-1" />
            <Label htmlFor="sez2-a" className="font-normal cursor-pointer leading-snug">
              L'intermediario fornisce una consulenza ai sensi dell'art. 119-ter comma 3 del Codice delle Assicurazioni.
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="consulenza_imparziale" id="sez2-b" className="mt-1" />
            <Label htmlFor="sez2-b" className="font-normal cursor-pointer leading-snug">
              L'intermediario informa che ha fornito una consulenza fondata su un'analisi imparziale e personale ai sensi dell'articolo 119-ter, comma 4, del Codice in quanto fondata sull'analisi di un numero sufficiente di prodotti assicurativi disponibili sul mercato.
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="distribuzione_obblighi" id="sez2-c" className="mt-1" />
            <Label htmlFor="sez2-c" className="font-normal cursor-pointer leading-snug">
              L'intermediario informa che distribuisce contratti in assenza di obblighi contrattuali che impongano loro di offrire esclusivamente i contratti di una o più imprese di assicurazione.
            </Label>
          </div>
        </RadioGroup>
      </fieldset>

      {/* SEZIONE III */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sezione III – Informazioni Relative alle Remunerazioni</legend>
        <div className="flex items-center gap-3">
          <Label>Tipo</Label>
          <select value={tipoRemunerazione} onChange={(e) => setTipoRemunerazione(e.target.value)}
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="Commissione inclusa nel premio assicurativo">Commissione inclusa nel premio assicurativo</option>
            <option value="Onorario a carico del cliente">Onorario a carico del cliente</option>
            <option value="Altro tipo di remunerazione">Altro tipo di remunerazione</option>
          </select>
        </div>
      </fieldset>

      {/* SEZIONE IV */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sezione IV – Informazioni sul Pagamento dei Premi</legend>
        <RadioGroup value={sezioneIV} onValueChange={setSezioneIV} className="space-y-3">
          <div className="flex items-start gap-2">
            <RadioGroupItem value="patrimonio_autonomo" id="sez4-a" className="mt-1" />
            <Label htmlFor="sez4-a" className="font-normal cursor-pointer leading-snug">
              I premi pagati dal contraente agli intermediari e le somme destinate ai risarcimenti o ai pagamenti dovuti alle imprese di assicurazione, se regolati per il tramite dell'intermediario costituiscono patrimonio autonomo e separato dal patrimonio dell'intermediario stesso.
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="fideiussione_117" id="sez4-b" className="mt-1" />
            <Label htmlFor="sez4-b" className="font-normal cursor-pointer leading-snug">
              Ha costituito ai sensi dell'art. 117 comma 3 bis del Codice delle Assicurazioni una fideiussione a garanzia della capacità finanziaria richiesta dalla stessa norma, pari al 4% dei premi incassati, con un minimo di € 18.750,00.
            </Label>
          </div>
        </RadioGroup>
        <div className="flex items-start gap-2 pt-1">
          <Checkbox id="pag-non-lib" checked={pagamentoNonLiberatorio} onCheckedChange={(v) => setPagamentoNonLiberatorio(!!v)} className="mt-1" />
          <Label htmlFor="pag-non-lib" className="font-normal cursor-pointer leading-snug">
            Il pagamento dei premi all'intermediario o a un suo collaboratore non ha effetto liberatorio ai sensi dell'art. 118 del Codice.
          </Label>
        </div>
      </fieldset>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>Chiudi</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAnteprima} disabled={isBuilding}>Anteprima</Button>
          <Button variant="outline" onClick={handleStampa} disabled={isBuilding}>Stampa</Button>
          <Button onClick={handleSalva} disabled={isBuilding}>Salva PDF</Button>
        </div>
      </div>

      {/* PREVIEW DIALOG */}
      <Dialog open={!!previewBytes} onOpenChange={(o) => { if (!o) setPreviewBytes(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-3">
            <DialogTitle>Anteprima Documentazione Precontrattuale</DialogTitle>
          </DialogHeader>
          <PdfPreview data={previewBytes} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default DocPrecontrattualePage;
