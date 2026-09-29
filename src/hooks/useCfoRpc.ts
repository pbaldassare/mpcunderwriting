import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CfoRpcParams } from "./useCfoFilters";

export type CfoRpcName =
  | "cfo_kpi"
  | "cfo_trend_mensile"
  | "cfo_yoy_mensile"
  | "cfo_premi_per_compagnia"
  | "cfo_premi_per_produttore"
  | "cfo_premi_per_ramo"
  | "cfo_top_clienti"
  | "cfo_redditivita_ufficio"
  | "cfo_loss_ratio_ramo"
  | "cfo_drill_titoli"
  | "cfo_drill_sinistri"
  | "cfo_provvigioni_non_pagate";

export function parseCfoJson<T = Record<string, unknown>>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  if (typeof data === "object") return [data as T];
  return [];
}

export function parseCfoObject<T extends Record<string, unknown>>(data: unknown): T | null {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  if (typeof data === "object" && !Array.isArray(data)) return data as T;
  return null;
}

async function callCfoRpc<T>(rpcName: CfoRpcName, params: Record<string, unknown> = {}): Promise<T> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  }
  const { data, error } = await supabase.rpc(rpcName as never, clean as never);
  if (error) throw error;
  return data as T;
}

export function useCfoRpc<T>(
  rpcName: CfoRpcName,
  params: CfoRpcParams & Record<string, unknown> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ["cfo-rpc", rpcName, params],
    queryFn: () => callCfoRpc<T>(rpcName, params),
    enabled,
    staleTime: 60_000,
  });
}

export { callCfoRpc };
