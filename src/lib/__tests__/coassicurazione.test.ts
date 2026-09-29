import { describe, it, expect } from "vitest";
import {
  applyResiduoToRow,
  buildInitialCoassRows,
  calcRipartoImporti,
  calcResiduoQuota,
  emptyRipartoRow,
  getQuotaSumStatus,
  isRipartoSumValidForPreview,
  parseQuotaPercentuale,
  redistributeQuoteEvenly,
  ripartoRowsFromDettaglio,
  sanitizeQuotaInput,
  splitQuoteEvenly,
  sumQuotePercentuali,
  validateQuotaRow,
  validateRipartoSum,
} from "../coassicurazione";

describe("sanitizeQuotaInput", () => {
  it("accetta virgola e limita a 100", () => {
    expect(sanitizeQuotaInput("50,5")).toBe("50.5");
    expect(sanitizeQuotaInput("150")).toBe("100");
  });

  it("finalizza con 2 decimali", () => {
    expect(sanitizeQuotaInput("33.333", true)).toBe("33.33");
  });
});

describe("validateQuotaRow", () => {
  it("rifiuta vuoto, zero e oltre 100", () => {
    expect(validateQuotaRow("").valid).toBe(false);
    expect(validateQuotaRow("0").issue).toBe("zero");
    expect(validateQuotaRow("101").issue).toBe("over_max");
    expect(validateQuotaRow("25").valid).toBe(true);
  });
});

describe("validateRipartoSum", () => {
  const baseRow = (q: string, id = "c1") =>
    emptyRipartoRow({
      gruppoCompagniaId: "g1",
      compagniaId: id,
      quotaPercentuale: q,
    });

  it("richiede somma esattamente 100%", () => {
    const rows = [baseRow("60"), baseRow("30", "c2")];
    const res = validateRipartoSum(rows);
    expect(res.valid).toBe(false);
    expect(res.sum).toBe(90);
  });

  it("accetta riparto valido 70/30", () => {
    const rows = [baseRow("70"), baseRow("30", "c2")];
    expect(validateRipartoSum(rows).valid).toBe(true);
  });

  it("rifiuta singola riga oltre 100%", () => {
    const rows = [baseRow("150")];
    const res = validateRipartoSum(rows);
    expect(res.valid).toBe(false);
  });

  it("non crasha su input assente o non array", () => {
    expect(validateRipartoSum(undefined).valid).toBe(false);
    expect(validateRipartoSum(null).valid).toBe(false);
    expect(isRipartoSumValidForPreview(undefined)).toBe(false);
  });
});

describe("splitQuoteEvenly / redistributeQuoteEvenly", () => {
  it("tre righe sommano a 100", () => {
    const quotas = splitQuoteEvenly(3);
    const sum = quotas.reduce((s, q) => s + parseQuotaPercentuale(q), 0);
    expect(sum).toBe(100);
  });

  it("redistributeQuoteEvenly mantiene le righe", () => {
    const rows = redistributeQuoteEvenly([
      emptyRipartoRow({ gruppoCompagniaId: "a" }),
      emptyRipartoRow({ gruppoCompagniaId: "b" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(sumQuotePercentuali(rows)).toBe(100);
  });
});

describe("applyResiduoToRow", () => {
  it("imposta il residuo sulla riga indicata", () => {
    const rows = [
      emptyRipartoRow({ quotaPercentuale: "70" }),
      emptyRipartoRow({ quotaPercentuale: "10" }),
    ];
    const next = applyResiduoToRow(rows, 1);
    expect(next[1].quotaPercentuale).toBe("30");
    expect(calcResiduoQuota(rows, 1)).toBe(30);
  });
});

describe("buildInitialCoassRows", () => {
  it("precompila il leader e ripartisce 50/50", () => {
    const rows = buildInitialCoassRows({
      gruppoCompagniaId: "g-leader",
      compagniaId: "c-leader",
      rapportoId: "r-leader",
    });
    expect(rows[0].gruppoCompagniaId).toBe("g-leader");
    expect(rows[0].compagniaId).toBe("c-leader");
    expect(sumQuotePercentuali(rows)).toBe(100);
  });
});

describe("sumQuotePercentuali", () => {
  it("non crasha su input assente o non array", () => {
    expect(sumQuotePercentuali(undefined)).toBe(0);
    expect(sumQuotePercentuali(null)).toBe(0);
    expect(sumQuotePercentuali([] as any)).toBe(0);
  });
});

describe("getQuotaSumStatus", () => {
  it("distingue under, over e ok", () => {
    expect(getQuotaSumStatus(100)).toBe("ok");
    expect(getQuotaSumStatus(99.99)).toBe("ok");
    expect(getQuotaSumStatus(80)).toBe("under");
    expect(getQuotaSumStatus(120)).toBe("over");
  });
});

describe("calcRipartoImporti", () => {
  it("ultima riga assorbe arrotondamenti", () => {
    const rows = [
      emptyRipartoRow({ quotaPercentuale: "33.33" }),
      emptyRipartoRow({ quotaPercentuale: "33.33" }),
      emptyRipartoRow({ quotaPercentuale: "33.34" }),
    ];
    const importi = calcRipartoImporti(
      { netto: 100, addizionali: 0, tasse: 22, lordo: 122 },
      rows,
    );
    const lordoSum = importi.reduce((s, r) => s + r.totale, 0);
    expect(lordoSum).toBe(122);
  });
});

describe("isRipartoSumValidForPreview", () => {
  it("false se somma non è 100%", () => {
    const rows = [emptyRipartoRow({ gruppoCompagniaId: "g", compagniaId: "c", quotaPercentuale: "50" })];
    expect(isRipartoSumValidForPreview(rows)).toBe(false);
  });
});

describe("ripartoRowsFromDettaglio", () => {
  it("mappa righe DB in righe editor", () => {
    const rows = ripartoRowsFromDettaglio([
      {
        id: "r1",
        gruppo_compagnia_id: "g1",
        compagnia_id: "c1",
        compagnia_rapporto_id: "rap1",
        quota_percentuale: 60,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quotaPercentuale).toBe("60");
    expect(rows[0].compagniaId).toBe("c1");
  });
});
