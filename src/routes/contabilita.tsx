import { Route } from "react-router-dom";
import ContabilitaUfficio from "@/pages/ContabilitaUfficio";
import CaricamentoMovBancariPage from "@/pages/contabilita/CaricamentoMovBancariPage";
import RicongiungimentoBancarioPage from "@/pages/contabilita/RicongiungimentoBancarioPage";



import ECClientiContabPage from "@/pages/contabilita/ECClientiContabPage";
import ECCompagniaContabPage from "@/pages/contabilita/ECCompagniaContabPage";
import ECAgenziaPdfPage from "@/pages/contabilita/ECAgenziaPdfPage";
import AgenzieInPagamentoPage from "@/pages/contabilita/AgenzieInPagamentoPage";
import ECClientePdfPage from "@/pages/contabilita/ECClientePdfPage";
import ECAgenzieStoricoPage from "@/pages/contabilita/ECAgenzieStoricoPage";
import ECClientiStoricoPage from "@/pages/contabilita/ECClientiStoricoPage";
import ECProduttoriContabPage from "@/pages/contabilita/ECProduttoriContabPage";
import ECProduttoriStoricoPage from "@/pages/contabilita/ECProduttoriStoricoPage";
import StoricoRimessePage from "@/pages/contabilita/StoricoRimessePage";

import RiepilogoAnticipiPage from "@/pages/contabilita/RiepilogoAnticipiPage";

import ReportIVA from "@/pages/ReportIVA";
import { Navigate } from "react-router-dom";

export const contabilitaRoutes = (
  <>
    {/* CONTABILITÀ UFFICIO */}
    <Route path="/contabilita" element={<ContabilitaUfficio />} />
    <Route path="/contabilita/cruscotto" element={<Navigate to="/contabilita" replace />} />
    
    <Route path="/contabilita/ec-clienti" element={<ECClientiContabPage />} />
    <Route path="/contabilita/ec-compagnia" element={<ECCompagniaContabPage />} />
    <Route path="/contabilita/ec-agenzia" element={<ECCompagniaContabPage />} />
    <Route path="/contabilita/ec-agenzia/pdf" element={<ECAgenziaPdfPage />} />
    <Route path="/contabilita/ec-agenzia/in-pagamento" element={<AgenzieInPagamentoPage />} />
    <Route path="/contabilita/ec-cliente/pdf" element={<ECClientePdfPage />} />
    <Route path="/contabilita/ec-agenzia/storico" element={<ECAgenzieStoricoPage />} />
    <Route path="/contabilita/ec-cliente/storico" element={<ECClientiStoricoPage />} />
    <Route path="/contabilita/ec-produttori" element={<ECProduttoriContabPage />} />
    <Route path="/contabilita/ec-produttore/storico" element={<ECProduttoriStoricoPage />} />
    <Route path="/contabilita/storico-rimesse" element={<StoricoRimessePage />} />
    <Route path="/contabilita/anticipi-clienti" element={<RiepilogoAnticipiPage />} />
    <Route path="/contabilita/caricamento-mov-bancari" element={<CaricamentoMovBancariPage />} />
    <Route path="/contabilita/ricongiungimento-bancario" element={<RicongiungimentoBancarioPage />} />
    <Route path="/contabilita/stampa-sospesi" element={<Navigate to="/contabilita/anticipi-clienti" replace />} />


    <Route path="/rimessa-premi" element={<Navigate to="/contabilita/storico-rimesse" replace />} />
    <Route path="/rimessa-premi/:id" element={<Navigate to="/contabilita/storico-rimesse" replace />} />
    <Route path="/report-iva" element={<ReportIVA />} />
  </>
);
