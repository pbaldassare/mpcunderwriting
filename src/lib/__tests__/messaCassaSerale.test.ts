import { describe, expect, it } from "vitest";
import {
  isAtOrAfterMessaCassaSerale,
  romeDateParts,
  scheduledForMessaCassaSeraleOggi,
  shouldScheduleMessaCassaSerale,
} from "@/lib/messaCassaSerale";

describe("messaCassaSerale", () => {
  it("legge l'orologio civile italiano (CEST a settembre)", () => {
    const parts = romeDateParts(new Date("2026-09-22T10:00:00+02:00"));
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 22, hour: 10, minute: 0 });
  });

  it("prima delle 19:30 non è ancora l'orario serale", () => {
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-09-22T19:29:59+02:00"))).toBe(false);
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-09-22T10:00:00+02:00"))).toBe(false);
  });

  it("alle 19:30 e dopo invia subito", () => {
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-09-22T19:30:00+02:00"))).toBe(true);
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-09-22T21:00:00+02:00"))).toBe(true);
  });

  it("in inverno usa CET (UTC+1)", () => {
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-01-15T19:29:00+01:00"))).toBe(false);
    expect(isAtOrAfterMessaCassaSerale(new Date("2026-01-15T19:30:00+01:00"))).toBe(true);
    expect(scheduledForMessaCassaSeraleOggi(new Date("2026-01-15T10:00:00+01:00"))).toBe(
      "2026-01-15T18:30:00.000Z",
    );
  });

  it("schedula le 19:30 del giorno corrente in CEST", () => {
    expect(scheduledForMessaCassaSeraleOggi(new Date("2026-09-22T08:15:00+02:00"))).toBe(
      "2026-09-22T17:30:00.000Z",
    );
  });

  it("pianifica solo se checkbox serale e prima delle 19:30", () => {
    const morning = new Date("2026-09-22T11:00:00+02:00");
    const evening = new Date("2026-09-22T19:45:00+02:00");
    expect(shouldScheduleMessaCassaSerale(false, morning)).toBe(false);
    expect(shouldScheduleMessaCassaSerale(true, morning)).toBe(true);
    expect(shouldScheduleMessaCassaSerale(true, evening)).toBe(false);
    expect(shouldScheduleMessaCassaSerale(false, evening)).toBe(false);
  });
});
