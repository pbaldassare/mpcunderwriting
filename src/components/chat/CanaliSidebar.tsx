import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Users,
  User,
  Megaphone,
  FileText,
  Briefcase,
  AlertTriangle,
  UserCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const PAGE_SIZE = 20;

interface CanaliSidebarProps {
  canaleAttivoId: string | null;
  onSelectCanale: (id: string) => void;
  onNuovaConversazione: () => void;
  userId: string;
  ambito?: "interno" | "contestuale";
  onAmbitoChange?: (ambito: "interno" | "contestuale") => void;
  showAmbitoToggle?: boolean;
}

interface CanaleMeta {
  id: string;
  nome: string | null;
  tipo: string;
  entita_tipo: string | null;
  entita_id: string | null;
  ambito: string;
  visibile_cliente: boolean;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

const tipoIcons = {
  diretto: User,
  gruppo: Users,
  broadcast: Megaphone,
};

const entitaIcons: Record<string, typeof FileText> = {
  cliente: UserCheck,
  trattativa: Briefcase,
  titolo: FileText,
  sinistro: AlertTriangle,
  argomento: Users,
};

const entitaLabels: Record<string, string> = {
  cliente: "Cliente",
  trattativa: "Trattativa",
  titolo: "Polizza",
  sinistro: "Sinistro",
  argomento: "Argomento",
};

export default function CanaliSidebar({
  canaleAttivoId,
  onSelectCanale,
  onNuovaConversazione,
  userId,
  ambito = "interno",
  onAmbitoChange,
  showAmbitoToggle = true,
}: CanaliSidebarProps) {
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");
  const [ricerca, setRicerca] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: pages, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["chat_canali_staff_meta", userId, ambito],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc("get_canali_staff_with_meta", {
        _user_id: userId,
        _ambito: ambito,
        _limit: PAGE_SIZE,
        _offset: pageParam,
      });
      if (error) throw error;
      return (data || []) as CanaleMeta[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const canali: CanaleMeta[] = useMemo(() => (pages?.pages || []).flat(), [pages]);

  const { data: matchingCanaliIds } = useQuery({
    queryKey: ["chat_search_msg_staff", ricerca, userId],
    queryFn: async () => {
      if (!ricerca || ricerca.length < 2) return new Set<string>();
      const canaleIds = canali.map((c) => c.id);
      if (!canaleIds.length) return new Set<string>();
      const { data } = await supabase
        .from("chat_messaggi_interni")
        .select("canale_id")
        .in("canale_id", canaleIds)
        .ilike("messaggio", `%${ricerca}%`)
        .limit(200);
      return new Set((data || []).map((r: { canale_id: string }) => r.canale_id));
    },
    enabled: !!ricerca && ricerca.length >= 2 && canali.length > 0,
  });

  const directCanaleIds = useMemo(
    () => canali.filter((c) => c.tipo === "diretto").map((c) => c.id),
    [canali]
  );

  const { data: directMembers } = useQuery({
    queryKey: ["chat_direct_members", directCanaleIds.join(",")],
    queryFn: async () => {
      if (!directCanaleIds.length) return {} as Record<string, string>;
      const { data } = await supabase
        .from("chat_canali_membri")
        .select("canale_id, user_id")
        .in("canale_id", directCanaleIds);
      const otherUserIds = Array.from(
        new Set(
          (data || [])
            .filter((m: { user_id: string }) => m.user_id !== userId)
            .map((m: { user_id: string }) => m.user_id)
        )
      );
      const canaleToUser: Record<string, string> = {};
      (data || []).forEach((m: { canale_id: string; user_id: string }) => {
        if (m.user_id !== userId) canaleToUser[m.canale_id] = m.user_id;
      });
      if (!otherUserIds.length) return canaleToUser;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .in("id", otherUserIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: { id: string; nome?: string; cognome?: string }) => {
        nameMap[p.id] = `${p.nome || ""} ${p.cognome || ""}`.trim() || "Utente";
      });
      const result: Record<string, string> = {};
      Object.entries(canaleToUser).forEach(([canaleId, uid]) => {
        result[canaleId] = nameMap[uid] || "Utente";
      });
      return result;
    },
    enabled: directCanaleIds.length > 0,
  });

  const entitaIds = useMemo(
    () =>
      canali
        .filter((c) => c.ambito === "contestuale" && c.entita_id && !c.nome)
        .reduce((acc: Record<string, string[]>, c) => {
          const tipo = c.entita_tipo || "unknown";
          if (!acc[tipo]) acc[tipo] = [];
          if (c.entita_id && !acc[tipo].includes(c.entita_id)) acc[tipo].push(c.entita_id);
          return acc;
        }, {}),
    [canali]
  );

  const { data: entitaNomi } = useQuery({
    queryKey: ["entita_nomi_sidebar", JSON.stringify(entitaIds)],
    queryFn: async () => {
      const result: Record<string, string> = {};

      if (entitaIds.cliente?.length) {
        const { data } = await supabase
          .from("clienti")
          .select("id, nome, cognome, ragione_sociale")
          .in("id", entitaIds.cliente);
        (data || []).forEach((c: { id: string; ragione_sociale?: string; cognome?: string; nome?: string }) => {
          result[c.id] = c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim();
        });
      }
      if (entitaIds.titolo?.length) {
        const { data } = await supabase
          .from("titoli")
          .select("id, numero_titolo, clienti:cliente_anagrafica_id(cognome, nome, ragione_sociale)")
          .in("id", entitaIds.titolo);
        (data || []).forEach((t: any) => {
          const cl = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          result[t.id] = `${t.numero_titolo || ""}${cl ? ` - ${cl}` : ""}`;
        });
      }
      if (entitaIds.trattativa?.length) {
        const { data } = await supabase
          .from("trattative")
          .select("id, prodotto, clienti:cliente_id(cognome, nome, ragione_sociale)")
          .in("id", entitaIds.trattativa);
        (data || []).forEach((t: any) => {
          const cl = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          result[t.id] = `${t.prodotto || "Trattativa"}${cl ? ` - ${cl}` : ""}`;
        });
      }
      if (entitaIds.sinistro?.length) {
        const { data } = await supabase
          .from("sinistri")
          .select("id, numero_sinistro, clienti:cliente_anagrafica_id(cognome, nome, ragione_sociale)")
          .in("id", entitaIds.sinistro);
        (data || []).forEach((s: any) => {
          const cl = s.clienti?.ragione_sociale || `${s.clienti?.cognome || ""} ${s.clienti?.nome || ""}`.trim();
          result[s.id] = `${s.numero_sinistro || ""}${cl ? ` - ${cl}` : ""}`;
        });
      }

      return result;
    },
    enabled: Object.keys(entitaIds).length > 0,
  });

  const getDisplayName = (canale: CanaleMeta): string => {
    if (canale.nome) return canale.nome;
    if (canale.ambito === "contestuale" && canale.entita_id && entitaNomi?.[canale.entita_id]) {
      return entitaNomi[canale.entita_id];
    }
    if (canale.tipo === "diretto" && directMembers?.[canale.id]) {
      return directMembers[canale.id];
    }
    return "Conversazione";
  };

  const canaliFiltrati = useMemo(() => {
    return canali.filter((c) => {
      if (filtroTipo !== "tutti") {
        if (ambito === "interno" && c.tipo !== filtroTipo) return false;
        if (ambito === "contestuale" && c.entita_tipo !== filtroTipo) return false;
      }
      if (ricerca) {
        const q = ricerca.toLowerCase();
        const nomeCanale = getDisplayName(c).toLowerCase();
        const msgMatch = matchingCanaliIds?.has(c.id);
        if (!nomeCanale.includes(q) && !msgMatch) return false;
      }
      return true;
    });
  }, [canali, filtroTipo, ambito, ricerca, matchingCanaliIds, entitaNomi, directMembers]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || ricerca) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, ricerca]);

  const filterOptions =
    ambito === "interno"
      ? ["tutti", "diretto", "gruppo", "broadcast"]
      : ["tutti", "cliente", "trattativa", "titolo", "sinistro", "argomento"];

  const filterLabels: Record<string, string> = {
    tutti: "Tutti",
    diretto: "Diretti",
    gruppo: "Gruppi",
    broadcast: "Broadcast",
    ...entitaLabels,
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="p-3 border-b border-border space-y-2">
        {showAmbitoToggle && onAmbitoChange && (
          <Tabs
            value={ambito}
            onValueChange={(v) => {
              onAmbitoChange(v as "interno" | "contestuale");
              setFiltroTipo("tutti");
            }}
          >
            <TabsList className="w-full h-8">
              <TabsTrigger value="interno" className="flex-1 text-xs">
                Interna
              </TabsTrigger>
              <TabsTrigger value="contestuale" className="flex-1 text-xs">
                Contestuale
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Button onClick={onNuovaConversazione} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nuova Conversazione
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca conversazioni o messaggi..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterOptions.map((t) => (
            <Badge
              key={t}
              variant={filtroTipo === t ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-2 py-0.5"
              onClick={() => setFiltroTipo(t)}
            >
              {filterLabels[t] || t}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {canaliFiltrati.map((canale) => {
            const Icon =
              ambito === "contestuale"
                ? entitaIcons[canale.entita_tipo || ""] || Users
                : tipoIcons[canale.tipo as keyof typeof tipoIcons] || Users;
            const displayName = getDisplayName(canale);
            const subtitle =
              ambito === "contestuale"
                ? entitaLabels[canale.entita_tipo || ""] || canale.entita_tipo
                : canale.tipo;
            const unread = Number(canale.unread_count) || 0;
            const isActive = canaleAttivoId === canale.id;
            const ts = canale.last_message_at || canale.created_at;
            const matchInMsg = ricerca && matchingCanaliIds?.has(canale.id);

            return (
              <button
                key={canale.id}
                onClick={() => onSelectCanale(canale.id)}
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-[13px]", unread > 0 && "font-semibold")}>{displayName}</p>
                    {ts && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(ts), { locale: it, addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {canale.last_message_preview && (
                    <p
                      className={cn(
                        "truncate text-[11px] mt-0.5",
                        unread > 0 ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {canale.last_message_preview.replace(/\[POLIZZA:[0-9a-f-]+\]/gi, "📎 polizza")}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {subtitle}
                      {matchInMsg && <span className="ml-1 text-primary">• match</span>}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ambito === "contestuale" && canale.visibile_cliente && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          👤
                        </Badge>
                      )}
                      {unread > 0 && (
                        <Badge variant="default" className="h-4 min-w-[16px] rounded-full px-1 text-[9px]">
                          {unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {!canaliFiltrati.length && (
            <p className="text-center text-xs text-muted-foreground py-6">
              {ricerca ? "Nessun risultato" : "Nessun canale — crea una nuova conversazione"}
            </p>
          )}
          {!ricerca && hasNextPage && (
            <div ref={sentinelRef} className="py-3 flex items-center justify-center">
              {isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
