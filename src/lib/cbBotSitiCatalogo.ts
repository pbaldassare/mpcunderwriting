/** Elenco curato: istituzioni, associazioni di settore e siti ufficiali compagnie. */
export type CbBotSitoCatalogo = {
  nome: string;
  url: string;
  dominio: string;
  note: string;
};

export const CB_BOT_SITI_CATALOGO: CbBotSitoCatalogo[] = [
  // Istituzioni / normativa (già in seed: IVASS, ANIA, Normattiva)
  { nome: "Preventivass", url: "https://www.preventivass.it", dominio: "preventivass.it", note: "Settore — preventivatore RC auto IVASS" },
  { nome: "Gazzetta Ufficiale", url: "https://www.gazzettaufficiale.it", dominio: "gazzettaufficiale.it", note: "Settore — atti ufficiali" },
  { nome: "EUR-Lex", url: "https://eur-lex.europa.eu", dominio: "eur-lex.europa.eu", note: "Settore — normativa UE (IDD, Solvency)" },
  { nome: "EIOPA", url: "https://www.eiopa.europa.eu", dominio: "eiopa.europa.eu", note: "Settore — autorità europea assicurazioni" },
  { nome: "Banca d'Italia", url: "https://www.bancaditalia.it", dominio: "bancaditalia.it", note: "Settore — vigilanza e UIF" },
  { nome: "Garante Privacy", url: "https://www.garanteprivacy.it", dominio: "garanteprivacy.it", note: "Settore — GDPR e privacy" },
  { nome: "COVIP", url: "https://www.covip.it", dominio: "covip.it", note: "Settore — previdenza complementare" },
  { nome: "CONSAP", url: "https://www.consap.it", dominio: "consap.it", note: "Settore — Fondo vittime della strada" },
  { nome: "Portale dell'automobilista", url: "https://www.ilportaledellautomobilista.it", dominio: "ilportaledellautomobilista.it", note: "Settore — PRA / motorizzazione" },
  { nome: "CONSOB", url: "https://www.consob.it", dominio: "consob.it", note: "Settore — prodotti di investimento" },
  { nome: "SACE", url: "https://www.sace.it", dominio: "sace.it", note: "Settore — credito e cauzioni export" },
  { nome: "AIBA", url: "https://www.aiba.it", dominio: "aiba.it", note: "Settore — associazione broker" },
  { nome: "SNA", url: "https://www.sna.it", dominio: "sna.it", note: "Settore — sindacato agenti" },
  { nome: "ANAPA", url: "https://www.anapa.it", dominio: "anapa.it", note: "Settore — associazione agenti" },
  { nome: "Insurance Europe", url: "https://www.insuranceeurope.eu", dominio: "insuranceeurope.eu", note: "Settore — federazione europea" },
  { nome: "Assinews", url: "https://www.assinews.it", dominio: "assinews.it", note: "Settore — rassegna normativa e mercato" },

  // Compagnie
  { nome: "Generali", url: "https://www.generali.it", dominio: "generali.it", note: "Compagnia" },
  { nome: "Unipol", url: "https://www.unipol.it", dominio: "unipol.it", note: "Compagnia" },
  { nome: "UnipolSai", url: "https://www.unipolsai.it", dominio: "unipolsai.it", note: "Compagnia" },
  { nome: "Allianz", url: "https://www.allianz.it", dominio: "allianz.it", note: "Compagnia" },
  { nome: "AXA Italia", url: "https://www.axa.it", dominio: "axa.it", note: "Compagnia" },
  { nome: "Zurich Italia", url: "https://www.zurich.it", dominio: "zurich.it", note: "Compagnia" },
  { nome: "Reale Mutua", url: "https://www.realemutua.it", dominio: "realemutua.it", note: "Compagnia" },
  { nome: "Groupama", url: "https://www.groupama.it", dominio: "groupama.it", note: "Compagnia" },
  { nome: "Vittoria Assicurazioni", url: "https://www.vittoriaassicurazioni.com", dominio: "vittoriaassicurazioni.com", note: "Compagnia" },
  { nome: "Sara Assicurazioni", url: "https://www.sara.it", dominio: "sara.it", note: "Compagnia" },
  { nome: "ITAS Mutua", url: "https://www.gruppoitas.it", dominio: "gruppoitas.it", note: "Compagnia" },
  { nome: "Helvetia Italia", url: "https://www.helvetia.it", dominio: "helvetia.it", note: "Compagnia" },
  { nome: "HDI Assicurazioni", url: "https://www.hdiassicurazioni.it", dominio: "hdiassicurazioni.it", note: "Compagnia" },
  { nome: "Intesa Sanpaolo Assicura", url: "https://www.intesasanpaoloassicura.com", dominio: "intesasanpaoloassicura.com", note: "Compagnia" },
  { nome: "Poste Vita", url: "https://www.postevita.it", dominio: "postevita.it", note: "Compagnia" },
  { nome: "Alleanza", url: "https://www.alleanza.it", dominio: "alleanza.it", note: "Compagnia" },
  { nome: "Genertel", url: "https://www.genertel.it", dominio: "genertel.it", note: "Compagnia" },
  { nome: "Linear", url: "https://www.linear.it", dominio: "linear.it", note: "Compagnia" },
  { nome: "Verti", url: "https://www.verti.it", dominio: "verti.it", note: "Compagnia" },
  { nome: "Prima Assicurazioni", url: "https://www.prima.it", dominio: "prima.it", note: "Compagnia" },
  { nome: "ConTe", url: "https://www.conte.it", dominio: "conte.it", note: "Compagnia" },
  { nome: "TUA Assicurazioni", url: "https://www.tuaassicurazioni.it", dominio: "tuaassicurazioni.it", note: "Compagnia" },
  { nome: "Nobis", url: "https://www.nobis.it", dominio: "nobis.it", note: "Compagnia" },
  { nome: "Assimoco", url: "https://www.assimoco.it", dominio: "assimoco.it", note: "Compagnia" },
  { nome: "Amissima", url: "https://www.amissima.it", dominio: "amissima.it", note: "Compagnia" },
  { nome: "ARAG", url: "https://www.arag.it", dominio: "arag.it", note: "Compagnia — tutela legale" },
  { nome: "DAS", url: "https://www.das.it", dominio: "das.it", note: "Compagnia — tutela legale" },
  { nome: "Europ Assistance", url: "https://www.europassistance.it", dominio: "europassistance.it", note: "Compagnia — assistenza" },
  { nome: "AIG", url: "https://www.aig.com", dominio: "aig.com", note: "Compagnia" },
  { nome: "Chubb", url: "https://www.chubb.com", dominio: "chubb.com", note: "Compagnia" },
  { nome: "Hiscox", url: "https://www.hiscox.it", dominio: "hiscox.it", note: "Compagnia" },
  { nome: "Allianz Trade", url: "https://www.allianz-trade.com", dominio: "allianz-trade.com", note: "Compagnia — credito" },
  { nome: "Coface", url: "https://www.coface.it", dominio: "coface.it", note: "Compagnia — credito" },
  { nome: "Lloyd's", url: "https://www.lloyds.com", dominio: "lloyds.com", note: "Compagnia / mercato" },
];

export function missingCatalogoSiti(existingDomains: string[]): CbBotSitoCatalogo[] {
  const have = new Set(existingDomains.map((d) => d.toLowerCase().replace(/^www\./, "")));
  return CB_BOT_SITI_CATALOGO.filter((s) => !have.has(s.dominio.toLowerCase()));
}
