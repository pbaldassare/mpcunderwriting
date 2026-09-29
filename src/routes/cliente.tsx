import { Route } from "react-router-dom";
import ClienteGuard from "@/components/ClienteGuard";
import ClienteLayout from "@/components/ClienteLayout";
import ClienteDashboard from "@/pages/cliente/ClienteDashboard";
import ClientePolizze from "@/pages/cliente/ClientePolizze";
import ClientePolizzaDetail from "@/pages/cliente/ClientePolizzaDetail";
import ClienteDocumenti from "@/pages/cliente/ClienteDocumenti";
import ClienteScadenze from "@/pages/cliente/ClienteScadenze";
import ClienteComunicazioni from "@/pages/cliente/ClienteComunicazioni";
import ClienteNotifiche from "@/pages/cliente/ClienteNotifiche";

import ClienteUploadDoc from "@/pages/cliente/ClienteUploadDoc";
import ClienteSinistri from "@/pages/cliente/ClienteSinistri";
import ClienteSinistroDetail from "@/pages/cliente/ClienteSinistroDetail";
import ClienteAnagrafica from "@/pages/cliente/ClienteAnagrafica";
import ClienteUfficio from "@/pages/cliente/ClienteUfficio";
import ClienteAssistente from "@/pages/cliente/ClienteAssistente";
import ClienteParcoVeicoli from "@/pages/cliente/ClienteParcoVeicoli";

export const clienteRoutes = (
  <Route element={<ClienteGuard><ClienteLayout /></ClienteGuard>}>
    <Route path="/cliente" element={<ClienteDashboard />} />
    <Route path="/cliente/polizze" element={<ClientePolizze />} />
    <Route path="/cliente/polizze/:id" element={<ClientePolizzaDetail />} />
    <Route path="/cliente/parco-veicoli" element={<ClienteParcoVeicoli />} />
    <Route path="/cliente/documenti" element={<ClienteDocumenti />} />
    <Route path="/cliente/scadenze" element={<ClienteScadenze />} />
    <Route path="/cliente/chat" element={<ClienteComunicazioni />} />
    <Route path="/cliente/comunicazioni" element={<ClienteComunicazioni />} />
    <Route path="/cliente/notifiche" element={<ClienteNotifiche />} />
    
    <Route path="/cliente/upload" element={<ClienteUploadDoc />} />
    <Route path="/cliente/sinistri" element={<ClienteSinistri />} />
    <Route path="/cliente/sinistri/:id" element={<ClienteSinistroDetail />} />
    <Route path="/cliente/anagrafica" element={<ClienteAnagrafica />} />
    <Route path="/cliente/ufficio" element={<ClienteUfficio />} />
    <Route path="/cliente/assistente" element={<ClienteAssistente />} />
  </Route>
);
