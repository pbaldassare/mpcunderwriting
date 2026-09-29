import { describe, expect, it } from "vitest";
import {
  buildAppendiceBaseOverrides,
  fetchAppendiciPolizzaForTitoli,
  linkAppendiceAPolizzaBase,
} from "@/lib/appendiciPolizza";
import { groupTitoliByPolizza } from "@/lib/quietanze";
import { computeFlatQuietanze } from "@/lib/polizzeClienteView";

function mockSupabase(rowsByTable: Record<string, unknown[]>) {
  const from = (table: string) => ({
    select: () => ({
      in: async () => ({ data: rowsByTable[table] ?? [], error: null }),
    }),
  });
  return { from } as any;
}

describe("fetchAppendiciPolizzaForTitoli", () => {
  it("deduplica e ordina per created_at desc", async () => {
    const supabase = mockSupabase({
      appendici_polizza: [
        { id: "a1", titolo_id: "m1", numero_appendice: "1", created_at: "2026-01-01" },
        { id: "a1", titolo_id: "m1", numero_appendice: "1", created_at: "2026-01-01" },
        { id: "a2", quietanza_id: "q1", numero_appendice: "2", created_at: "2026-06-01" },
      ],
    });
    const res = await fetchAppendiciPolizzaForTitoli(supabase, ["m1", "q1"]);
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("a2");
  });
});

describe("linkAppendiceAPolizzaBase / buildAppendiceBaseOverrides", () => {
  const titoli = [
    { id: "m", numero_titolo: "33333", sostituisce_polizza: null as string | null },
    { id: "q", numero_titolo: "33333", sostituisce_polizza: "33333" },
    { id: "am", numero_titolo: "eweweewew/AM1", sostituisce_polizza: null, is_appendice_modifica: true },
  ];
  const links = [
    { titolo_id: "m", quietanza_id: "q", titolo_modifica_id: "am", numero_appendice: "1" },
  ];

  it("risolve il base dalla quietanza/madre collegata", () => {
    const byId = new Map(titoli.map((t) => [t.id, t]));
    expect(linkAppendiceAPolizzaBase("am", links, byId)).toBe("33333");
  });

  it("skip se link ambiguo (più righe)", () => {
    const byId = new Map(titoli.map((t) => [t.id, t]));
    const ambigui = [
      ...links,
      { titolo_id: "m", titolo_modifica_id: "am", numero_appendice: "2" },
    ];
    expect(linkAppendiceAPolizzaBase("am", ambigui, byId)).toBeNull();
  });

  it("enrichment: appendice con numero diverso finisce sotto la madre; flat quietanze senza appendice", () => {
    const overrides = buildAppendiceBaseOverrides(titoli, links);
    expect(overrides.get("am")).toBe("33333");
    const catene = groupTitoliByPolizza(titoli, overrides);
    expect(catene).toHaveLength(1);
    expect(catene[0].appendici.map((a) => a.id)).toEqual(["am"]);
    const flat = computeFlatQuietanze(catene);
    expect(flat.map((r) => r.rata.id)).toEqual(["q"]);
    expect(flat.some((r) => r.rata.id === "am")).toBe(false);
  });

  it("nessun override se baseNumero già allineato", () => {
    const allineati = [
      { id: "m", numero_titolo: "POL-A", sostituisce_polizza: null as string | null },
      { id: "am", numero_titolo: "POL-A/AM1", sostituisce_polizza: null, is_appendice_modifica: true },
    ];
    const ov = buildAppendiceBaseOverrides(allineati, [
      { titolo_id: "m", titolo_modifica_id: "am" },
    ]);
    expect(ov.size).toBe(0);
  });
});
