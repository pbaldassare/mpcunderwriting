import { describe, it, expect } from "vitest";
import type { NuovoClienteInitialData } from "@/components/clienti/NuovoClienteDialog";
import type { MatchResult } from "@/components/polizze/ImportNuovaPolizzaAIDialog";

/**
 * Replica della logica di mapping "AI → NuovoClienteInitialData" usata in
 * `ImmissionePolizzaPage.handleAIImportApply` quando il cliente non esiste.
 * Verifica che i campi obbligatori (gruppo finanziario, CIG) NON vengano
 * mai preimpostati: devono essere completati dall'utente nel dialog.
 */
function buildPrefill(m: MatchResult): NuovoClienteInitialData {
  const d = m.data;
  const piva = (d.contraente_partita_iva || "").trim();
  const cf = (d.contraente_codice_fiscale || "").trim().toUpperCase();
  const isAzienda = !!piva || (!!cf && cf.length === 11);
  return {
    tipoCliente: m.tipoCliente ?? (isAzienda ? "azienda" : "privato"),
    ragioneSociale: isAzienda ? d.contraente_nome : undefined,
    nome: !isAzienda ? d.contraente_nome : undefined,
    codiceFiscale: cf || undefined,
    partitaIva: piva || undefined,
    email: d.contraente_email,
    telefono: d.contraente_telefono,
    indirizzo: d.contraente_indirizzo,
    cap: d.contraente_cap,
    citta: d.contraente_comune,
    provincia: d.contraente_provincia,
    nazione: d.contraente_nazione,
    gruppoFinanziarioId: m.gruppoFinanziarioId,
    codiceCig: m.codiceCig,
  };
}

/**
 * Replica della logica di gating "Applica" del dialog AI:
 * isNewCliente richiede sempre Gruppo Finanziario; Enti richiedono anche CIG.
 */
function canApplyAi(m: MatchResult): boolean {
  if (!m.isNewCliente) return true;
  if (!m.gruppoFinanziarioId) return false;
  if (m.tipoCliente === "ente" && !(m.codiceCig || "").trim()) return false;
  return true;
}

describe("AI import → NuovoClienteDialog prefill", () => {
  it("classifica come AZIENDA quando c'è P.IVA", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "ACME SRL", contraente_partita_iva: "12345678901" },
    });
    expect(p.tipoCliente).toBe("azienda");
    expect(p.ragioneSociale).toBe("ACME SRL");
    expect(p.partitaIva).toBe("12345678901");
    expect(p.nome).toBeUndefined();
  });

  it("classifica come AZIENDA quando il CF è di 11 cifre (numerico)", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Beta Spa", contraente_codice_fiscale: "12345678901" },
    });
    expect(p.tipoCliente).toBe("azienda");
    expect(p.ragioneSociale).toBe("Beta Spa");
  });

  it("classifica come PRIVATO con CF di 16 caratteri", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Mario Rossi", contraente_codice_fiscale: "rssmra80a01h501u" },
    });
    expect(p.tipoCliente).toBe("privato");
    expect(p.codiceFiscale).toBe("RSSMRA80A01H501U");
    expect(p.nome).toBe("Mario Rossi");
    expect(p.ragioneSociale).toBeUndefined();
  });

  it("non preimposta gruppo finanziario o codice CIG quando l'AI non li include (devono restare undefined)", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Comune di Varese", contraente_partita_iva: "00441340121" },
    });
    expect(p.gruppoFinanziarioId).toBeUndefined();
    expect(p.codiceCig).toBeUndefined();
  });

  it("propaga gruppoFinanziarioId, tipoCliente e codiceCig quando scelti nel dialog AI (Ente)", () => {
    const p = buildPrefill({
      isNewCliente: true,
      tipoCliente: "ente",
      gruppoFinanziarioId: "gf-uuid-123",
      codiceCig: "C12E34567",
      data: { contraente_nome: "Comune di Roma", contraente_partita_iva: "02438750586" },
    });
    expect(p.tipoCliente).toBe("ente");
    expect(p.gruppoFinanziarioId).toBe("gf-uuid-123");
    expect(p.codiceCig).toBe("C12E34567");
    expect(p.ragioneSociale).toBe("Comune di Roma");
  });
});

describe("AI import → gating Applica", () => {
  it("blocca Applica quando isNewCliente e manca gruppoFinanziarioId", () => {
    expect(
      canApplyAi({
        isNewCliente: true,
        data: { contraente_nome: "X" },
      }),
    ).toBe(false);
  });

  it("blocca Applica quando Ente senza Codice CIG", () => {
    expect(
      canApplyAi({
        isNewCliente: true,
        tipoCliente: "ente",
        gruppoFinanziarioId: "gf-1",
        data: { contraente_nome: "X" },
      }),
    ).toBe(false);
  });

  it("permette Applica quando GF presente e tipo non-Ente", () => {
    expect(
      canApplyAi({
        isNewCliente: true,
        tipoCliente: "azienda",
        gruppoFinanziarioId: "gf-1",
        data: { contraente_nome: "X" },
      }),
    ).toBe(true);
  });

  it("permette Applica quando Ente con CIG valorizzato", () => {
    expect(
      canApplyAi({
        isNewCliente: true,
        tipoCliente: "ente",
        gruppoFinanziarioId: "gf-1",
        codiceCig: "ABC123",
        data: { contraente_nome: "X" },
      }),
    ).toBe(true);
  });

  it("permette Applica quando il cliente è esistente (non nuovo)", () => {
    expect(
      canApplyAi({
        isNewCliente: false,
        cliente: { id: "x", label: "Y" },
        data: {},
      }),
    ).toBe(true);
  });
});

/**
 * Replica della logica "fallback identità incompleta" usata in handleAIImportApply:
 * quando l'AI non estrae né nome né CF né P.IVA, mostriamo un toast di avviso
 * ma APRIAMO comunque il NuovoClienteDialog (vuoto) così l'utente può completare
 * a mano i campi obbligatori (Gruppo Finanziario in primis).
 */
type AiOpenAction = {
  toastWarning?: string;
  openDialog: boolean;
  prefill: NuovoClienteInitialData;
};

function planAiClienteOpen(m: MatchResult): AiOpenAction | null {
  if (!m.isNewCliente) return null;
  const d = m.data;
  const piva = (d.contraente_partita_iva || "").trim();
  const cf = (d.contraente_codice_fiscale || "").trim().toUpperCase();
  const nome = (d.contraente_nome || "").trim();
  const hasMinimalIdentity = !!nome || !!cf || !!piva;
  return {
    toastWarning: hasMinimalIdentity
      ? undefined
      : "Dati cliente incompleti dal PDF: compila manualmente nome/ragione sociale, CF/P.IVA e il Gruppo Finanziario.",
    openDialog: true,
    prefill: buildPrefill(m),
  };
}

describe("AI import → fallback dati incompleti", () => {
  it("emette il toast di warning e apre comunque il dialog quando mancano nome, CF e P.IVA", () => {
    const action = planAiClienteOpen({
      isNewCliente: true,
      data: {
        // solo dati polizza, nessun identificativo cliente
        numero_polizza: "ABC123",
        compagnia: "Generali",
      },
    });
    expect(action).not.toBeNull();
    expect(action!.openDialog).toBe(true);
    expect(action!.toastWarning).toMatch(/incompleti/i);
    expect(action!.prefill.nome).toBeUndefined();
    expect(action!.prefill.ragioneSociale).toBeUndefined();
    expect(action!.prefill.codiceFiscale).toBeUndefined();
    expect(action!.prefill.partitaIva).toBeUndefined();
  });

  it("NON emette il toast quando c'è almeno un identificativo (CF o P.IVA o nome)", () => {
    const action = planAiClienteOpen({
      isNewCliente: true,
      data: { contraente_nome: "Mario Rossi" },
    });
    expect(action!.toastWarning).toBeUndefined();
    expect(action!.openDialog).toBe(true);
  });

  it("ritorna null se non è un nuovo cliente", () => {
    const action = planAiClienteOpen({
      isNewCliente: false,
      data: { contraente_nome: "X" },
      cliente: { id: "abc", label: "X" },
    });
    expect(action).toBeNull();
  });
});
