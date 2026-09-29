import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  azzeraCronologiaConsultazione,
  createConsultazione,
  deleteConsultazione,
  insertMsgConsultazione,
  listMessagesConsultazione,
  listMieConsultazione,
  salvaConsultazione,
  shareConsultazione,
  touchConsultazione,
} from "@/lib/garanzieChatConsultazione";
import { countCronologiaDaAzzerare, filterRicerche, type FiltroRicerche } from "@/lib/cbBotRicerche";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { AiMessage } from "@/components/ai/AiChatMessage";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export type ChatTipo = "web" | "cga";

export type GaranzieConv = {
  id: string;
  titolo: string;
  condivisa: boolean;
  condivisa_at: string | null;
  compagnia: string | null;
  ramo: string | null;
  tipo: string;
  updated_at: string;
  autore_email: string | null;
  in_evidenza?: boolean;
  in_evidenza_at?: string | null;
  salvata?: boolean;
  salvata_at?: string | null;
};

export type GaranzieMsg = {
  id: string;
  role: string;
  content: string;
  fonti: unknown;
  created_at: string;
};

type SidebarTab = "mie" | "condivise";

type UseGaranzieChatOptions = {
  tipo: ChatTipo;
  edgeFunction: "chiedi-mercato-assicurativo" | "chiedi-libreria-cga";
  consultazioneMode?: boolean;
  consultazioneEmail?: string | null;
  hideTeam?: boolean;
  extraBody?: () => Record<string, unknown>;
  convExtraFields?: () => Record<string, unknown>;
  onBeforeSend?: (text: string) => void;
};

export function useGaranzieChat({
  tipo,
  edgeFunction,
  consultazioneMode = false,
  consultazioneEmail = null,
  hideTeam = false,
  extraBody,
  convExtraFields,
  onBeforeSend,
}: UseGaranzieChatOptions) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const isConsultazionePersist = consultazioneMode && !!consultazioneEmail && !user;
  const canPersist = (!!user && !consultazioneMode) || isConsultazionePersist;

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("mie");
  const [filtroRicerche, setFiltroRicerche] = useState<FiltroRicerche>("tutte");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ephemeralMessages, setEphemeralMessages] = useState<AiMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryKeyBase = ["garanzie-chat", tipo, isConsultazionePersist ? consultazioneEmail : user?.id];

  const { data: mieConversazioni = [] } = useQuery({
    queryKey: [...queryKeyBase, "mie"],
    enabled: canPersist,
    queryFn: async () => {
      if (isConsultazionePersist) {
        return listMieConsultazione(consultazioneEmail!, tipo);
      }
      const { data, error } = await supabase
        .from("garanzie_chat_conversazioni")
        .select("id, titolo, condivisa, condivisa_at, compagnia, ramo, tipo, updated_at, autore_email, in_evidenza, in_evidenza_at, salvata, salvata_at" as never)
        .eq("user_id", user!.id)
        .eq("tipo", tipo)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GaranzieConv[];
    },
  });

  const { data: condivise = [] } = useQuery({
    queryKey: [...queryKeyBase, "condivise"],
    enabled: !hideTeam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garanzie_chat_conversazioni")
        .select("id, titolo, condivisa, condivisa_at, compagnia, ramo, tipo, updated_at, autore_email, in_evidenza, in_evidenza_at, salvata, salvata_at" as never)
        .eq("condivisa", true)
        .eq("tipo", tipo)
        .order("condivisa_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as GaranzieConv[];
    },
  });

  const sidebarSource = hideTeam || sidebarTab === "mie" ? mieConversazioni : condivise;
  const sidebarList = filterRicerche(sidebarSource, sidebarTab === "mie" || hideTeam ? filtroRicerche : "tutte");

  const { data: dbMessages = [] } = useQuery({
    queryKey: [...queryKeyBase, "messages", activeId, sidebarTab],
    enabled: !!activeId,
    queryFn: async () => {
      if (isConsultazionePersist && sidebarTab === "mie") {
        return listMessagesConsultazione(consultazioneEmail!, activeId!);
      }
      const { data, error } = await supabase
        .from("garanzie_chat_messaggi")
        .select("id, role, content, fonti, created_at")
        .eq("conversazione_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GaranzieMsg[];
    },
  });

  const persistedMessages: AiMessage[] = activeId
    ? dbMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          fonti: Array.isArray(m.fonti) ? m.fonti : undefined,
        }))
    : [];

  const messages: AiMessage[] = activeId ? persistedMessages : ephemeralMessages;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isThinking]);

  const resetChat = useCallback(() => {
    setActiveId(null);
    setEphemeralMessages([]);
  }, []);

  const shareMutation = useMutation({
    mutationFn: async (convId: string) => {
      if (isConsultazionePersist) {
        await shareConsultazione(consultazioneEmail!, convId);
        return;
      }
      const { error } = await supabase
        .from("garanzie_chat_conversazioni")
        .update({ condivisa: true, condivisa_at: new Date().toISOString() })
        .eq("id", convId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ricerca condivisa con il team");
      qc.invalidateQueries({ queryKey: queryKeyBase });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const evidenzaMutation = useMutation({
    mutationFn: async ({ id, inEvidenza }: { id: string; inEvidenza: boolean }) => {
      if (isConsultazionePersist) {
        if (!inEvidenza) return;
        const { promoteKnowHowConsultazione } = await import("@/lib/cbBotKnowHowDb");
        const n = await promoteKnowHowConsultazione(consultazioneEmail!, id, tipo);
        toast.success(
          n > 0
            ? `Know-how salvato (${n} rispost${n === 1 ? "a" : "e"}). Le prossime domande uguali non bruciano IA.`
            : "Nessuna risposta da salvare come know-how",
        );
        return;
      }
      const { error } = await supabase
        .from("garanzie_chat_conversazioni")
        .update({
          in_evidenza: inEvidenza,
          in_evidenza_at: inEvidenza ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      if (inEvidenza) {
        const { promoteFontiFromConversazione } = await import("@/lib/cbBotFontiDb");
        const { promoteKnowHowFromConversazione } = await import("@/lib/cbBotKnowHowDb");
        const nFonti = await promoteFontiFromConversazione(id, user?.id ?? null);
        const nKh = await promoteKnowHowFromConversazione(id, tipo, user?.id ?? null);
        toast.success(
          nKh > 0
            ? `Know-how salvato (${nKh}) · ${nFonti} fonti in libreria`
            : nFonti > 0
              ? `Ricerca in evidenza · ${nFonti} fonti in libreria`
              : "Ricerca in evidenza",
        );
      } else {
        toast.success("Rimossa dall'evidenza (know-how e fonti restano)");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeyBase });
      qc.invalidateQueries({ queryKey: ["cb-bot-fonti"] });
      qc.invalidateQueries({ queryKey: ["cb-bot-know-how"] });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile aggiornare l'evidenza"),
  });

  const salvaMutation = useMutation({
    mutationFn: async ({ id, salvata }: { id: string; salvata: boolean }) => {
      if (isConsultazionePersist) {
        await salvaConsultazione(consultazioneEmail!, id, salvata);
        return;
      }
      const { error } = await supabase
        .from("garanzie_chat_conversazioni")
        .update({
          salvata,
          salvata_at: salvata ? new Date().toISOString() : null,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { salvata }) => {
      toast.success(salvata ? "Ricerca salvata in archivio" : "Ricerca tolta dai salvati");
      qc.invalidateQueries({ queryKey: queryKeyBase });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile salvare la ricerca"),
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      if (isConsultazionePersist) {
        return azzeraCronologiaConsultazione(consultazioneEmail!, tipo);
      }
      const daAzzerare = countCronologiaDaAzzerare(mieConversazioni);
      if (daAzzerare === 0) return 0;
      const { error } = await (supabase.from("garanzie_chat_conversazioni") as any)
        .delete()
        .eq("user_id", user!.id)
        .eq("tipo", tipo)
        .eq("salvata", false);
      if (error) throw error;
      return daAzzerare;
    },
    onSuccess: (n) => {
      if (n === 0) {
        toast.success("Nessuna ricerca da azzerare (le salvate restano)");
      } else {
        toast.success(`Cronologia azzerata (${n} ricerc${n === 1 ? "a" : "he"}). Le salvate restano.`);
      }
      const attiva = mieConversazioni.find((c) => c.id === activeId);
      if (attiva && !attiva.salvata) resetChat();
      qc.invalidateQueries({ queryKey: queryKeyBase });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile azzerare la cronologia"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (convId: string) => {
      if (isConsultazionePersist) {
        await deleteConsultazione(consultazioneEmail!, convId);
        return;
      }
      const { error } = await supabase.from("garanzie_chat_conversazioni").delete().eq("id", convId);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeyBase });
      if (activeId === id) resetChat();
    },
  });

  const sendMessage = async (text: string) => {
    if (isThinking) return;

    onBeforeSend?.(text);
    setIsThinking(true);

    let convId = activeId;
    let isFirst = false;
    const extra = convExtraFields?.() ?? {};

    if (canPersist && !convId) {
      try {
        if (isConsultazionePersist) {
          convId = await createConsultazione(consultazioneEmail!, tipo, text.slice(0, 80), {
            compagnia: (extra.compagnia as string | null) ?? null,
            ramo: (extra.ramo as string | null) ?? null,
            prodotto_cga_id: (extra.prodotto_cga_id as string | null) ?? null,
          });
        } else {
          const { data, error } = await supabase
            .from("garanzie_chat_conversazioni")
            .insert({
              user_id: user!.id,
              autore_email: profile?.email ?? user!.email ?? null,
              titolo: text.slice(0, 80),
              tipo,
              ...extra,
            })
            .select("id")
            .single();
          if (error) throw error;
          convId = data.id;
        }
        setActiveId(convId);
        isFirst = true;
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "mie"] });
      } catch {
        toast.error("Impossibile creare la conversazione");
        setIsThinking(false);
        return;
      }
    }

    const userMsg: AiMessage = { role: "user", content: text };
    if (convId) {
      try {
        if (isConsultazionePersist) {
          await insertMsgConsultazione(consultazioneEmail!, convId, "user", text);
        } else {
          const { error } = await supabase.from("garanzie_chat_messaggi").insert({
            conversazione_id: convId,
            role: "user",
            content: text,
          });
          if (error) throw error;
        }
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "messages", convId] });
      } catch {
        toast.error("Impossibile salvare il messaggio");
        setIsThinking(false);
        return;
      }
    } else {
      setEphemeralMessages((prev) => [...prev, userMsg]);
    }

    const storico = messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content }));

    try {
      const invokePromise = supabase.functions.invoke(edgeFunction, {
        body: { domanda: text, storico: storico.slice(0, -1), ...(extraBody?.() ?? {}) },
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Timeout: l'assistente web ha impiegato troppo. Riprova tra poco.")),
          75_000,
        );
      });
      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      const fnError = edgeFunctionErrorMessage(data, error);
      if (fnError) throw new Error(fnError);

      const assistantContent = data?.risposta ?? "";
      const webFonti = Array.isArray(data?.fonti) ? data.fonti : [];
      const savedFonti = Array.isArray(data?.fonti_salvate)
        ? data.fonti_salvate.map((f: { title?: string; url?: string; snippet?: string }) => ({
            ...f,
            salvata: true,
          }))
        : [];
      const fonti = [...savedFonti, ...webFonti];

      if (convId) {
        if (isConsultazionePersist) {
          await insertMsgConsultazione(consultazioneEmail!, convId, "assistant", assistantContent, fonti);
          await touchConsultazione(consultazioneEmail!, convId, isFirst ? text.slice(0, 80) : undefined);
        } else {
          await supabase.from("garanzie_chat_messaggi").insert({
            conversazione_id: convId,
            role: "assistant",
            content: assistantContent,
            fonti,
          });
          const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (isFirst) updatePayload.titolo = text.slice(0, 80);
          await supabase.from("garanzie_chat_conversazioni").update(updatePayload).eq("id", convId);
        }
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "messages", convId] });
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "mie"] });
      } else {
        setEphemeralMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent, fonti },
        ]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ricerca non riuscita";
      toast.error(msg);
      const assistantError =
        "Non sono riuscito a completare la ricerca.\n\n" + msg;
      if (convId) {
        try {
          if (isConsultazionePersist) {
            await insertMsgConsultazione(consultazioneEmail!, convId, "assistant", assistantError);
          } else {
            await supabase.from("garanzie_chat_messaggi").insert({
              conversazione_id: convId,
              role: "assistant",
              content: assistantError,
            });
          }
          qc.invalidateQueries({ queryKey: [...queryKeyBase, "messages", convId] });
        } catch {
          // il toast resta l'unico feedback
        }
      } else {
        setEphemeralMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantError },
        ]);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const isSharedReadOnly = !hideTeam && !!activeId && sidebarTab === "condivise";

  const formatConvDate = (c: GaranzieConv) =>
    c.condivisa_at ? format(new Date(c.condivisa_at), "dd/MM/yy", { locale: it }) : null;

  const cronologiaDaAzzerare = countCronologiaDaAzzerare(mieConversazioni);
  const activeConv = sidebarSource.find((c) => c.id === activeId) ?? mieConversazioni.find((c) => c.id === activeId);

  return {
    canPersist,
    hideTeam,
    sidebarTab,
    setSidebarTab,
    filtroRicerche,
    setFiltroRicerche,
    cronologiaDaAzzerare,
    activeConv,
    activeId,
    setActiveId,
    ephemeralMessages,
    setEphemeralMessages,
    isThinking,
    scrollRef,
    sidebarList,
    messages,
    resetChat,
    shareMutation,
    deleteMutation,
    evidenzaMutation,
    salvaMutation,
    clearHistoryMutation,
    sendMessage,
    isSharedReadOnly,
    formatConvDate,
  };
}
