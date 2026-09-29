import { Globe, BookOpen, ShieldCheck, Bookmark, Lightbulb, Files } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistenteWebChatPanel from "@/components/documentale/AssistenteWebChatPanel";
import LibreriaCgaChatPanel from "@/components/documentale/LibreriaCgaChatPanel";
import CbBotSitiAutorizzatiPanel from "@/components/documentale/CbBotSitiAutorizzatiPanel";
import CbBotFontiSalvatePanel from "@/components/documentale/CbBotFontiSalvatePanel";
import CbBotKnowHowPanel from "@/components/documentale/CbBotKnowHowPanel";
import CbBotDocumentiPanel from "@/components/documentale/CbBotDocumentiPanel";
import CbBotLogo from "@/components/shared/CbBotLogo";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  consultazioneMode?: boolean;
};

export default function AssistenteGaranzieSection({ consultazioneMode = false }: Props) {
  const { isAdmin } = useAuth();
  const showSitiTab = !consultazioneMode && isAdmin;
  const showFontiTab = !consultazioneMode;
  const showKnowHowTab = !consultazioneMode;
  const showDocumentiTab = true;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CbBotLogo className="h-10 w-auto shrink-0" />
        <div>
          <h2 className="text-lg font-semibold sr-only">CB Bot</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            <strong>Assistente Web</strong> — cerca solo sui siti autorizzati dall&apos;admin.
            {" "}
            <strong>Libreria CGA</strong> — garanzie, massimali ed esclusioni dal catalogo CBnet.
            {showSitiTab && (
              <>
                {" "}
                <strong>Siti autorizzati</strong> — elenco dei portali che il bot può interrogare.
              </>
            )}
            {showFontiTab && (
              <>
                {" "}
                <strong>Fonti salvate</strong> — pagine pinate che il bot riusa come fonti interne.
              </>
            )}
            {showDocumentiTab && (
              <>
                {" "}
                <strong>Documenti</strong> — carica, analizza, salva in libreria e confronta più file.
              </>
            )}
            {consultazioneMode
              ? " Salva le ricerche per non perderle; azzera la cronologia quando vuoi. I documenti restano solo sulla tua email."
              : " Il segnalibro salva la ricerca; la stella la promuove in know-how."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="assistente-web" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="assistente-web" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Assistente Web
          </TabsTrigger>
          <TabsTrigger value="libreria-cga" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Libreria CGA
          </TabsTrigger>
          {showSitiTab && (
            <TabsTrigger value="siti-autorizzati" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Siti autorizzati
            </TabsTrigger>
          )}
          {showFontiTab && (
            <TabsTrigger value="fonti-salvate" className="gap-1.5">
              <Bookmark className="h-3.5 w-3.5" /> Fonti salvate
            </TabsTrigger>
          )}
          {showKnowHowTab && (
            <TabsTrigger value="know-how" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Know-how
            </TabsTrigger>
          )}
          {showDocumentiTab && (
            <TabsTrigger value="documenti" className="gap-1.5">
              <Files className="h-3.5 w-3.5" /> Documenti
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="assistente-web" className="mt-4">
          <AssistenteWebChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        <TabsContent value="libreria-cga" className="mt-4">
          <LibreriaCgaChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        {showSitiTab && (
          <TabsContent value="siti-autorizzati" className="mt-4">
            <CbBotSitiAutorizzatiPanel />
          </TabsContent>
        )}
        {showFontiTab && (
          <TabsContent value="fonti-salvate" className="mt-4">
            <CbBotFontiSalvatePanel />
          </TabsContent>
        )}
        {showKnowHowTab && (
          <TabsContent value="know-how" className="mt-4">
            <CbBotKnowHowPanel />
          </TabsContent>
        )}
        {showDocumentiTab && (
          <TabsContent value="documenti" className="mt-4">
            <CbBotDocumentiPanel consultazioneMode={consultazioneMode} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
