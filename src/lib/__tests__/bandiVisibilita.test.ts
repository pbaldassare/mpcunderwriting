import { describe, expect, it } from "vitest";
import {
  labelVisibilitaBando,
  matchesFiltroVisibilita,
  toastSalvataggioBandi,
  visibilitaBando,
} from "@/lib/bandiVisibilita";

describe("bandiVisibilita", () => {
  it("nuovo se non deciso e mai aperto", () => {
    expect(visibilitaBando({ esito: null, visto_il: null })).toBe("nuovo");
    expect(labelVisibilitaBando("nuovo")).toBe("Nuovo");
  });

  it("già visto se aperto senza decisione", () => {
    expect(visibilitaBando({ esito: null, visto_il: "2026-09-15T07:00:00Z" })).toBe("gia_visto");
    expect(labelVisibilitaBando("gia_visto")).toBe("Già visto");
  });

  it("deciso vince sulla visibilità", () => {
    expect(visibilitaBando({ esito: "non_partecipo", visto_il: null })).toBe("deciso");
    expect(visibilitaBando({
      esito: "voglio_partecipare",
      visto_il: "2026-09-15T07:00:00Z",
    })).toBe("deciso");
  });

  it("filtra nuovi e già visti senza mischiare i decisi", () => {
    expect(matchesFiltroVisibilita("nuovo", "nuovi")).toBe(true);
    expect(matchesFiltroVisibilita("gia_visto", "nuovi")).toBe(false);
    expect(matchesFiltroVisibilita("nuovo", "gia_visti")).toBe(false);
    expect(matchesFiltroVisibilita("gia_visto", "gia_visti")).toBe(true);
    expect(matchesFiltroVisibilita("deciso", "nuovi")).toBe(false);
    expect(matchesFiltroVisibilita("deciso", "non_partecipo")).toBe(true);
    expect(matchesFiltroVisibilita("nuovo", "tutti")).toBe(true);
  });

  it("compone il toast harvest", () => {
    expect(toastSalvataggioBandi(12, 59)).toBe("12 nuovi, 59 già in archivio.");
    expect(toastSalvataggioBandi(1, 0)).toBe("1 nuovo.");
    expect(toastSalvataggioBandi(0, 4)).toBe("4 già in archivio.");
  });
});
