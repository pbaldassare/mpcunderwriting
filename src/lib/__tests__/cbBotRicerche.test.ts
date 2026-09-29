import { describe, expect, it } from "vitest";
import { countCronologiaDaAzzerare, filterRicerche, isRicercaSalvata } from "@/lib/cbBotRicerche";

const list = [
  { id: "1", titolo: "Cyber PMI", salvata: true },
  { id: "2", titolo: "IVASS", salvata: false },
  { id: "3", titolo: "D&O", salvata: undefined },
];

describe("isRicercaSalvata", () => {
  it("è vera solo con salvata=true", () => {
    expect(isRicercaSalvata({ salvata: true })).toBe(true);
    expect(isRicercaSalvata({ salvata: false })).toBe(false);
    expect(isRicercaSalvata({})).toBe(false);
  });
});

describe("filterRicerche", () => {
  it("mostra tutte o solo le salvate", () => {
    expect(filterRicerche(list, "tutte")).toHaveLength(3);
    expect(filterRicerche(list, "salvate").map((r) => r.id)).toEqual(["1"]);
  });
});

describe("countCronologiaDaAzzerare", () => {
  it("conta solo le non salvate", () => {
    expect(countCronologiaDaAzzerare(list)).toBe(2);
    expect(countCronologiaDaAzzerare([{ salvata: true }])).toBe(0);
  });
});
