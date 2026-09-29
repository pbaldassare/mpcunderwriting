import { describe, expect, it } from "vitest";
import {
  SISTEMA_ADMIN_ONLY_PATHS,
  SISTEMA_SEDE_ALLOWED_ROLES,
  canAccessSistema,
  canChangeTemplateSede,
  canEditGlobalBranding,
  canEditTemplate,
  canManageTemplateCategorie,
  filterTemplatesPerSede,
  forceUfficioIdForSave,
  isSedeSistemaRole,
  lockedSedeUfficioId,
  sistemaChildVisible,
} from "@/lib/sistemaSede";

const sd = "327e92f7-64f0-48b9-9e48-73611d8cb406";
const templates = [
  { id: "g", ufficio_id: null },
  { id: "sd", ufficio_id: sd },
  { id: "rm", ufficio_id: "roma" },
];

describe("sistemaSede", () => {
  it("include i ruoli sede e l'admin tra chi accede a Sistema", () => {
    expect(canAccessSistema("admin")).toBe(true);
    expect(canAccessSistema("ufficio")).toBe(true);
    expect(canAccessSistema("backoffice")).toBe(true);
    expect(canAccessSistema("contabilita")).toBe(true);
    expect(canAccessSistema("responsabile_sede")).toBe(true);
    expect(canAccessSistema("cfo")).toBe(false);
    expect(canAccessSistema("produttore")).toBe(false);
    expect(SISTEMA_SEDE_ALLOWED_ROLES).toContain("admin");
    expect(isSedeSistemaRole("ufficio")).toBe(true);
    expect(isSedeSistemaRole("admin")).toBe(false);
  });

  it("nasconde Anomalie/Backup/Sitemap alle sedi", () => {
    for (const path of SISTEMA_ADMIN_ONLY_PATHS) {
      expect(sistemaChildVisible(path, { ruolo: "ufficio", adminOnly: true })).toBe(false);
      expect(sistemaChildVisible(path, { ruolo: "admin", adminOnly: true })).toBe(true);
    }
    expect(sistemaChildVisible("/tabelle-base", { ruolo: "ufficio" })).toBe(true);
    expect(sistemaChildVisible("/template", { ruolo: "ufficio" })).toBe(true);
  });

  it("filtra i template alla propria sede + globali", () => {
    const sede = filterTemplatesPerSede(templates, { ruolo: "ufficio", ufficioId: sd });
    expect(sede.map((t) => t.id)).toEqual(["g", "sd"]);
    const admin = filterTemplatesPerSede(templates, { ruolo: "admin", ufficioId: sd });
    expect(admin).toHaveLength(3);
  });

  it("consente edit/delete solo sui template della propria sede", () => {
    const scope = { ruolo: "ufficio" as const, ufficioId: sd };
    expect(canEditTemplate({ ufficio_id: sd }, scope)).toBe(true);
    expect(canEditTemplate({ ufficio_id: null }, scope)).toBe(false);
    expect(canEditTemplate({ ufficio_id: "roma" }, scope)).toBe(false);
    expect(canEditTemplate({ ufficio_id: null }, { ruolo: "admin" })).toBe(true);
  });

  it("blocca categorie, cambio sede e branding globale alle sedi", () => {
    expect(canManageTemplateCategorie("ufficio")).toBe(false);
    expect(canManageTemplateCategorie("admin")).toBe(true);
    expect(canChangeTemplateSede("ufficio")).toBe(false);
    expect(canChangeTemplateSede("admin")).toBe(true);
    expect(canEditGlobalBranding("ufficio")).toBe(false);
    expect(canEditGlobalBranding("admin")).toBe(true);
  });

  it("forza ufficio_id della sede in salvataggio/duplica", () => {
    expect(forceUfficioIdForSave(null, { ruolo: "ufficio", ufficioId: sd })).toBe(sd);
    expect(forceUfficioIdForSave("roma", { ruolo: "ufficio", ufficioId: sd })).toBe(sd);
    expect(forceUfficioIdForSave(null, { ruolo: "admin", ufficioId: sd })).toBeNull();
    expect(forceUfficioIdForSave("roma", { ruolo: "admin" })).toBe("roma");
  });

  it("blocca il selettore sede per i non-admin", () => {
    expect(lockedSedeUfficioId({ ruolo: "admin", ufficioId: sd })).toBeUndefined();
    expect(lockedSedeUfficioId({ ruolo: "ufficio", ufficioId: sd })).toBe(sd);
    expect(lockedSedeUfficioId({ ruolo: "backoffice", ufficioId: null })).toBeNull();
  });
});
