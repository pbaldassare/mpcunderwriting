import { describe, expect, it } from "vitest";
import {
  calcProvvigioniAttive,
  calcProvvigioniPassive,
  sumMessaCassaProvvigioni,
} from "../messaCassaProvvigioni";

describe("calcProvvigioniAttive", () => {
  it("quietanza (sostituisce_polizza): solo provvigioni_quietanza", () => {
    expect(
      calcProvvigioniAttive({
        sostituisce_polizza: "185153927",
        provvigioni_quietanza: 1355.99,
        provvigioni_firma: 999,
      }),
    ).toBe(1355.99);
  });

  it("polizza madre: quietanza se > 0, altrimenti firma", () => {
    expect(calcProvvigioniAttive({ provvigioni_quietanza: 80, provvigioni_firma: 200 })).toBe(80);
    expect(calcProvvigioniAttive({ provvigioni_quietanza: 0, provvigioni_firma: 200 })).toBe(200);
    expect(calcProvvigioniAttive({})).toBe(0);
  });
});

describe("calcProvvigioniPassive", () => {
  it("split commerciali: attive × somma % / 100", () => {
    const splits = new Map([["t1", [40, 10]]]);
    expect(
      calcProvvigioniPassive(
        { id: "t1", sostituisce_polizza: "P", provvigioni_quietanza: 200 },
        splits,
      ),
    ).toBe(100);
  });

  it("senza split e senza commerciale → 0", () => {
    expect(
      calcProvvigioniPassive({
        id: "t1",
        sostituisce_polizza: "P",
        provvigioni_quietanza: 200,
      }),
    ).toBe(0);
  });

  it("senza split, un commerciale: percentuale_commerciale (default 100%)", () => {
    expect(
      calcProvvigioniPassive({
        id: "t1",
        sostituisce_polizza: "P",
        provvigioni_quietanza: 200,
        anagrafica_commerciale_id: "p1",
        percentuale_commerciale: 50,
      }),
    ).toBe(100);
    expect(
      calcProvvigioniPassive({
        id: "t1",
        sostituisce_polizza: "P",
        provvigioni_quietanza: 200,
        produttore_id: "p1",
      }),
    ).toBe(200);
  });
});

describe("sumMessaCassaProvvigioni", () => {
  it("somma attive e passive su più quietanze", () => {
    const splits = new Map<string, number[]>([
      ["a", [25]],
    ]);
    const r = sumMessaCassaProvvigioni(
      [
        {
          id: "a",
          sostituisce_polizza: "P1",
          provvigioni_quietanza: 200,
        },
        {
          id: "b",
          sostituisce_polizza: "P2",
          provvigioni_quietanza: 80,
          anagrafica_commerciale_id: "p1",
          percentuale_commerciale: 50,
        },
        {
          id: "c",
          sostituisce_polizza: "P3",
          provvigioni_quietanza: 10,
        },
      ],
      splits,
    );
    // a: attive 200, passive 50 (split 25%)
    // b: attive 80, passive 40 (commerciale 50%)
    // c: attive 10, passive 0
    expect(r.attive).toBe(290);
    expect(r.passive).toBe(90);
  });
});
