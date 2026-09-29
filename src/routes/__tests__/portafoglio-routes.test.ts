import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../portafoglio.tsx"), "utf8");

function pathIndex(path: string): number {
  return SRC.indexOf(`path="${path}"`);
}

describe("portafoglioRoutes — ordine rotte", () => {
  it("dichiara /portafoglio/immissione prima di /portafoglio/:id", () => {
    const immissione = pathIndex("/portafoglio/immissione");
    const detail = pathIndex("/portafoglio/:id");
    expect(immissione).toBeGreaterThan(-1);
    expect(detail).toBeGreaterThan(-1);
    expect(immissione).toBeLessThan(detail);
  });

  it("dichiara le altre rotte statiche prima di /portafoglio/:id", () => {
    const detail = pathIndex("/portafoglio/:id");
    for (const path of [
      "/portafoglio/appendici",
      "/portafoglio/rinnovi",
      "/portafoglio/gestione",
      "/portafoglio/rettifica-provvigioni",
      "/portafoglio/documentale",
    ]) {
      const idx = pathIndex(path);
      expect(idx, path).toBeGreaterThan(-1);
      expect(idx, path).toBeLessThan(detail);
    }
  });
});
