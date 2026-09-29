import { describe, expect, it } from "vitest";
import {
  applySedeFilter,
  detectPresetPeriodo,
  endOfMonthISO,
  filterPrimaNotaRows,
  groupPrimaNotaByAgenzia,
  groupPrimaNotaByCliente,
  groupPrimaNotaByClienteEAgenzia,
  groupPrimaNotaBySede,
  mapTitoloToPrimaNota,
  normalizeDateRange,
  paginatePrimaNota,
  primaNotaExportFilename,
  rangeForPreset,
  resolvePremioIncassato,
  resolveSedeLock,
  rowsForPrimaNotaExport,
  rowsToPrimaNotaSheet,
  sortPrimaNotaRows,
  startOfMonthISO,
  uniquePrimaNotaOptions,
  todayISODate,
  type PrimaNotaRow,
} from "@/lib/primaNota";

const row = (partial: Partial<PrimaNotaRow>): PrimaNotaRow => ({
  titoloId: partial.titoloId || "t1",
  numeroPolizza: partial.numeroPolizza || "P1",
  clienteNome: partial.clienteNome || "Cliente",
  clienteAnagraficaId: partial.clienteAnagraficaId ?? "cli-1",
  agenziaNome: partial.agenziaNome || "Agenzia",
  compagniaId: partial.compagniaId ?? "c1",
  ufficioId: partial.ufficioId ?? "u1",
  ufficioNome: partial.ufficioNome !== undefined ? partial.ufficioNome : "Sede A",
  premioIncassato: partial.premioIncassato ?? 100,
  dataIncasso: partial.dataIncasso ?? "2026-09-21",
});

describe("primaNota", () => {
  it("todayISODate e preset Oggi/Mese corrente come comunicazioni", () => {
    const now = new Date(2026, 8, 21, 15, 0);
    expect(todayISODate(now)).toBe("2026-09-21");
    expect(rangeForPreset("oggi", now)).toEqual({ da: "2026-09-21", a: "2026-09-21" });
    expect(rangeForPreset("mese_corrente", now)).toEqual({ da: "2026-09-01", a: "2026-09-30" });
    expect(startOfMonthISO(now)).toBe("2026-09-01");
    expect(endOfMonthISO(new Date(2026, 1, 10))).toBe("2026-02-28");
    expect(detectPresetPeriodo("2026-09-21", "2026-09-21", now)).toBe("oggi");
    expect(detectPresetPeriodo("2026-09-01", "2026-09-30", now)).toBe("mese_corrente");
    expect(detectPresetPeriodo("2026-09-01", "2026-09-21", now)).toBe("personalizzato");
    expect(normalizeDateRange("2026-09-30", "2026-09-01")).toEqual({ da: "2026-09-01", a: "2026-09-30" });
  });

  it("resolvePremioIncassato preferisce importo_incassato se > 0, altrimenti premio_lordo", () => {
    expect(resolvePremioIncassato({ importo_incassato: 348.5, premio_lordo: 400 })).toBe(348.5);
    expect(resolvePremioIncassato({ importo_incassato: 0, premio_lordo: 400 })).toBe(400);
    expect(resolvePremioIncassato({ importo_incassato: null, premio_lordo: 400 })).toBe(400);
    expect(resolvePremioIncassato({ premio_lordo: 250 })).toBe(250);
    expect(resolvePremioIncassato({})).toBeNull();
  });

  it("resolvePremioIncassato su garantito usa il lordo se incassato è 0", () => {
    expect(
      resolvePremioIncassato({
        importo_incassato: 0,
        premio_lordo: 1222.5,
        conferimento_gestito: true,
      }),
    ).toBe(1222.5);
    expect(
      resolvePremioIncassato({
        importo_incassato: 0,
        premio_lordo: 900,
        tipo_pagamento: "garantito",
      }),
    ).toBe(900);
    expect(
      resolvePremioIncassato({
        importo_incassato: 50,
        premio_lordo: 900,
        conferimento_gestito: true,
      }),
    ).toBe(50);
  });

  it("mapTitoloToPrimaNota compone riga lista", () => {
    const mapped = mapTitoloToPrimaNota({
      id: "tit-1",
      numero_titolo: "M168509899",
      data_messa_cassa: "2026-09-21",
      importo_incassato: 348.5,
      premio_lordo: 400,
      compagnia_id: "comp-1",
      compagnia_rapporto_id: "rap-1",
      ufficio_id: "uff-sandona",
      clienti: { ragione_sociale: "COMUNE CAMPOSAMPIERO" },
      compagnie: { nome: "ITAS" },
      compagnia_rapporti: { nome_rapporto: "Leader Assicurazioni" },
      uffici: { nome_ufficio: "SEDE SAN DONA' DI PIAVE" },
    });
    expect(mapped.numeroPolizza).toBe("M168509899");
    expect(mapped.clienteNome).toBe("COMUNE CAMPOSAMPIERO");
    expect(mapped.agenziaNome).toBe("Leader Assicurazioni");
    expect(mapped.ufficioNome).toBe("SEDE SAN DONA' DI PIAVE");
    expect(mapped.premioIncassato).toBe(348.5);
    expect(mapped.dataIncasso).toBe("2026-09-21");
    expect(mapped.clienteAnagraficaId).toBeNull();
  });

  it("mapTitoloToPrimaNota usa cognome+nome e premio_lordo se incassato assente", () => {
    const mapped = mapTitoloToPrimaNota({
      id: "tit-2",
      numero_titolo: "X",
      data_messa_cassa: "2026-09-21",
      importo_incassato: 0,
      premio_lordo: 199,
      compagnia_id: null,
      ufficio_id: "u1",
      clienti: { cognome: "Rossi", nome: "Mario" },
      compagnie: { nome: "ITAS" },
      compagnia_rapporti: null,
      uffici: { nome_ufficio: "Sede A" },
    });
    expect(mapped.clienteNome).toBe("Rossi Mario");
    expect(mapped.agenziaNome).toBe("ITAS");
    expect(mapped.premioIncassato).toBe(199);
  });

  it("raggruppa per sede in ordine alfabetico italiano", () => {
    const rows = [
      row({ titoloId: "1", ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "2", ufficioId: "b", ufficioNome: "Belluno" }),
      row({ titoloId: "3", ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "4", ufficioId: null, ufficioNome: "" }),
    ];
    const gruppi = groupPrimaNotaBySede(rows);
    expect(gruppi.map((g) => g.sedeNome)).toEqual(["Belluno", "Sandonà", "Sede non assegnata"]);
    expect(gruppi[1].rows).toHaveLength(2);
  });

  it("sede lock: admin/cfo vedono tutte, sede solo le proprie, senza auth non è ready", () => {
    expect(
      resolveSedeLock({ authLoading: false, isAdmin: true, ruolo: "admin", hasProfile: true, ufficioId: "u1" }),
    ).toEqual({ seeAllSedi: true, sedeLockedId: null, authReady: true });
    expect(
      resolveSedeLock({ authLoading: false, ruolo: "cfo", hasProfile: true, ufficioId: "u1" }),
    ).toEqual({ seeAllSedi: true, sedeLockedId: null, authReady: true });
    expect(
      resolveSedeLock({
        authLoading: false,
        ruolo: "ufficio",
        hasProfile: true,
        ufficioId: "uff-sandona",
      }),
    ).toEqual({ seeAllSedi: false, sedeLockedId: "uff-sandona", authReady: true });
    expect(
      resolveSedeLock({ authLoading: true, ruolo: "ufficio", hasProfile: true, ufficioId: "u1" }),
    ).toMatchObject({ authReady: false });
    expect(
      resolveSedeLock({ authLoading: false, ruolo: "ufficio", hasProfile: false, ufficioId: "u1" }),
    ).toMatchObject({ authReady: false, sedeLockedId: "u1" });
    expect(
      resolveSedeLock({ authLoading: false, ruolo: "ufficio", hasProfile: true, ufficioId: null }),
    ).toEqual({ seeAllSedi: false, sedeLockedId: null, authReady: false });
  });

  it("applySedeFilter tiene solo le righe della sede locked", () => {
    const rows = [
      row({ titoloId: "1", ufficioId: "sandona" }),
      row({ titoloId: "2", ufficioId: "roma" }),
      row({ titoloId: "3", ufficioId: "sandona" }),
    ];
    expect(applySedeFilter(rows, "sandona").map((r) => r.titoloId)).toEqual(["1", "3"]);
    expect(applySedeFilter(rows, null)).toHaveLength(3);
  });

  it("pagina le righe della sede, non quelle admin raggruppate", () => {
    const rows = [row({ titoloId: "a" }), row({ titoloId: "b" }), row({ titoloId: "c" })];
    expect(paginatePrimaNota(rows, 0, 2).map((r) => r.titoloId)).toEqual(["a", "b"]);
    expect(paginatePrimaNota(rows, 1, 2).map((r) => r.titoloId)).toEqual(["c"]);
  });

  it("export Excel: filename e colonne italiane, admin include Sede e tutti i gruppi", () => {
    expect(primaNotaExportFilename("2026-09-21", "2026-09-21")).toBe("prima-nota-2026-09-21.xlsx");
    expect(primaNotaExportFilename("2026-09-01", "2026-09-30")).toBe("prima-nota-2026-09-01_2026-09-30.xlsx");

    const rows = [
      row({
        titoloId: "2",
        numeroPolizza: "B",
        ufficioId: "s",
        ufficioNome: "Sandonà",
        premioIncassato: 10,
      }),
      row({
        titoloId: "1",
        numeroPolizza: "A",
        ufficioId: "b",
        ufficioNome: "Belluno",
        premioIncassato: 20,
        dataIncasso: "2026-09-21",
      }),
    ];
    const exported = rowsForPrimaNotaExport(rows, true);
    expect(exported.map((r) => r.ufficioNome)).toEqual(["Belluno", "Sandonà"]);

    const sheet = rowsToPrimaNotaSheet(exported, { includeSede: true });
    expect(Object.keys(sheet[0])).toEqual([
      "Sede",
      "N. polizza",
      "Nome cliente",
      "Agenzia",
      "Premio incassato",
      "Data incasso",
    ]);
    expect(sheet[0]["Sede"]).toBe("Belluno");
    expect(sheet[0]["N. polizza"]).toBe("A");
    expect(sheet[0]["Premio incassato"]).toBe(20);
    expect(sheet[0]["Data incasso"]).toBe("21/09/2026");

    const sedeSheet = rowsToPrimaNotaSheet(rowsForPrimaNotaExport(rows, false));
    expect(Object.keys(sedeSheet[0])).not.toContain("Sede");
    expect(sedeSheet).toHaveLength(2);
  });

  it("filtra, ordina e raggruppa per cliente/agenzia", () => {
    const rows = [
      row({
        titoloId: "1",
        numeroPolizza: "B2",
        clienteAnagraficaId: "c-a",
        clienteNome: "Rossi",
        compagniaId: "ag-1",
        agenziaNome: "ITAS",
        premioIncassato: 20,
        dataIncasso: "2026-09-02",
      }),
      row({
        titoloId: "2",
        numeroPolizza: "A1",
        clienteAnagraficaId: "c-b",
        clienteNome: "Bianchi",
        compagniaId: "ag-2",
        agenziaNome: "Unipol",
        premioIncassato: 10,
        dataIncasso: "2026-09-01",
      }),
      row({
        titoloId: "3",
        numeroPolizza: "C3",
        clienteAnagraficaId: "c-a",
        clienteNome: "Rossi",
        compagniaId: "ag-2",
        agenziaNome: "Unipol",
        premioIncassato: 30,
        dataIncasso: "2026-09-03",
      }),
    ];
    expect(filterPrimaNotaRows(rows, { clienteId: "c-a" }).map((r) => r.titoloId)).toEqual(["1", "3"]);
    expect(sortPrimaNotaRows(rows, "numeroPolizza", "asc").map((r) => r.numeroPolizza)).toEqual([
      "A1",
      "B2",
      "C3",
    ]);
    expect(sortPrimaNotaRows(rows, "premioIncassato", "desc").map((r) => r.premioIncassato)).toEqual([
      30, 20, 10,
    ]);
    expect(uniquePrimaNotaOptions(rows, "cliente").map((o) => o.label)).toEqual(["Bianchi", "Rossi"]);
    expect(groupPrimaNotaByCliente(rows).map((g) => g.label)).toEqual(["Bianchi", "Rossi"]);
    expect(groupPrimaNotaByAgenzia(rows).map((g) => g.label)).toEqual(["ITAS", "Unipol"]);
    const nested = groupPrimaNotaByClienteEAgenzia(rows);
    expect(nested.map((g) => g.label)).toEqual(["Bianchi", "Rossi"]);
    expect(nested[1].groups.map((g) => g.label)).toEqual(["ITAS", "Unipol"]);
  });
});
