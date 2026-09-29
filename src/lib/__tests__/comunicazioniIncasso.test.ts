import { describe, expect, it } from "vitest";
import {
  AZIONE_INCASSO_ERRORE,
  AZIONE_INCASSO_INVIATA,
  detectPresetPeriodo,
  endOfMonthISO,
  applyStatoProgrammato,
  codaScheduledInRange,
  filterComunicazioniByStato,
  formatAgenziaRiferimento,
  groupComunicazioniBySede,
  isoToRomeDate,
  labelStatoComunicazione,
  mapTitoloToComunicazione,
  normalizeDateRange,
  paginateComunicazioni,
  pickLogIncassoPreferito,
  rangeForPreset,
  resolveStatoIncasso,
  scheduledForByTitolo,
  startOfMonthISO,
  todayISODate,
  unwrapOne,
  type ComunicazioneIncassoRow,
} from "@/lib/comunicazioniIncasso";

const row = (partial: Partial<ComunicazioneIncassoRow>): ComunicazioneIncassoRow => ({
  titoloId: partial.titoloId || "t1",
  numeroPolizza: partial.numeroPolizza || "P1",
  clienteNome: partial.clienteNome || "Cliente",
  agenziaNome: partial.agenziaNome || "Agenzia",
  compagniaId: partial.compagniaId ?? "c1",
  ufficioId: partial.ufficioId ?? "u1",
  ufficioNome: partial.ufficioNome || "Sede A",
  dataMessaCassa: partial.dataMessaCassa ?? "2026-09-21",
  stato: partial.stato || "non_inviato",
  inviatoIl: partial.inviatoIl ?? null,
  documento: partial.documento ?? null,
});

describe("comunicazioniIncasso", () => {
  it("todayISODate usa il calendario locale senza UTC shift", () => {
    expect(todayISODate(new Date(2026, 8, 21, 23, 30))).toBe("2026-09-21");
    expect(todayISODate(new Date(2026, 0, 5, 0, 15))).toBe("2026-01-05");
  });

  it("preset Oggi e Mese corrente compilano Dal/Al", () => {
    const now = new Date(2026, 8, 21, 15, 0);
    expect(rangeForPreset("oggi", now)).toEqual({ da: "2026-09-21", a: "2026-09-21" });
    expect(rangeForPreset("mese_corrente", now)).toEqual({ da: "2026-09-01", a: "2026-09-30" });
    expect(startOfMonthISO(now)).toBe("2026-09-01");
    expect(endOfMonthISO(new Date(2026, 1, 10))).toBe("2026-02-28");
    expect(detectPresetPeriodo("2026-09-21", "2026-09-21", now)).toBe("oggi");
    expect(detectPresetPeriodo("2026-09-01", "2026-09-30", now)).toBe("mese_corrente");
    expect(detectPresetPeriodo("2026-09-01", "2026-09-21", now)).toBe("personalizzato");
    expect(normalizeDateRange("2026-09-30", "2026-09-01")).toEqual({ da: "2026-09-01", a: "2026-09-30" });
  });

  it("unwrapOne accetta oggetto o array PostgREST", () => {
    expect(unwrapOne({ nome: "A" })).toEqual({ nome: "A" });
    expect(unwrapOne([{ nome: "A" }, { nome: "B" }])).toEqual({ nome: "A" });
    expect(unwrapOne([])).toBeNull();
    expect(unwrapOne(null)).toBeNull();
  });

  it("formatAgenziaRiferimento preferisce il rapporto, poi compagnia, poi log", () => {
    expect(
      formatAgenziaRiferimento(
        { nome_rapporto: "ITAS Mutua — Leader", sede_denominazione: "Padova" },
        { nome: "ITAS" },
        "Log",
      ),
    ).toBe("ITAS Mutua — Leader");
    expect(formatAgenziaRiferimento(null, { nome: "ITAS" }, "Log")).toBe("ITAS");
    expect(formatAgenziaRiferimento(null, null, "Agenzia log")).toBe("Agenzia log");
    expect(formatAgenziaRiferimento(null, null, null)).toBe("—");
  });

  it("stato inviato solo con azione notifica inviata", () => {
    expect(resolveStatoIncasso(AZIONE_INCASSO_INVIATA)).toBe("inviato");
    expect(resolveStatoIncasso(AZIONE_INCASSO_ERRORE)).toBe("non_inviato");
    expect(resolveStatoIncasso(null)).toBe("non_inviato");
  });

  it("pickLogIncassoPreferito privilegia l'invio riuscito più recente", () => {
    const picked = pickLogIncassoPreferito([
      { entita_id: "t", azione: AZIONE_INCASSO_ERRORE, created_at: "2026-09-21T12:00:00Z", dettagli_json: null },
      { entita_id: "t", azione: AZIONE_INCASSO_INVIATA, created_at: "2026-09-21T10:00:00Z", dettagli_json: null },
      { entita_id: "t", azione: AZIONE_INCASSO_INVIATA, created_at: "2026-09-21T11:00:00Z", dettagli_json: null },
    ]);
    expect(picked?.created_at).toBe("2026-09-21T11:00:00Z");
    expect(pickLogIncassoPreferito([])).toBeNull();
  });

  it("mapTitoloToComunicazione compone riga lista", () => {
    const mapped = mapTitoloToComunicazione(
      {
        id: "tit-1",
        numero_titolo: "M168509899",
        data_messa_cassa: "2026-09-21",
        compagnia_id: "comp-1",
        compagnia_rapporto_id: "rap-1",
        ufficio_id: "uff-sandona",
        clienti: { ragione_sociale: "COMUNE CAMPOSAMPIERO" },
        compagnie: { nome: "ITAS" },
        compagnia_rapporti: { nome_rapporto: "Leader Assicurazioni" },
        uffici: { nome_ufficio: "SEDE SAN DONA' DI PIAVE" },
      },
      {
        entita_id: "tit-1",
        azione: AZIONE_INCASSO_INVIATA,
        created_at: "2026-09-21T08:15:00Z",
        dettagli_json: { inviato_il: "2026-09-21T08:15:12.000Z", agenzia: "Leader Assicurazioni" },
      },
      {
        id: "doc-1",
        nome_file: "Avviso.pdf",
        bucket_name: "documenti_titoli",
        path_storage: "incasso-notifiche/x/Avviso.pdf",
      },
    );
    expect(mapped.numeroPolizza).toBe("M168509899");
    expect(mapped.clienteNome).toBe("COMUNE CAMPOSAMPIERO");
    expect(mapped.agenziaNome).toBe("Leader Assicurazioni");
    expect(mapped.ufficioNome).toBe("SEDE SAN DONA' DI PIAVE");
    expect(mapped.stato).toBe("inviato");
    expect(mapped.inviatoIl).toBe("2026-09-21T08:15:12.000Z");
    expect(mapped.documento?.path_storage).toContain("incasso-notifiche");
  });

  it("considera inviato se c'è il PDF anche senza log", () => {
    const mapped = mapTitoloToComunicazione(
      {
        id: "tit-2",
        numero_titolo: "X",
        data_messa_cassa: "2026-09-21",
        compagnia_id: null,
        compagnia_rapporto_id: null,
        ufficio_id: "u1",
        clienti: { cognome: "Rossi", nome: "Mario" },
        compagnie: null,
        compagnia_rapporti: null,
        uffici: { nome_ufficio: "Sede A" },
      },
      null,
      {
        id: "doc-2",
        nome_file: "Avviso.pdf",
        bucket_name: "documenti_titoli",
        path_storage: "incasso-notifiche/y/Avviso.pdf",
        created_at: "2026-09-21T09:00:00Z",
      },
    );
    expect(mapped.stato).toBe("inviato");
    expect(mapped.clienteNome).toBe("Rossi Mario");
    expect(mapped.inviatoIl).toBe("2026-09-21T09:00:00Z");
  });

  it("filtra stato e raggruppa per sede", () => {
    const rows = [
      row({ titoloId: "1", stato: "inviato", ufficioId: "b", ufficioNome: "Belluno" }),
      row({ titoloId: "2", stato: "non_inviato", ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "3", stato: "inviato", ufficioId: "s", ufficioNome: "Sandonà" }),
      row({ titoloId: "4", stato: "programmato", ufficioId: "s", ufficioNome: "Sandonà" }),
    ];
    expect(filterComunicazioniByStato(rows, "inviato")).toHaveLength(2);
    expect(filterComunicazioniByStato(rows, "non_inviato")).toHaveLength(1);
    expect(filterComunicazioniByStato(rows, "programmato")).toHaveLength(1);
    const gruppi = groupComunicazioniBySede(rows);
    expect(gruppi.map((g) => g.sedeNome)).toEqual(["Belluno", "Sandonà"]);
    expect(gruppi[1].rows).toHaveLength(3);
  });

  it("label stato include Programmato", () => {
    expect(labelStatoComunicazione("inviato")).toBe("Inviato");
    expect(labelStatoComunicazione("non_inviato")).toBe("Non inviato");
    expect(labelStatoComunicazione("programmato")).toBe("Programmato");
  });

  it("coda serale: giorno civile italiano e mappa titolo → 19:30", () => {
    expect(isoToRomeDate("2026-09-22T17:30:00.000Z")).toBe("2026-09-22");
    expect(codaScheduledInRange("2026-09-22T17:30:00.000Z", "2026-09-22", "2026-09-22")).toBe(true);
    expect(codaScheduledInRange("2026-09-22T17:30:00.000Z", "2026-09-01", "2026-09-21")).toBe(false);
    const map = scheduledForByTitolo([
      { id: "c1", titolo_ids: ["t-a", "t-b"], scheduled_for: "2026-09-22T17:30:00.000Z", status: "pending" },
      { id: "c2", titolo_ids: ["t-a"], scheduled_for: "2026-09-22T17:35:00.000Z", status: "processing" },
      { id: "c3", titolo_ids: ["t-c"], scheduled_for: "2026-09-22T17:30:00.000Z", status: "sent" },
    ]);
    expect(map.get("t-a")).toBe("2026-09-22T17:30:00.000Z");
    expect(map.get("t-b")).toBe("2026-09-22T17:30:00.000Z");
    expect(map.has("t-c")).toBe(false);
  });

  it("applyStatoProgrammato non sovrascrive un inviato", () => {
    const inviato = row({ stato: "inviato", inviatoIl: "2026-09-22T10:00:00.000Z" });
    expect(applyStatoProgrammato(inviato, "2026-09-22T17:30:00.000Z").stato).toBe("inviato");
    const pending = applyStatoProgrammato(row({ stato: "non_inviato" }), "2026-09-22T17:30:00.000Z");
    expect(pending.stato).toBe("programmato");
    expect(pending.inviatoIl).toBe("2026-09-22T17:30:00.000Z");
    expect(applyStatoProgrammato(row({ stato: "non_inviato" }), undefined).stato).toBe("non_inviato");
  });

  it("pagina le righe", () => {
    const rows = [row({ titoloId: "a" }), row({ titoloId: "b" }), row({ titoloId: "c" })];
    expect(paginateComunicazioni(rows, 0, 2).map((r) => r.titoloId)).toEqual(["a", "b"]);
    expect(paginateComunicazioni(rows, 1, 2).map((r) => r.titoloId)).toEqual(["c"]);
  });
});
