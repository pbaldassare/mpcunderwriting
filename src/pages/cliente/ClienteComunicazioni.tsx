import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatArea from "@/components/chat/ChatArea";
import CanaleContextHeader from "@/components/cliente/CanaleContextHeader";
import NuovaChatClienteDialog from "@/components/cliente/NuovaChatClienteDialog";
import PolizzeLinkPicker from "@/components/cliente/PolizzeLinkPicker";
import MessaggioConChip from "@/components/cliente/MessaggioConChip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Briefcase, AlertTriangle, Plus, Search, Loader2, Download } from "lucide-react";
import { exportChatToPdf } from "@/lib/chat-pdf";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const entitaIcons: Record<string, typeof FileText> = {
  cliente: MessageSquare,
  trattativa: Briefcase,
  titolo: FileText,
  sinistro: AlertTriangle,
  argomento: MessageSquare,
};

const entitaLabels: Record<string, string> = {
  cliente: "Generale",
  trattativa: "Trattativa",
  titolo: "Polizza",
  sinistro: "Sinistro",
  argomento: "Argomento",
};

interface CanaleMeta {
  id: string;
  nome: string | null;
  entita_tipo: string;
  entita_id: string | null;
  ambito: string;
  visibile_cliente: boolean;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

const ClienteComunicazioni = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [canaleAttivoId, setCanaleAttivoId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: clienteIds } = useQuery({
    queryKey: ["my_cliente_ids_chat", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_cliente_ids");
      const arr: any[] = data || [];
      return arr.map((x) => (typeof x === "string" ? x : x.get_my_cliente_ids ?? x.id ?? x)).filter(Boolean) as string[];
    },
    enabled: !!user?.id,
  });

  // Canali con metadati (paginato)
  const { data: pages, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["chat_canali_cliente_meta", user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase.rpc("get_canali_cliente_with_meta", {
        _user_id: user!.id,
        _limit: PAGE_SIZE,
        _offset: pageParam,
      });
      if (error) throw error;
      return (data || []) as CanaleMeta[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const canali: CanaleMeta[] = useMemo(() => (pages?.pages || []).flat(), [pages]);

  // Search nei messaggi
  const { data: matchingCanaliIds } = useQuery({
    queryKey: ["chat_search_msg_cliente", search],
    queryFn: async () => {
      if (!search || search.length < 2) return new Set<string>();
      const { data } = await supabase
        .from("chat_messaggi_interni")
        .select("canale_id")
        .ilike("messaggio", `%${search}%`)
        .limit(200);
      return new Set((data || []).map((r: any) => r.canale_id));
    },
    enabled: !!search && search.length >= 2,
  });

  const canaliFiltrati = useMemo(() => {
    if (!search) return canali;
    const q = search.toLowerCase();
    return canali.filter((c) => {
      const nameMatch = (c.nome || "").toLowerCase().includes(q) ||
        (entitaLabels[c.entita_tipo] || "").toLowerCase().includes(q);
      const msgMatch = matchingCanaliIds?.has(c.id);
      return nameMatch || msgMatch;
    });
  }, [canali, search, matchingCanaliIds]);

  const totalUnread = useMemo(
    () => canali.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0),
    [canali]
  );

  // Infinite scroll trigger
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || search) return; // disable load-more in search mode
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, search]);

  // Canale attivo (per decidere se mostrare PolizzeLinkPicker)
  const canaleAttivo = canali.find((c) => c.id === canaleAttivoId);
  const showPolizzePicker =
    !!canaleAttivo &&
    (canaleAttivo.entita_tipo === "argomento" || canaleAttivo.entita_tipo === "cliente");

  const handlePickPolizza = async (t: any) => {
    if (!canaleAttivoId || !profile?.id) return;
    const marker = `[POLIZZA:${t.id}]`;
    const { error } = await supabase.from("chat_messaggi_interni").insert({
      canale_id: canaleAttivoId,
      mittente_id: profile.id,
      messaggio: `📎 Riferimento: ${marker}`,
    });
    if (error) {
      toast.error("Errore collegamento polizza");
      return;
    }
    qc.invalidateQueries({ queryKey: ["chat_messaggi_interni", canaleAttivoId] });
    qc.invalidateQueries({ queryKey: ["chat_canali_cliente_meta", user?.id] });
    toast.success("Polizza collegata alla conversazione");
  };

  const handleExportPdf = async () => {
    if (!canaleAttivoId) return;
    try {
      toast.loading("Generazione PDF...", { id: "chat-pdf" });
      const { data: canale } = await supabase
        .from("chat_canali")
        .select("id, nome, entita_tipo, entita_id, created_at")
        .eq("id", canaleAttivoId)
        .maybeSingle();
      if (!canale) throw new Error("Canale non trovato");

      const { data: msgs } = await supabase
        .from("chat_messaggi_interni")
        .select("id, created_at, messaggio, mittente_id, profiles:mittente_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleAttivoId)
        .order("created_at", { ascending: true });

      const { data: mems } = await supabase
        .from("chat_canali_membri")
        .select("user_id, profiles:user_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleAttivoId);

      let entitaLabel: string | null = null;
      let entitaNumero: string | null = null;
      let statoLabel: string | null = null;
      if (canale.entita_tipo === "titolo" && canale.entita_id) {
        const { data: t } = await supabase
          .from("titoli").select("numero_titolo").eq("id", canale.entita_id).maybeSingle();
        entitaLabel = "Polizza";
        entitaNumero = (t as any)?.numero_titolo || null;
      } else if (canale.entita_tipo === "sinistro" && canale.entita_id) {
        const { data: s } = await supabase
          .from("sinistri").select("numero_sinistro, stato").eq("id", canale.entita_id).maybeSingle();
        entitaLabel = "Sinistro";
        entitaNumero = (s as any)?.numero_sinistro || null;
        statoLabel = (s as any)?.stato || null;
      } else if (canale.entita_tipo === "argomento") {
        entitaLabel = "Argomento";
      } else if (canale.entita_tipo === "cliente") {
        entitaLabel = "Generale";
      }

      const clienteNome = `${profile?.nome || ""} ${profile?.cognome || ""}`.trim() || "Cliente";

      // Build log: created + messages timeline summary
      const log: { data: string; evento: string; attore?: string | null }[] = [];
      log.push({ data: canale.created_at as string, evento: "Conversazione creata" });
      for (const m of (msgs || [])) {
        const p: any = (m as any).profiles;
        const who = p ? `${p.nome || ""} ${p.cognome || ""}`.trim() : "";
        log.push({
          data: m.created_at as string,
          evento: "Messaggio inviato",
          attore: who || null,
        });
      }

      await exportChatToPdf({
        canaleNome: canale.nome || entitaLabel || "Conversazione",
        canaleTipo: canale.entita_tipo,
        entitaLabel,
        entitaNumero,
        statoLabel,
        createdAt: canale.created_at,
        clienteNome,
        membri: (mems || []).map((x: any) => ({
          nome: x.profiles?.nome, cognome: x.profiles?.cognome, ruolo: x.profiles?.ruolo,
        })),
        messaggi: (msgs || []).map((m: any) => ({
          id: m.id,
          created_at: m.created_at,
          messaggio: m.messaggio || "",
          mittente_nome: m.profiles?.nome,
          mittente_cognome: m.profiles?.cognome,
          mittente_ruolo: m.profiles?.ruolo,
          is_self: m.mittente_id === profile?.id,
        })),
        log,
      });
      toast.success("PDF generato", { id: "chat-pdf" });
    } catch (e: any) {
      console.error(e);
      toast.error("Errore generazione PDF: " + (e?.message || ""), { id: "chat-pdf" });
    }
  };

  return (
    <div data-tour="cl-chat-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Chat
          {totalUnread > 0 && (
            <Badge variant="default" className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-[10px]">
              {totalUnread}
            </Badge>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            data-tour="cl-chat-export"
            variant="outline"
            onClick={handleExportPdf}
            disabled={!canaleAttivoId}
            className="gap-2"
            title={canaleAttivoId ? "Esporta la conversazione in PDF" : "Seleziona una conversazione"}
          >
            <Download className="h-4 w-4" /> Esporta PDF
          </Button>
          <Button data-tour="cl-chat-new" onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuova conversazione
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-14rem)] border rounded-lg overflow-hidden">
        {/* Sidebar canali */}
        <div className="w-80 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Le tue conversazioni
            </p>
            <div data-tour="cl-chat-search" className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca conversazioni o messaggi..."
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {canaliFiltrati.map((c) => {
                const Icon = entitaIcons[c.entita_tipo] || MessageSquare;
                const label = c.nome || entitaLabels[c.entita_tipo] || "Chat";
                const matchInMsg = search && matchingCanaliIds?.has(c.id);
                const unread = Number(c.unread_count) || 0;
                const isActive = canaleAttivoId === c.id;
                const ts = c.last_message_at || c.created_at;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCanaleAttivoId(c.id)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-[13px]", unread > 0 ? "font-semibold" : "font-normal")}>
                          {label}
                        </p>
                        {ts && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(ts), { locale: it, addSuffix: false })}
                          </span>
                        )}
                      </div>
                      {c.last_message_preview && (
                        <p className={cn(
                          "truncate text-[11px] mt-0.5",
                          unread > 0 ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {c.last_message_preview.replace(/\[POLIZZA:[0-9a-f-]+\]/gi, "📎 polizza")}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {entitaLabels[c.entita_tipo] || c.entita_tipo}
                          {matchInMsg && <span className="ml-1 text-primary">• match</span>}
                        </span>
                        {unread > 0 && (
                          <Badge variant="default" className="h-4 min-w-[16px] rounded-full px-1 text-[9px]">
                            {unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!canaliFiltrati.length && (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {search ? "Nessun risultato" : "Nessuna conversazione attiva"}
                </p>
              )}
              {!search && hasNextPage && (
                <div ref={sentinelRef} className="py-3 flex items-center justify-center">
                  {isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Area chat */}
        <ChatArea
          canaleId={canaleAttivoId}
          headerSlot={canaleAttivoId ? <CanaleContextHeader canaleId={canaleAttivoId} /> : undefined}
          aboveMessages={
            showPolizzePicker && clienteIds?.length ? (
              <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Aggiungi riferimento:</span>
                <PolizzeLinkPicker clienteIds={clienteIds} onPick={handlePickPolizza} />
              </div>
            ) : undefined
          }
          renderMessage={(text) => <MessaggioConChip text={text} />}
        />
      </div>

      <NuovaChatClienteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setCanaleAttivoId(id);
          qc.invalidateQueries({ queryKey: ["chat_canali_cliente_meta", user?.id] });
        }}
      />
    </div>
  );
};

export default ClienteComunicazioni;
