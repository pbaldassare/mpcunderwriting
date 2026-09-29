import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { defaultDataEstrattoConto, defaultDataEstrattoContoFormatted } from "@/lib/contabilita/defaultDataEstrattoConto";

describe("defaultDataEstrattoConto", () => {
  it("restituisce sempre il 10 del mese corrente", () => {
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), 10);
    expect(defaultDataEstrattoConto()).toEqual(expected);
    expect(defaultDataEstrattoContoFormatted()).toBe(format(expected, "dd/MM/yyyy"));
  });
});
