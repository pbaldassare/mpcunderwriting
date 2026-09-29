import { Route } from "react-router-dom";
import RcaClientelaPage from "@/pages/rca/RcaClientelaPage";
import RcaScadenzePage from "@/pages/rca/RcaScadenzePage";
import RcaPreventiviListPage from "@/pages/rca/RcaPreventiviListPage";
import RcaPreventivoAnalisiPage from "@/pages/rca/RcaPreventivoAnalisiPage";
import RcaPreventivoDetailPage from "@/pages/rca/RcaPreventivoDetailPage";

export const rcaRoutes = (
  <>
    <Route path="/rca" element={<RcaClientelaPage />} />
    <Route path="/rca/clientela" element={<RcaClientelaPage />} />
    <Route path="/rca/scadenze" element={<RcaScadenzePage />} />
    <Route path="/rca/preventivi" element={<RcaPreventiviListPage />} />
    <Route path="/rca/preventivi/nuovo" element={<RcaPreventivoAnalisiPage />} />
    <Route path="/rca/preventivi/:id" element={<RcaPreventivoDetailPage />} />
  </>
);
