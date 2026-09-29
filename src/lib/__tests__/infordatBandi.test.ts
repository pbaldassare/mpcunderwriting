import { describe, expect, it } from "vitest";
import {
  infordatSchedaId,
  isBrokeraggioInfordat,
  isInfordatUrl,
  parseInfordatHtml,
} from "@/lib/infordatBandi";

describe("infordat ids e url", () => {
  it("marca le schede Infordat senza collisioni con TED/Mondo", () => {
    expect(infordatSchedaId("99881")).toBe("infordat-99881");
    expect(infordatSchedaId("infordat-99881")).toBe("infordat-99881");
    expect(isInfordatUrl("https://infordat.it/account/listaemail")).toBe(true);
    expect(isInfordatUrl("https://mondoappalti.it/Scheda/1")).toBe(false);
  });
});

describe("parseInfordatHtml", () => {
  it("estrae riga gara con data-href e id gare-", () => {
    const html = `
      <table>
        <tr id="gare-99881" data-href="/account/dettagliogara/99881">
          <td>Brokeraggio assicurativo Comune di Varese</td>
          <td>Lombardia</td>
          <td>€ 50.000,00</td>
          <td>20/09/2026</td>
          <td>Z123456789</td>
        </tr>
      </table>`;
    const hits = parseInfordatHtml(html, ["Lombardia", "Lazio"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("infordat-99881");
    expect(hits[0].titolo).toMatch(/Brokeraggio/i);
    expect(hits[0].regione).toBe("Lombardia");
    expect(hits[0].importo).toBe(50000);
    expect(hits[0].scadenza).toBe("20/09/2026");
    expect(hits[0].link).toContain("infordat.it");
  });
});

describe("isBrokeraggioInfordat", () => {
  it("riconosce le gare assicurative", () => {
    expect(isBrokeraggioInfordat("Servizio di brokeraggio assicurativo")).toBe(true);
    expect(isBrokeraggioInfordat("Lavori stradali")).toBe(false);
  });
});
