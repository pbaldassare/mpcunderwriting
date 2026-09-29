import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findAllRelatedUsers } from "@/lib/findRelatedUsers";

export interface ChatRosterMember {
  userId: string;
  nome: string;
  ruolo: string;
}

export function useChatCanaleContestuale(entitaTipo: string, entitaId: string) {
  const { data: canaleId, isLoading: canaleLoading } = useQuery({
    queryKey: ["chat_canale_contestuale", entitaTipo, entitaId],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("chat_canali")
        .select("id")
        .eq("ambito", "contestuale")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .limit(1)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: canale } = await supabase
        .from("chat_canali")
        .insert({
          tipo: "gruppo",
          ambito: "contestuale",
          entita_tipo: entitaTipo,
          entita_id: entitaId,
          visibile_cliente: true,
          creato_da: user.id,
        })
        .select()
        .single();

      if (canale) {
        await supabase.from("chat_canali_membri").insert({
          canale_id: canale.id,
          user_id: user.id,
          ruolo_canale: "admin",
        });
        return canale.id;
      }
      return null;
    },
  });

  useQuery({
    queryKey: ["chat_canale_sync_members", canaleId, entitaTipo, entitaId],
    queryFn: async () => {
      if (!canaleId) return null;
      const related = await findAllRelatedUsers(entitaTipo, entitaId);
      if (related.length === 0) return null;

      const { data: existing } = await supabase
        .from("chat_canali_membri")
        .select("user_id")
        .eq("canale_id", canaleId);

      const existingIds = new Set((existing || []).map((m: { user_id: string }) => m.user_id));
      const toAdd = related.filter((u) => !existingIds.has(u.userId));

      if (toAdd.length > 0) {
        await supabase
          .from("chat_canali_membri")
          .upsert(
            toAdd.map((u) => ({
              canale_id: canaleId,
              user_id: u.userId,
              ruolo_canale: "membro",
            })),
            { onConflict: "canale_id,user_id", ignoreDuplicates: true }
          );
      }
      return { added: toAdd.length };
    },
    enabled: !!canaleId,
    staleTime: 300000,
  });

  const { data: roster = [] } = useQuery({
    queryKey: ["chat_canale_roster", canaleId, entitaTipo, entitaId],
    queryFn: async () => {
      if (!canaleId) return [] as ChatRosterMember[];
      const related = await findAllRelatedUsers(entitaTipo, entitaId);
      const roleMap = new Map(related.map((r) => [r.userId, r.ruolo]));

      const { data: membri } = await supabase
        .from("chat_canali_membri")
        .select("user_id, profiles:user_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId);

      return (membri || []).map((m: any) => {
        const p = m.profiles;
        const nome = p ? `${p.cognome || ""} ${p.nome || ""}`.trim() || "—" : "—";
        const ruoloLogico = roleMap.get(m.user_id) || p?.ruolo || "membro";
        return { userId: m.user_id, nome, ruolo: ruoloLogico };
      });
    },
    enabled: !!canaleId,
    staleTime: 300000,
  });

  return { canaleId: canaleId ?? null, canaleLoading, roster };
}
