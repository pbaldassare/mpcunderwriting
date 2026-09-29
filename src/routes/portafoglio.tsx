import { Route, Navigate } from "react-router-dom";
import TitoliList from "@/pages/TitoliList";
import TitoloDetail from "@/pages/TitoloDetail";
import PolizzaDetail from "@/pages/PolizzaDetail";
import QuietanzaDetail from "@/pages/QuietanzaDetail";

import ImmissionePolizzaPage from "@/pages/ImmissionePolizzaPage";
import AppendiciPolizzaPage from "@/pages/AppendiciPolizzaPage";
import RinnoviPolizzaPage from "@/pages/RinnoviPolizzaPage";
import GestionePolizzePage from "@/pages/GestionePolizzePage";

import DocPrecontrattualePage from "@/pages/DocPrecontrattualePage";
import EstrazioniStampePage from "@/pages/EstrazioniStampePage";

import DocumentalePage from "@/pages/DocumentalePage";
import ProvvigioniMaturatePage from "@/pages/ProvvigioniMaturatePage";

import PortafoglioAttivePage from "@/pages/PortafoglioAttivePage";
import IncassiPage from "@/pages/IncassiPage";
import PortafoglioCaricoConsultazionePage from "@/pages/PortafoglioCaricoConsultazionePage";
import PortafoglioStoricoPage from "@/pages/PortafoglioStoricoPage";
import PortafoglioDetail from "@/pages/PortafoglioDetail";
import CompensazioniTitoloDetail from "@/pages/contabilita/CompensazioniTitoloDetail";
import PortafoglioPerClientePage from "@/pages/estrazioni/PortafoglioPerClientePage";
import PortafoglioClienteAnalisiPage from "@/pages/estrazioni/PortafoglioClienteAnalisiPage";
import PortafoglioPerCompagniaPage from "@/pages/estrazioni/PortafoglioPerCompagniaPage";
import PremiProvvigioniPage from "@/pages/estrazioni/PremiProvvigioniPage";
import PremiScopertiGarantitiPage from "@/pages/estrazioni/PremiScopertiGarantitiPage";
import ECClientiPage from "@/pages/estrazioni/ECClientiPage";
import TitoliDaIncassarePage from "@/pages/estrazioni/TitoliDaIncassarePage";
import RichiestaQuietanzaPage from "@/pages/estrazioni/RichiestaQuietanzaPage";
import RegistroRichiesteQuietanzaPage from "@/pages/estrazioni/RegistroRichiesteQuietanzaPage";
import ComunicazioniIncassoPage from "@/pages/estrazioni/ComunicazioniIncassoPage";
import PrimaNotaPage from "@/pages/estrazioni/PrimaNotaPage";
import PolizzeTacitoRinnovoPage from "@/pages/estrazioni/PolizzeTacitoRinnovoPage";
import ElaborazioniPage from "@/pages/estrazioni/ElaborazioniPage";
import NidificazionePage from "@/pages/estrazioni/NidificazionePage";
import RestituzioneOriginaliPage from "@/pages/estrazioni/RestituzioneOriginaliPage";
import PortafoglioRettificaProvvigioniPage from "@/pages/PortafoglioRettificaProvvigioniPage";

export const portafoglioRoutes = (
  <>
    <Route path="/titoli" element={<TitoliList />} />
    <Route path="/titoli/:id" element={<TitoloDetail />} />
    <Route path="/polizze/:id" element={<PolizzaDetail />} />
    <Route path="/quietanze/:id" element={<QuietanzaDetail />} />
    <Route path="/portafoglio" element={<Navigate to="/portafoglio/attive" replace />} />
    <Route path="/portafoglio/attive" element={<PortafoglioAttivePage />} />
    <Route path="/portafoglio/carico" element={<PortafoglioCaricoConsultazionePage />} />
    <Route path="/portafoglio/incassi" element={<IncassiPage />} />
    <Route path="/portafoglio/storico" element={<PortafoglioStoricoPage />} />
    <Route path="/portafoglio/immissione" element={<ImmissionePolizzaPage />} />
    <Route path="/portafoglio/appendici" element={<AppendiciPolizzaPage />} />
    <Route path="/portafoglio/rinnovi" element={<RinnoviPolizzaPage />} />
    <Route path="/portafoglio/gestione" element={<GestionePolizzePage />} />
    <Route path="/portafoglio/estrazioni/cig-temporanei" element={<GestionePolizzePage forcedOp="cig_temporanei" />} />
    <Route path="/portafoglio/estrazioni/regolazioni-attese" element={<GestionePolizzePage forcedOp="regolazioni_attese" />} />
    <Route path="/portafoglio/rettifica-provvigioni" element={<PortafoglioRettificaProvvigioniPage />} />

    <Route path="/portafoglio/doc-precontrattuale" element={<DocPrecontrattualePage />} />
    <Route path="/portafoglio/estrazioni-stampe" element={<EstrazioniStampePage />} />
    <Route path="/portafoglio/estrazioni/per-cliente" element={<PortafoglioPerClientePage />} />
    <Route path="/portafoglio/estrazioni/per-cliente/:clienteId" element={<PortafoglioClienteAnalisiPage />} />
    <Route path="/portafoglio/estrazioni/per-compagnia" element={<PortafoglioPerCompagniaPage />} />
    <Route path="/portafoglio/estrazioni/premi-provvigioni" element={<PremiProvvigioniPage />} />
    <Route path="/portafoglio/estrazioni/premi-scoperti-garantiti" element={<PremiScopertiGarantitiPage />} />
    <Route path="/portafoglio/estrazioni/ec-clienti" element={<ECClientiPage />} />
    <Route path="/portafoglio/estrazioni/titoli-da-incassare" element={<TitoliDaIncassarePage />} />
    <Route path="/portafoglio/estrazioni/richiesta-quietanza" element={<RichiestaQuietanzaPage />} />
    <Route path="/portafoglio/estrazioni/richiesta-quietanza/registro" element={<RegistroRichiesteQuietanzaPage />} />
    <Route path="/portafoglio/estrazioni/comunicazioni-incasso" element={<ComunicazioniIncassoPage />} />
    <Route path="/portafoglio/estrazioni/prima-nota" element={<PrimaNotaPage />} />
    <Route path="/portafoglio/estrazioni/tacito-rinnovo" element={<PolizzeTacitoRinnovoPage />} />
    <Route path="/portafoglio/estrazioni/elaborazioni" element={<ElaborazioniPage />} />
    <Route path="/portafoglio/estrazioni/nidificazione" element={<NidificazionePage />} />
    <Route path="/portafoglio/estrazioni/restituzione-originali" element={<RestituzioneOriginaliPage />} />
    <Route path="/portafoglio/collettive" element={<Navigate to="/portafoglio/attive" replace />} />
    <Route path="/portafoglio/documentale" element={<DocumentalePage />} />
    <Route path="/portafoglio/:id/compensazioni" element={<CompensazioniTitoloDetail />} />
    <Route path="/portafoglio/:id" element={<PortafoglioDetail />} />
    <Route path="/provvigioni-maturate" element={<ProvvigioniMaturatePage />} />
  </>
);
