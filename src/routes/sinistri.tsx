import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import SinistriList from "@/pages/SinistriList";
import SinistroDetail from "@/pages/SinistroDetail";
import SinistroAperturaWizardPage from "@/pages/SinistroAperturaWizardPage";
import SinistriCaricamentoPage from "@/pages/SinistriCaricamentoPage";
import SinistroPrescrizioniPage from "@/pages/SinistroPrescrizioniPage";
import SinistroReminderPage from "@/pages/SinistroReminderPage";
import SinistroReportSirPage from "@/pages/SinistroReportSirPage";

export const sinistriRoutes = (
  <>
    <Route path="/sinistri" element={<SinistriList />} />
    <Route path="/sinistri/apertura" element={<SinistroAperturaWizardPage />} />
    <Route path="/sinistri/caricamento" element={<SinistriCaricamentoPage />} />
    <Route path="/sinistri/prescrizioni" element={<SinistroPrescrizioniPage />} />
    <Route path="/sinistri/reminder" element={<SinistroReminderPage />} />
    <Route path="/sinistri/report-sir" element={<SinistroReportSirPage />} />
    <Route path="/sinistri/:id" element={<SinistroDetail />} />
  </>
);
