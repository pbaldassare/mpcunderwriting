import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CanaliSidebar from "@/components/chat/CanaliSidebar";
import ChatArea, { ChatEmptyState } from "@/components/chat/ChatArea";
import StaffCanaleContextHeader from "@/components/chat/StaffCanaleContextHeader";
import NuovaConversazioneDialog from "@/components/chat/NuovaConversazioneDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ComunicazioniPage() {
  const { profile } = useAuth();
  const [canaleAttivoId, setCanaleAttivoId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ambito, setAmbito] = useState<"interno" | "contestuale">("interno");

  const { data: canaleAttivo } = useQuery({
    queryKey: ["chat_canale_ambito", canaleAttivoId],
    queryFn: async () => {
      if (!canaleAttivoId) return null;
      const { data } = await supabase
        .from("chat_canali")
        .select("id, ambito")
        .eq("id", canaleAttivoId)
        .maybeSingle();
      return data;
    },
    enabled: !!canaleAttivoId,
  });

  if (!profile) return null;

  const isContestuale = canaleAttivo?.ambito === "contestuale";

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className="w-72 shrink-0">
        <CanaliSidebar
          canaleAttivoId={canaleAttivoId}
          onSelectCanale={setCanaleAttivoId}
          onNuovaConversazione={() => setDialogOpen(true)}
          userId={profile.id}
          ambito={ambito}
          onAmbitoChange={(a) => {
            setAmbito(a);
            setCanaleAttivoId(null);
          }}
          showAmbitoToggle={true}
        />
      </div>

      <ChatArea
        canaleId={canaleAttivoId}
        showExportPdf={!!canaleAttivoId}
        headerSlot={
          canaleAttivoId && isContestuale ? (
            <StaffCanaleContextHeader canaleId={canaleAttivoId} />
          ) : undefined
        }
        emptyState={<ChatEmptyState onNuovaConversazione={() => setDialogOpen(true)} />}
      />

      <NuovaConversazioneDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ambito={ambito}
        onCreated={(id) => {
          setCanaleAttivoId(id);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
