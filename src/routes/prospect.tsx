import { Route } from "react-router-dom";
import ProspectGuard from "@/components/ProspectGuard";
import ProspectLayout from "@/components/ProspectLayout";
import ProspectDashboard from "@/pages/prospect/ProspectDashboard";
import ProspectTrattative from "@/pages/prospect/ProspectTrattative";
import ProspectDocumenti from "@/pages/prospect/ProspectDocumenti";
import ProspectUploadDoc from "@/pages/prospect/ProspectUploadDoc";

export const prospectRoutes = (
  <Route element={<ProspectGuard><ProspectLayout /></ProspectGuard>}>
    <Route path="/prospect" element={<ProspectDashboard />} />
    <Route path="/prospect/trattative" element={<ProspectTrattative />} />
    <Route path="/prospect/documenti" element={<ProspectDocumenti />} />
    <Route path="/prospect/upload" element={<ProspectUploadDoc />} />
  </Route>
);
