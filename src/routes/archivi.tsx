import { Route, Navigate } from "react-router-dom";
import ProspectDetail from "@/pages/ProspectDetail";
import ClientiList from "@/pages/ClientiList";
import ClienteDetail from "@/pages/ClienteDetail";
import DeduplicaClientiPage from "@/pages/DeduplicaClientiPage";
import AnagraficheCompagniePage from "@/pages/AnagraficheCompagniePage";
import AnagraficheInternePage from "@/pages/AnagraficheInternePage";
import TrattativeList from "@/pages/TrattativeList";
import BandiPubbliciPage from "@/pages/BandiPubbliciPage";
import ContiBancariPage from "@/pages/anagrafiche/ContiBancariPage";


export const archiviRoutes = (
  <>
    {/* Prospect interno deprecato: usa Anagrafiche → Clienti */}
    <Route path="/archivi/prospect" element={<Navigate to="/archivi/clienti" replace />} />
    <Route path="/archivi/prospect/:id" element={<ProspectDetail />} />
    {/* Compatibilità legacy dettaglio prospect */}
    <Route path="/prospect/:id" element={<ProspectDetail />} />
    <Route path="/archivi/clienti" element={<ClientiList />} />
    <Route path="/archivi/clienti/deduplica" element={<DeduplicaClientiPage />} />
    <Route path="/archivi/clienti/:id" element={<ClienteDetail />} />
    <Route path="/archivi/anagrafiche-agenzie" element={<AnagraficheCompagniePage />} />
    <Route path="/archivi/anagrafiche-amministrative" element={<AnagraficheInternePage />} />
    <Route path="/archivi/anagrafiche-interne" element={<Navigate to="/archivi/anagrafiche-amministrative" replace />} />
    <Route path="/archivi/anagrafiche" element={<Navigate to="/archivi/anagrafiche-amministrative" replace />} />
    <Route path="/archivi/conti-bancari" element={<ContiBancariPage />} />
    <Route path="/trattative" element={<TrattativeList />} />
    <Route path="/trattative/calendario" element={<Navigate to="/trattative" replace />} />
    <Route path="/trattative/storico" element={<Navigate to="/trattative?view=archiviate" replace />} />
    <Route path="/bandi-pubblici/partecipati" element={<BandiPubbliciPage />} />
    <Route path="/bandi-pubblici" element={<BandiPubbliciPage />} />
  </>
);
