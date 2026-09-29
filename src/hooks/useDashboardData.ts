import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatNonRisposta {
  canaleId: string;
  canaleNome: string;
  mittente: string;
  testo: string;
  data: string;
}

export interface AdminData {
  rinnoviMeseCount: number;
  rinnoviMeseImporto: number;
  rinnoviOggiCount: number;
  rinnoviOggiImporto: number;
  incassiIeriCount: number;
  incassiIeriImporto: number;
  incassiMeseCount: number;
  incassiMeseImporto: number;
  polizzeDaCassaCount: number;
  polizzeDaCassaImporto: number;
  chatNonRisposte: ChatNonRisposta[];
}

export interface UfficioData {
  scadenzeMeseCount: number;
  scadenzeMeseImporto: number;
  incassiMeseCount: number;
  incassiMeseImporto: number;
  fuoriCoperturaCount: number;
  fuoriCoperturaImporto: number;
  rimesseDaInviareCount: number;
  rimesseDaInviareImporto: number;
  incassiMensili: { mese: string; importo: number }[];
  scadenzePerCompagnia: { mese: string; importo: number }[];
}

export interface ProduttoreData {
  trattativeAperte: number;
  titoliAnno: number;
  provvigioniDaLiquidare: number;
  provvigioniMensili: { mese: string; importo: number }[];
}

export interface ContabilitaData {
  anomalieIncroci: number;
  fattureDaVerificare: number;
  incassiKO: number;
}

export interface CfoData {
  entrateTotali: number;
  usciteTotali: number;
  redditivita: number;
  provvigioniDaPagare: number;
}

export function useDashboardData(ruolo: string) {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [ufficio, setUfficio] = useState<UfficioData | null>(null);
  const [produttore, setProduttore] = useState<ProduttoreData | null>(null);
  const [contabilita, setContabilita] = useState<ContabilitaData | null>(null);
  const [cfo, setCfo] = useState<CfoData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      switch (ruolo) {
        case "admin":
          await loadAdmin();
          break;
        case "ufficio":
          await loadUfficio();
          break;
        case "produttore":
          await loadProduttore();
          break;
        case "contabilita":
          await loadContabilita();
          break;
        case "cfo":
          await loadCfo();
          break;
        default:
          await loadAdmin();
      }
    } catch (e) {
      console.error("Dashboard data error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ruolo) return;
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruolo]);

  const currentYear = new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  const startOfMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const loadAdmin = async () => {
    const oggi = new Date().toISOString().substring(0, 10);
    const ieri = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0, 10);

    const { data: { user } } = await supabase.auth.getUser();

    const [
      { data: rinnoviMese, count: rinnoviMeseCount },
      { data: rinnoviOggi, count: rinnoviOggiCount },
      { data: incassiIeri, count: incassiIeriCount },
      { data: incassiMese, count: incassiMeseCount },
      { data: polizzeDaCassa, count: polizzeDaCassaCount },
    ] = await Promise.all([
      supabase.from("v_portafoglio_quietanze").select("premio_lordo", { count: "exact" }).gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth).in("stato", ["attivo", "incassato"]).limit(10000),
      supabase.from("v_portafoglio_quietanze").select("premio_lordo", { count: "exact" }).eq("data_scadenza", oggi).in("stato", ["attivo", "incassato"]).limit(10000),
      supabase.from("v_portafoglio_quietanze").select("premio_lordo", { count: "exact" }).eq("data_messa_cassa", ieri).limit(10000),
      supabase.from("v_portafoglio_quietanze").select("premio_lordo", { count: "exact" }).gte("data_messa_cassa", startOfMonth).lte("data_messa_cassa", endOfMonth).limit(10000),
      supabase.from("v_portafoglio_quietanze").select("premio_lordo", { count: "exact" }).eq("stato", "attivo").is("data_messa_cassa", null).gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth).limit(10000),
    ]);

    const sumPremio = (arr: any[] | null) => (arr || []).reduce((s: number, t: any) => s + (t.premio_lordo || 0), 0);

    // Chat non risposte
    let chatNonRisposte: ChatNonRisposta[] = [];
    if (user) {
      const { data: memberships } = await supabase
        .from("chat_canali_membri")
        .select("canale_id")
        .eq("user_id", user.id);

      if (memberships && memberships.length > 0) {
        const canaleIds = memberships.map((m: any) => m.canale_id);
        
        // Fetch channels info
        const { data: canali } = await supabase
          .from("chat_canali")
          .select("id, nome")
          .in("id", canaleIds);

        // For each channel, get the last message
        const chatPromises = canaleIds.map((cId: string) =>
          supabase
            .from("chat_messaggi_interni")
            .select("id, messaggio, mittente_id, created_at, profiles:mittente_id(nome, cognome)")
            .eq("canale_id", cId)
            .order("created_at", { ascending: false })
            .limit(1)
        );

        const chatResults = await Promise.all(chatPromises);

        chatResults.forEach((res, idx) => {
          const msg = res.data?.[0];
          if (msg && msg.mittente_id !== user.id) {
            const canale = canali?.find((c: any) => c.id === canaleIds[idx]);
            const prof = msg.profiles as any;
            chatNonRisposte.push({
              canaleId: canaleIds[idx],
              canaleNome: canale?.nome || "Chat",
              mittente: prof ? `${prof.nome || ""} ${prof.cognome || ""}`.trim() : "Utente",
              testo: msg.messaggio || "",
              data: msg.created_at || "",
            });
          }
        });
      }
    }

    setAdmin({
      rinnoviMeseCount: rinnoviMeseCount ?? rinnoviMese?.length ?? 0,
      rinnoviMeseImporto: sumPremio(rinnoviMese),
      rinnoviOggiCount: rinnoviOggiCount ?? rinnoviOggi?.length ?? 0,
      rinnoviOggiImporto: sumPremio(rinnoviOggi),
      incassiIeriCount: incassiIeriCount ?? incassiIeri?.length ?? 0,
      incassiIeriImporto: sumPremio(incassiIeri),
      incassiMeseCount: incassiMeseCount ?? incassiMese?.length ?? 0,
      incassiMeseImporto: sumPremio(incassiMese),
      polizzeDaCassaCount: polizzeDaCassaCount ?? polizzeDaCassa?.length ?? 0,
      polizzeDaCassaImporto: sumPremio(polizzeDaCassa),
      chatNonRisposte,
    });
  };

  const loadUfficio = async () => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
    const in30gg = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
    const oggi = now.toISOString().substring(0, 10);

    const [
      { data: scadenzeMese },
      { data: incassiMese },
      { data: fuoriCopertura },
      { data: titoliIncassati },
      { data: rimesseDettaglio },
      { data: incassiAnno },
      { data: scadenze30 },
    ] = await Promise.all([
      // Scadenze del mese: titoli con data_scadenza nel mese corrente (tabella diretta)
      supabase.from("titoli").select("premio_lordo")
        .gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth)
        .in("stato", ["attivo", "incassato"]).limit(10000),
      // Incassi del mese: messa cassa nel mese (tabella diretta)
      supabase.from("titoli").select("premio_lordo")
        .gte("data_messa_cassa", startOfMonth).lte("data_messa_cassa", endOfMonth).limit(10000),
      // Fuori copertura: scadute nel mese, ancora attive, non ancora messe a cassa
      supabase.from("titoli").select("premio_lordo")
        .gte("data_scadenza", startOfMonth).lt("data_scadenza", oggi)
        .eq("stato", "attivo").is("data_messa_cassa", null).limit(10000),
      // Tutti i titoli incassati (id + premio)
      supabase.from("titoli").select("id, premio_lordo").eq("stato", "incassato").limit(10000),
      // Titoli già messi in rimessa
      supabase.from("rimessa_dettaglio").select("titolo_id").limit(10000),
      // Incassi ultimi 6 mesi per grafico
      supabase.from("v_portafoglio_quietanze").select("premio_lordo, data_messa_cassa")
        .gte("data_messa_cassa", new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().substring(0, 10))
        .limit(10000),
      // Scadenze prossimi 30gg con agenzia
      supabase.from("v_portafoglio_quietanze").select("premio_lordo, compagnia_nome")
        .gte("data_scadenza", oggi).lte("data_scadenza", in30gg)
        .in("stato", ["attivo", "incassato"]).limit(10000),
    ]);

    // Rimesse da inviare = titoli incassati NON presenti in rimessa_dettaglio
    const titoliInRimessa = new Set((rimesseDettaglio || []).map((r: any) => r.titolo_id));
    const rimesseDaInviare = (titoliIncassati || []).filter((t: any) => !titoliInRimessa.has(t.id));

    const sumPremio = (arr: any[] | null) => (arr || []).reduce((s: number, t: any) => s + (t.premio_lordo || 0), 0);

    // Incassi mensili (ultimi 6 mesi)
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const mesiMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mesiMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    (incassiAnno || []).forEach((t: any) => {
      if (t.data_messa_cassa) {
        const key = t.data_messa_cassa.substring(0, 7);
        if (key in mesiMap) mesiMap[key] += t.premio_lordo || 0;
      }
    });
    const incassiMensili = Object.entries(mesiMap).map(([k, v]) => {
      const [, m] = k.split("-");
      return { mese: monthNames[parseInt(m) - 1], importo: v };
    });

    // Scadenze prossimi 30gg per agenzia (top 8)
    const compMap: Record<string, number> = {};
    (scadenze30 || []).forEach((t: any) => {
      const c = t.compagnia_nome || "N/D";
      compMap[c] = (compMap[c] || 0) + (t.premio_lordo || 0);
    });
    const scadenzePerCompagnia = Object.entries(compMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, importo]) => ({ mese: name, importo }));

    setUfficio({
      scadenzeMeseCount: (scadenzeMese || []).length,
      scadenzeMeseImporto: sumPremio(scadenzeMese),
      incassiMeseCount: (incassiMese || []).length,
      incassiMeseImporto: sumPremio(incassiMese),
      fuoriCoperturaCount: (fuoriCopertura || []).length,
      fuoriCoperturaImporto: sumPremio(fuoriCopertura),
      rimesseDaInviareCount: rimesseDaInviare.length,
      rimesseDaInviareImporto: sumPremio(rimesseDaInviare),
      incassiMensili,
      scadenzePerCompagnia,
    });
  };

  const loadProduttore = async () => {
    const [
      { count: trattativeAperte },
      { count: titoliAnno },
      { data: provvigioni },
    ] = await Promise.all([
      supabase.from("prospect").select("*", { count: "exact", head: true }).in("stato", ["nuovo", "contattato", "in_trattativa"]),
      supabase.from("titoli").select("*", { count: "exact", head: true }).gte("created_at", startOfYear),
      supabase.from("provvigioni_generate").select("importo_provvigione, calcolata_il").eq("pagata", false),
    ]);

    const provvigioniDaLiquidare = (provvigioni || []).reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

    const mesiMap: Record<string, number> = {};
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      mesiMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    (provvigioni || []).forEach((p: any) => {
      if (p.calcolata_il) {
        const key = p.calcolata_il.substring(0, 7);
        if (key in mesiMap) mesiMap[key] += p.importo_provvigione || 0;
      }
    });
    const provvigioniMensili = Object.entries(mesiMap).map(([k, v]) => {
      const [, m] = k.split("-");
      return { mese: monthNames[parseInt(m) - 1], importo: v };
    });

    setProduttore({
      trattativeAperte: trattativeAperte || 0,
      titoliAnno: titoliAnno || 0,
      provvigioniDaLiquidare,
      provvigioniMensili,
    });
  };

  const loadContabilita = async () => {
    const [
      { count: anomalieIncroci },
      { count: incassiKO },
      { count: fattureDaVerificare },
    ] = await Promise.all([
      supabase.from("incroci_bancari").select("*", { count: "exact", head: true }).eq("esito", "ko"),
      supabase.from("incroci_bancari").select("*", { count: "exact", head: true }).eq("esito", "ko").eq("verificato", false),
      supabase.from("movimenti_contabili").select("*", { count: "exact", head: true }).eq("stato", "da_verificare"),
    ]);

    setContabilita({
      anomalieIncroci: anomalieIncroci || 0,
      fattureDaVerificare: fattureDaVerificare || 0,
      incassiKO: incassiKO || 0,
    });
  };

  const loadCfo = async () => {
    const [
      { data: entrate },
      { data: uscite },
      { data: provvigioni },
    ] = await Promise.all([
      supabase.from("movimenti_contabili").select("importo").eq("tipo", "entrata").gte("data_movimento", startOfYear),
      supabase.from("movimenti_contabili").select("importo").eq("tipo", "uscita").gte("data_movimento", startOfYear),
      supabase.from("provvigioni_generate").select("importo_provvigione").eq("pagata", false),
    ]);

    const entrateTotali = (entrate || []).reduce((s: number, e: any) => s + (e.importo || 0), 0);
    const usciteTotali = (uscite || []).reduce((s: number, e: any) => s + (e.importo || 0), 0);
    const redditivita = entrateTotali > 0 ? Math.round(((entrateTotali - usciteTotali) / entrateTotali) * 100) : 0;
    const provvigioniDaPagare = (provvigioni || []).reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

    setCfo({ entrateTotali, usciteTotali, redditivita, provvigioniDaPagare });
  };

  return { loading, admin, ufficio, produttore, contabilita, cfo };
}
