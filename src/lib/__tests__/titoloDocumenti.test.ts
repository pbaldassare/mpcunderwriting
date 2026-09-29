import { describe, expect, it } from "vitest";
import { resolveTitoloDocumentiReadIds } from "@/lib/titoloDocumenti";

describe("resolveTitoloDocumentiReadIds", () => {
  it("sulla madre legge tutta la catena", () => {
    expect(
      resolveTitoloDocumentiReadIds({
        titoloId: "m1",
        chainIds: ["m1", "q1", "q2"],
        isAppendiceView: false,
      }),
    ).toEqual(["m1", "q1", "q2"]);
  });

  it("sulla quietanza legge solo la rata", () => {
    expect(
      resolveTitoloDocumentiReadIds({
        titoloId: "q1",
        chainIds: ["m1", "q1", "q2"],
        isAppendiceView: false,
      }),
    ).toEqual(["q1"]);
  });

  it("sull'appendice legge solo il titolo corrente", () => {
    expect(
      resolveTitoloDocumentiReadIds({
        titoloId: "am1",
        chainIds: ["am1"],
        isAppendiceView: true,
      }),
    ).toEqual(["am1"]);
  });
});
