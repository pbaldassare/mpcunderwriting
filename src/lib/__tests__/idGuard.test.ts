import { describe, expect, it } from "vitest";
import {
  extractDomain,
  firstValidEmail,
  formatDateTimeIT,
  isCooldownActive,
  isPrivatoCliente,
  isVerifyBlocked,
  mapIdGuardDomainResult,
  mapIdGuardEmailResult,
  nextVerificaAt,
  normalizeEmail,
  resolveClienteDisplayName,
  resolveIdGuardTarget,
  webhookEventTipo,
  webhookTarget,
} from "@/lib/idGuard";

describe("idGuard", () => {
  it("riconosce i privati e il nome da mostrare", () => {
    expect(isPrivatoCliente("privato")).toBe(true);
    expect(isPrivatoCliente("azienda")).toBe(false);
    expect(isPrivatoCliente("ente")).toBe(false);
    expect(resolveClienteDisplayName({ tipo_cliente: "privato", nome: "Mario", cognome: "Rossi" })).toBe(
      "Rossi Mario",
    );
    expect(resolveClienteDisplayName({ tipo_cliente: "azienda", ragione_sociale: "Acme Srl" })).toBe("Acme Srl");
  });

  it("normalizza email e dominio", () => {
    expect(normalizeEmail("  Mario.Rossi@Gmail.com ")).toBe("mario.rossi@gmail.com");
    expect(normalizeEmail("non-una-mail")).toBe(null);
    expect(extractDomain("mario@acme.it")).toBe("acme.it");
    expect(extractDomain("https://www.acme.it/contatti")).toBe("acme.it");
    expect(extractDomain("www.acme.it")).toBe("acme.it");
    expect(extractDomain("acme.it")).toBe("acme.it");
    expect(extractDomain("localhost")).toBe(null);
  });

  it("privato → email, azienda/ente → dominio", () => {
    expect(
      resolveIdGuardTarget({
        tipo_cliente: "privato",
        email: "mario@gmail.com",
        pec: "mario@pec.it",
      }),
    ).toEqual({ ok: true, tipo: "email", target: "mario@gmail.com" });

    expect(resolveIdGuardTarget({ tipo_cliente: "privato" })).toEqual({
      ok: false,
      tipo: "email",
      missing: "email",
    });

    expect(
      resolveIdGuardTarget({
        tipo_cliente: "azienda",
        email: "info@acme.it",
      }),
    ).toEqual({ ok: true, tipo: "domain", target: "acme.it" });

    expect(
      resolveIdGuardTarget({
        tipo_cliente: "ente",
        pec: "protocollo@comune.varese.it",
      }),
    ).toEqual({ ok: true, tipo: "domain", target: "comune.varese.it" });

    expect(resolveIdGuardTarget({ tipo_cliente: "azienda" })).toEqual({
      ok: false,
      tipo: "domain",
      missing: "domain",
    });
  });

  it("prende email o referente_email", () => {
    expect(firstValidEmail({ referente_email: "ref@acme.it" })).toBe("ref@acme.it");
  });

  it("cooldown 24h per riga", () => {
    const from = new Date("2026-09-23T08:00:00.000Z");
    const next = nextVerificaAt(from);
    expect(next.toISOString()).toBe("2026-09-24T08:00:00.000Z");
    expect(isCooldownActive(next, from)).toBe(true);
    expect(isCooldownActive(next, next)).toBe(false);
    expect(isCooldownActive(null, from)).toBe(false);
  });

  it("mappa esito email", () => {
    expect(
      mapIdGuardEmailResult({
        data: {
          isPwned: true,
          breachCount: 3,
          explanation: "3 breach",
          leakedData: ["Email addresses", "Passwords", "Phone numbers"],
        },
      }),
    ).toEqual({
      is_pwned: true,
      mail_esposte: 3,
      password_esposte: 1,
      breach_count: 3,
      explanation: "3 breach",
    });
  });

  it("conta le password da leakedData.counts (formato ID Guard)", () => {
    expect(
      mapIdGuardEmailResult({
        data: {
          isPwned: true,
          breachCount: 21,
          leakedData: {
            counts: { passwords: 5, usernames: 3, names: 2, addresses: 1, phones: 0 },
            passwords: ["a", "b", "c", "d", "e"],
          },
        },
      }).password_esposte,
    ).toBe(5);
  });

  it("l'admin non ha cooldown", () => {
    const next = nextVerificaAt(new Date("2026-09-23T08:00:00.000Z"));
    expect(isVerifyBlocked(next, { isAdmin: true, now: new Date("2026-09-23T08:00:00.000Z") })).toBe(false);
    expect(isVerifyBlocked(next, { isAdmin: false, now: new Date("2026-09-23T08:00:00.000Z") })).toBe(true);
  });

  it("mappa esito dominio", () => {
    expect(
      mapIdGuardDomainResult({
        data: { data: { totalLeaks: 128, uniqueEmails: 40, uniquePasswords: 12 } },
      }),
    ).toEqual({
      is_pwned: true,
      mail_esposte: 40,
      password_esposte: 12,
      breach_count: 128,
      explanation: null,
    });
  });

  it("formatta data/ora in italiano", () => {
    expect(formatDateTimeIT("2026-09-23T08:15:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{2,4}/);
  });

  it("estrae tipo e target dal webhook", () => {
    expect(webhookEventTipo("check.email.completed")).toBe("email");
    expect(webhookEventTipo("check.domain.completed")).toBe("domain");
    expect(webhookEventTipo("webhook.test")).toBe(null);
    expect(webhookTarget("email", { email: "Mario.Rossi@Gmail.com" })).toBe("mario.rossi@gmail.com");
    expect(webhookTarget("domain", { domain: "www.acme.it" })).toBe("acme.it");
  });
});
