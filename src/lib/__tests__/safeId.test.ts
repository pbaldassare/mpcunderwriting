import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyGaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { installSafeRandomUUID, safeId } from "@/lib/safeId";

describe("safeId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa randomUUID quando disponibile", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-3333-4444-555555555555" });
    expect(safeId()).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("non crasha se randomUUID manca o lancia (HTTP su IP)", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("Secure random unavailable");
      },
    });
    const id = safeId();
    expect(id.startsWith("id-")).toBe(true);
    expect(id.length).toBeGreaterThan(8);
  });

  it("installSafeRandomUUID rende randomUUID usabile se manca", () => {
    vi.stubGlobal("crypto", {});
    installSafeRandomUUID();
    expect(typeof crypto.randomUUID).toBe("function");
    expect(crypto.randomUUID().length).toBeGreaterThan(8);
  });

  it("installSafeRandomUUID intercetta randomUUID che lancia", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("Secure random unavailable");
      },
    });
    installSafeRandomUUID();
    expect(() => crypto.randomUUID()).not.toThrow();
    expect(crypto.randomUUID().length).toBeGreaterThan(8);
  });

  it("emptyGaranziaRow non crasha senza randomUUID", () => {
    vi.stubGlobal("crypto", {});
    const row = emptyGaranziaRow();
    expect(row._localId.length).toBeGreaterThan(4);
  });
});
