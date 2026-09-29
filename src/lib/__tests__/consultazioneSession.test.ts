import { describe, expect, it } from "vitest";
import {
  CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS,
  getEmailDomain,
  isConsultazioneEmailAllowed,
  normalizeConsultazioneEmail,
} from "../consultazioneSession";

describe("consultazioneSession", () => {
  it("accetta domini partner autorizzati", () => {
    expect(isConsultazioneEmailAllowed("mario.rossi@consulbrokers.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("Mario.Rossi@ConsulBrokers.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("user@exebroker.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("user@probroker.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("user@cbdigital.tech")).toBe(true);
  });

  it("rifiuta email non autorizzate", () => {
    expect(isConsultazioneEmailAllowed("x@gmail.com")).toBe(false);
    expect(isConsultazioneEmailAllowed("@consulbrokers.it")).toBe(false);
    expect(isConsultazioneEmailAllowed("consulbrokers.it")).toBe(false);
    expect(isConsultazioneEmailAllowed("user@unknown.it")).toBe(false);
  });

  it("normalizza email e estrae dominio", () => {
    expect(normalizeConsultazioneEmail("  Foo@ConsulBrokers.it ")).toBe("foo@consulbrokers.it");
    expect(getEmailDomain("a@Exebroker.IT")).toBe("exebroker.it");
  });

  it("whitelist contiene tutti i partner", () => {
    const expected = [
      "consulbrokers.it",
      "exebroker.it",
      "probroker.it",
      "dibroker.it",
    ];
    for (const d of expected) {
      expect(CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS).toContain(d);
    }
  });
});
