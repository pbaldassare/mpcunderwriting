import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SUSPENDED_MESSAGE,
  isAccountSuspended,
  resolveProfileAfterFetch,
  shouldRefetchProfileOnAuthEvent,
} from "../authProfile";

describe("resolveProfileAfterFetch", () => {
  it("tiene il profilo corrente se il fetch fallisce", () => {
    const current = { id: "u1" };
    expect(resolveProfileAfterFetch(current, null, { message: "timeout" })).toEqual({
      profile: current,
      confirmedMissing: false,
    });
  });

  it("accetta i dati nuovi", () => {
    const next = { id: "u2" };
    expect(resolveProfileAfterFetch({ id: "u1" }, next, null)).toEqual({
      profile: next,
      confirmedMissing: false,
    });
  });

  it("marca assenza confermata solo se non c'è riga e non c'è errore", () => {
    expect(resolveProfileAfterFetch({ id: "u1" }, null, null)).toEqual({
      profile: null,
      confirmedMissing: true,
    });
  });
});

describe("isAccountSuspended", () => {
  it("blocca solo gli account con attivo false", () => {
    expect(isAccountSuspended(false)).toBe(true);
    expect(isAccountSuspended(true)).toBe(false);
    expect(isAccountSuspended(null)).toBe(false);
    expect(isAccountSuspended(undefined)).toBe(false);
    expect(ACCOUNT_SUSPENDED_MESSAGE).toBe("Il tuo account è stato sospeso");
  });
});

describe("shouldRefetchProfileOnAuthEvent", () => {
  it("non ricarica il profilo sul refresh token", () => {
    expect(shouldRefetchProfileOnAuthEvent("TOKEN_REFRESHED")).toBe(false);
    expect(shouldRefetchProfileOnAuthEvent("SIGNED_OUT")).toBe(false);
    expect(shouldRefetchProfileOnAuthEvent("SIGNED_IN")).toBe(true);
    expect(shouldRefetchProfileOnAuthEvent("INITIAL_SESSION")).toBe(true);
    expect(shouldRefetchProfileOnAuthEvent("USER_UPDATED")).toBe(true);
  });
});
