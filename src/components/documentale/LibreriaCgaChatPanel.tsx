import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GaranzieChatLayout } from "@/components/documentale/GaranzieChatLayout";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { useGaranzieChat } from "@/hooks/useGaranzieChat";
import { useLibreriaCga } from "@/hooks/useLibreriaCga";

const SUGGERIMENTI = [
  "Quali massimali RC professionale?",
  "Esclusioni danni da amianto",
  "Differenza franchigia assoluta e relativa",
  "Cosa copre la garanzia cyber?",
  "Definizione di sinistro in itinere",
  "Confronto copertura furto tra prodotti",
];

type Props = {
  consultazioneMode?: boolean;
};

export default function LibreriaCgaChatPanel({ consultazioneMode = false }: Props) {
  const { email: consultazioneEmail } = useConsultazione();
  const { data: libreria = [] } = useLibreriaCga();

  const [filtroCompagnia, setFiltroCompagnia] = useState<string>("__all__");
  const [filtroRamo, setFiltroRamo] = useState<string>("__all__");
  const [filtroProdotto, setFiltroProdotto] = useState<string>("__all__");

  const compagnie = useMemo(
    () => Array.from(new Set(libreria.map((r) => r.compagnia).filter(Boolean) as string[])).sort(),
    [libreria],
  );
  const rami = useMemo(
    () => Array.from(new Set(libreria.map((r) => r.ramo).filter(Boolean) as string[])).sort(),
    [libreria],
  );
  const prodottiFiltrati = useMemo(() => {
    return libreria.filter((r) => {
      if (filtroCompagnia !== "__all__" && r.compagnia !== filtroCompagnia) return false;
      if (filtroRamo !== "__all__" && r.ramo !== filtroRamo) return false;
      return true;
    });
  }, [libreria, filtroCompagnia, filtroRamo]);

  const filtriBody = useMemo(
    () => ({
      compagnia: filtroCompagnia !== "__all__" ? filtroCompagnia : undefined,
      ramo: filtroRamo !== "__all__" ? filtroRamo : undefined,
      prodotto_cga_id: filtroProdotto !== "__all__" ? filtroProdotto : undefined,
    }),
    [filtroCompagnia, filtroRamo, filtroProdotto],
  );

  const chat = useGaranzieChat({
    tipo: "cga",
    edgeFunction: "chiedi-libreria-cga",
    consultazioneMode,
    consultazioneEmail,
    hideTeam: consultazioneMode,
    extraBody: () => filtriBody,
    convExtraFields: () => ({
      compagnia: filtriBody.compagnia ?? null,
      ramo: filtriBody.ramo ?? null,
      prodotto_cga_id: filtriBody.prodotto_cga_id ?? null,
    }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/30">
        <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
          <SelectTrigger className="h-9 bg-background">
            <SelectValue placeholder="Compagnia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutte le compagnie</SelectItem>
            {compagnie.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroRamo} onValueChange={setFiltroRamo}>
          <SelectTrigger className="h-9 bg-background">
            <SelectValue placeholder="Ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i rami</SelectItem>
            {rami.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroProdotto} onValueChange={setFiltroProdotto}>
          <SelectTrigger className="h-9 bg-background">
            <SelectValue placeholder="Prodotto CGA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i prodotti (filtrati)</SelectItem>
            {prodottiFiltrati.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome_prodotto}{p.compagnia ? ` · ${p.compagnia}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <GaranzieChatLayout
        canPersist={chat.canPersist}
        sidebarTab={chat.sidebarTab}
        setSidebarTab={chat.setSidebarTab}
        sidebarList={chat.sidebarList}
        activeId={chat.activeId}
        onSelectConv={(id) => {
          chat.setActiveId(id);
          chat.setEphemeralMessages([]);
        }}
        resetChat={chat.resetChat}
        shareMutation={chat.shareMutation}
        deleteMutation={chat.deleteMutation}
        messages={chat.messages}
        isThinking={chat.isThinking}
        scrollRef={chat.scrollRef}
        isSharedReadOnly={chat.isSharedReadOnly}
        sendMessage={chat.sendMessage}
        suggestions={SUGGERIMENTI}
        emptyIcon={<BookOpen className="h-10 w-10 mb-3 opacity-40" />}
        emptyTitle="Chiedi su garanzie e condizioni assicurative"
        emptyDescription="Le risposte usano solo i dati estratti dalla Libreria CGA, con citazione compagnia e prodotto."
        thinkingLabel="CB Bot sta analizzando la Libreria CGA…"
        convSubtitle={(c) => c.compagnia || "—"}
        formatConvDate={chat.formatConvDate}
        hideTeam={consultazioneMode}
        evidenzaMutation={chat.evidenzaMutation}
        salvaMutation={chat.salvaMutation}
        clearHistoryMutation={chat.clearHistoryMutation}
        filtroRicerche={chat.filtroRicerche}
        setFiltroRicerche={chat.setFiltroRicerche}
        cronologiaDaAzzerare={chat.cronologiaDaAzzerare}
        activeSalvata={chat.activeConv?.salvata === true}
      />
    </div>
  );
}
