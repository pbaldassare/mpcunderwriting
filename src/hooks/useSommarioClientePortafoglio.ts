import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnalisiCgaDettaglio, AnalisiGaranziaRow } from "@/lib/portafoglioClienteAnalisi";
import {
  DEFAULT_SOMMARIO_LAYOUT,
  parseSommarioLayoutJson,
  type ClienteTemplateSommarioRow,
  type SommarioPolizzaRow,
} from "@/lib/sommarioPolizze";

export function useSommarioClientePortafoglio(clienteId: string | null | undefined) {
  const templateQ = useQuery({
    queryKey: ["cliente-template-sommario", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<ClienteTemplateSommarioRow | null> => {
      const { data, error } = await (supabase as any)
        .from("clienti_template_sommario")
        .select("*")
        .eq("cliente_id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          id: "",
          cliente_id: clienteId!,
          layout_key: "standard",
          nome_file: null,
          storage_bucket: null,
          storage_path: null,
          mime_type: null,
          file_size: null,
          layout_json: DEFAULT_SOMMARIO_LAYOUT,
          created_at: "",
          updated_at: "",
          updated_by: null,
        };
      }
      return { ...data, layout_json: parseSommarioLayoutJson(data.layout_json) };
    },
  });

  const polizzeQ = useQuery({
    queryKey: ["elab-sommario-polizze", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<SommarioPolizzaRow[]> => {
      const { data, error } = await supabase
        .from("v_portafoglio_titoli")
        .select(
          "id, numero_titolo, stato, ramo_nome, compagnia_nome, premio_lordo, garanzia_da, garanzia_a, data_scadenza, tacito_rinnovo, prodotto_nome, produttore_nome, nome_ufficio, ufficio_id, periodicita, disdetta_giorni, mora_giorni, limite_mora, descrizione_polizza, is_regolazione",
        )
        .eq("cliente_anagrafica_id", clienteId!)
        .is("sostituisce_polizza", null)
        .order("garanzia_a", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({
        id: r.id,
        numero_titolo: r.numero_titolo,
        stato: r.stato,
        ramo_nome: r.ramo_nome,
        compagnia_nome: r.compagnia_nome,
        premio_lordo: r.premio_lordo,
        garanzia_da: r.garanzia_da,
        garanzia_a: r.garanzia_a,
        data_scadenza: r.data_scadenza,
        tacito_rinnovo: r.tacito_rinnovo,
        prodotto_nome: r.prodotto_nome,
        produttore_nome: r.produttore_nome || null,
        nome_ufficio: r.nome_ufficio || null,
        ufficio_id: r.ufficio_id || null,
        periodicita: r.periodicita || null,
        disdetta_giorni: r.disdetta_giorni ?? null,
        mora_giorni: r.mora_giorni ?? null,
        limite_mora: r.limite_mora || null,
        descrizione_polizza: r.descrizione_polizza || null,
        is_regolazione: r.is_regolazione ?? null,
      })) as SommarioPolizzaRow[];

      const ids = rows.map((r) => r.id);
      if (!ids.length) return rows;
      const { data: extra, error: extraErr } = await supabase
        .from("titoli")
        .select("id, frazionamento, regolazione, regolazione_fattore, regolazione_note")
        .in("id", ids);
      if (extraErr) throw extraErr;
      const map = new Map((extra || []).map((t: any) => [t.id, t]));
      return rows.map((p) => {
        const e = map.get(p.id);
        return {
          ...p,
          frazionamento: e?.frazionamento ?? p.frazionamento ?? null,
          regolazione: e?.regolazione ?? null,
          regolazione_fattore: e?.regolazione_fattore ?? null,
          regolazione_note: e?.regolazione_note ?? null,
        };
      });
    },
  });

  const polizze = polizzeQ.data ?? [];
  const titoloIds = useMemo(() => polizze.map((p) => p.id), [polizze]);

  const garanzieQ = useQuery({
    queryKey: ["elab-sommario-garanzie", clienteId, titoloIds.join(",")],
    enabled: titoloIds.length > 0,
    queryFn: async (): Promise<AnalisiGaranziaRow[]> => {
      const { data, error } = await supabase
        .from("premi_garanzia_polizza")
        .select("titolo_id, garanzia, capitale, firma, rata, tipo_premio")
        .in("titolo_id", titoloIds)
        .order("ordine", { ascending: true });
      if (error) throw error;
      const byTitolo = new Map(polizze.map((p) => [p.id, p.numero_titolo]));
      return ((data || []) as any[]).map((g) => ({
        titolo_id: g.titolo_id,
        numero_polizza: byTitolo.get(g.titolo_id) || null,
        garanzia: g.garanzia,
        capitale: g.capitale,
        firma: g.firma,
        rata: g.rata,
        tipo_premio: g.tipo_premio,
      }));
    },
  });

  const cgaQ = useQuery({
    queryKey: ["elab-sommario-cga", clienteId, titoloIds.join(",")],
    enabled: titoloIds.length > 0,
    queryFn: async (): Promise<AnalisiCgaDettaglio[]> => {
      const { data, error } = await supabase
        .from("polizza_cga")
        .select("id, titolo_id, numero_polizza, sommario_personalizzato, stato")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const out: AnalisiCgaDettaglio[] = [];
      for (const r of (data || []) as any[]) {
        const key = r.titolo_id || r.numero_polizza;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          polizza_cga_id: r.id,
          titolo_id: r.titolo_id,
          numero_polizza: r.numero_polizza,
          prodotto_nome: null,
          compagnia: null,
          sommario: r.sommario_personalizzato,
          massimale_aggregato: null,
          garanzie: [],
          condizioni: [],
        });
      }
      return out;
    },
  });

  return {
    template: templateQ.data ?? null,
    polizze,
    garanzie: garanzieQ.data ?? [],
    cgaDettagli: cgaQ.data ?? [],
    isLoading: !!(clienteId && (polizzeQ.isLoading || templateQ.isLoading)),
  };
}
