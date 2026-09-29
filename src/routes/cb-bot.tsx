import { Navigate, Route, useLocation } from "react-router-dom";
import { Globe, BookOpen, Mail, ScrollText } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import CbBotPage from "@/pages/cb-bot/CbBotPage";
import CbBotSectionPage from "@/pages/cb-bot/CbBotSectionPage";
import CbBotFontiSitiPage from "@/pages/cb-bot/CbBotFontiSitiPage";
import CbBotRicerchePage from "@/pages/cb-bot/CbBotRicerchePage";
import { CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS } from "@/lib/consultazioneSession";
import { MPC_BOT_PATH, mpcBotPath } from "@/lib/mpcBotPaths";

function LegacyCbBotRedirect() {
  const { pathname, search, hash } = useLocation();
  const next = pathname.replace(/^\/cb-bot(?=\/|$)/, MPC_BOT_PATH) + search + hash;
  return <Navigate to={next} replace />;
}

export const cbBotRoutes = (
  <>
    <Route path="/cb-bot" element={<Navigate to={MPC_BOT_PATH} replace />} />
    <Route path="/cb-bot/*" element={<LegacyCbBotRedirect />} />
    <Route
      path={MPC_BOT_PATH}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotPage />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("assistente-web")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotSectionPage
            title="Assistente Web"
            description="Chat di consultazione: cerca sul web, non legge polizze o portafoglio MPCUnderwriting. Prompt oggi in chiedi-mercato-assicurativo."
            icon={Globe}
          />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("fonti-siti")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotFontiSitiPage />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("libreria-cga")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotSectionPage
            title="Libreria CGA"
            description="Catalogo condiviso: PDF CGA → parse-cga → prodotti_cga. Il carico oggi parte dal dettaglio polizza."
            icon={BookOpen}
          />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("accessi")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotSectionPage
            title="Accesso consultazione"
            description="Domini email autorizzati (oggi in codice, non ancora modificabili da qui)."
            icon={Mail}
            extra={
              <ul className="rounded-xl border border-border bg-card p-6 text-sm space-y-1.5">
                {CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS.map((d) => (
                  <li key={d} className="font-mono text-foreground">
                    @{d}
                  </li>
                ))}
              </ul>
            }
          />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("istruzioni")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotSectionPage
            title="Istruzioni / comandi"
            description="Spazio per i prompt del bot. Ancora da definire: oggi le regole sono nelle edge function."
            icon={ScrollText}
          />
        </RoleGuard>
      }
    />
    <Route
      path={mpcBotPath("ricerche")}
      element={
        <RoleGuard allowedRoles={["admin"]}>
          <CbBotRicerchePage />
        </RoleGuard>
      }
    />
  </>
);
