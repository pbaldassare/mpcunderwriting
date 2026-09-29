import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ConsultazioneProvider } from "./contexts/ConsultazioneContext";
import AuthGuard from "./components/AuthGuard";
import MainLayout from "./components/MainLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import MioProfilo from "./pages/MioProfilo";
import AiAssistantPage from "./pages/AiAssistantPage";
import GuidaOperativaPage from "./pages/GuidaOperativaPage";
import NotFound from "./pages/NotFound";

import AppVersionGuard from "./components/AppVersionGuard";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { archiviRoutes } from "./routes/archivi";
import { portafoglioRoutes } from "./routes/portafoglio";
import { sinistriRoutes } from "./routes/sinistri";
import { contabilitaRoutes } from "./routes/contabilita";
import { rcaRoutes } from "./routes/rca";
import { sistemaRoutes } from "./routes/sistema";
import { clienteRoutes } from "./routes/cliente";
import { prospectRoutes } from "./routes/prospect";
import { consultazioneRoutes } from "./routes/consultazione";
import { opportunityRoutes } from "./routes/opportunity";
import { cbBotRoutes } from "./routes/cb-bot";
import { installSwCleanupListener } from "./lib/swCleanupListener";

installSwCleanupListener();

const queryClient = new QueryClient();

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConsultazioneProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <AppVersionGuard />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/mio-profilo" element={<MioProfilo />} />
                  <Route path="/ai-assistant" element={<AiAssistantPage />} />
                  <Route path="/guida-operativa" element={<GuidaOperativaPage />} />
                  
                  <Route element={<AppErrorBoundary section="Archivi"><Outlet /></AppErrorBoundary>}>
                    {archiviRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Opportunity"><Outlet /></AppErrorBoundary>}>
                    {opportunityRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Cb Bot"><Outlet /></AppErrorBoundary>}>
                    {cbBotRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Portafoglio"><Outlet /></AppErrorBoundary>}>
                    {portafoglioRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Sinistri"><Outlet /></AppErrorBoundary>}>
                    {sinistriRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Contabilità"><Outlet /></AppErrorBoundary>}>
                    {contabilitaRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Progetto RCA"><Outlet /></AppErrorBoundary>}>
                    {rcaRoutes}
                  </Route>
                  <Route element={<AppErrorBoundary section="Sistema"><Outlet /></AppErrorBoundary>}>
                    {sistemaRoutes}
                  </Route>
                </Route>
                
                <Route element={<AppErrorBoundary section="Cliente"><Outlet /></AppErrorBoundary>}>
                  {clienteRoutes}
                </Route>
                <Route element={<AppErrorBoundary section="Prospect"><Outlet /></AppErrorBoundary>}>
                  {prospectRoutes}
                </Route>
                <Route element={<AppErrorBoundary section="Consultazione"><Outlet /></AppErrorBoundary>}>
                  {consultazioneRoutes}
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ConsultazioneProvider>
      </AuthProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
