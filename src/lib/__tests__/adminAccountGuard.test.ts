import { describe, expect, it } from "vitest";
import { canModifyAccount, isAdminAccount, isRootAdminEmail } from "../adminAccountGuard";

describe("adminAccountGuard", () => {
  const root = { id: "root", email: "admin@mpc.it" };
  const peer = { id: "peer", email: "altro@mpc.it", ruolo: "admin", ruoli_rls: ["admin"] };
  const staff = { id: "staff", email: "sede@mpc.it", ruolo: "ufficio", ruoli_rls: ["ufficio"] };

  it("riconosce solo admin@mpc.it come account principale", () => {
    expect(isRootAdminEmail("admin@mpc.it")).toBe(true);
    expect(isRootAdminEmail(" Admin@MPC.it ")).toBe(true);
    expect(isRootAdminEmail("altro@mpc.it")).toBe(false);
  });

  it("considera admin il ruolo applicativo, quello di sistema o l'email principale", () => {
    expect(isAdminAccount({ ruolo: "admin" })).toBe(true);
    expect(isAdminAccount({ ruolo: "ufficio", ruoli_rls: ["admin"] })).toBe(true);
    expect(isAdminAccount({ email: "admin@mpc.it", ruolo: "ufficio" })).toBe(true);
    expect(isAdminAccount(staff)).toBe(false);
  });

  it("impedisce a un admin di modificare un altro admin", () => {
    expect(canModifyAccount(peer, root)).toBe(false);
    expect(canModifyAccount(peer, { id: "altro", ruolo: "admin", email: "due@mpc.it" })).toBe(false);
  });

  it("lascia modificare gli altri admin solo ad admin@mpc.it", () => {
    expect(canModifyAccount(root, peer)).toBe(true);
  });

  it("lascia modificare il proprio account e gli account non admin", () => {
    expect(canModifyAccount(peer, peer)).toBe(true);
    expect(canModifyAccount(peer, staff)).toBe(true);
  });
});
