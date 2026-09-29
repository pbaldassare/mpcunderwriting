import { describe, expect, it } from "vitest";
import { REGGIO_CALABRIA_CENTER, resolveSinistroCoords } from "../sinistriMapUtils";

describe("resolveSinistroCoords", () => {
  it("accetta lat/lng validi", () => {
    expect(resolveSinistroCoords({ lat: 38.11, lng: 15.65 })).toEqual({ lat: 38.11, lng: 15.65 });
  });

  it("rifiuta valori assenti o fuori range", () => {
    expect(resolveSinistroCoords({ lat: null, lng: 15 })).toBeNull();
    expect(resolveSinistroCoords({ lat: 91, lng: 15 })).toBeNull();
  });

  it("centro default è Reggio Calabria", () => {
    expect(REGGIO_CALABRIA_CENTER.lat).toBeCloseTo(38.11, 1);
    expect(REGGIO_CALABRIA_CENTER.lng).toBeCloseTo(15.65, 1);
  });
});
