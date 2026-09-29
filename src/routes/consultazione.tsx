import { Route } from "react-router-dom";
import ConsultazioneGuard from "@/components/ConsultazioneGuard";
import ConsultazioneLayout from "@/components/ConsultazioneLayout";
import ConsultazioneLoginPage from "@/pages/consultazione/ConsultazioneLoginPage";
import DocumentalePage from "@/pages/DocumentalePage";

export const consultazioneRoutes = (
  <>
    <Route path="/consultazione/login" element={<ConsultazioneLoginPage />} />
    <Route
      element={
        <ConsultazioneGuard>
          <ConsultazioneLayout />
        </ConsultazioneGuard>
      }
    >
      <Route path="/consultazione" element={<DocumentalePage consultazioneMode />} />
      <Route path="/consultazione/documentale" element={<DocumentalePage consultazioneMode />} />
    </Route>
  </>
);
