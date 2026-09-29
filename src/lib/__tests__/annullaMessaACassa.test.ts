import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { annullaMessaACassa } from "../annullaMessaACassa";

describe("annullaMessaACassa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega alla RPC annulla_quietanza_incasso", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        provvigioni_eliminate: 2,
        movimenti_eliminati: 1,
        rata_successiva_eliminata: true,
      },
      error: null,
    });

    const res = await annullaMessaACassa("titolo-abc");
    expect(rpcMock).toHaveBeenCalledWith("annulla_quietanza_incasso", { p_titolo_id: "titolo-abc" });
    expect(res.ok).toBe(true);
    expect(res.provvigioniEliminate).toBe(2);
    expect(res.movimentiEliminati).toBe(1);
    expect(res.rataSuccessivaEliminata).toBe(true);
  });

  it("propaga errore RPC transport", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "DB down" } });
    const res = await annullaMessaACassa("titolo-1");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("DB down");
  });

  it("propaga errore business dalla RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, error: "Impossibile annullare: esistono provvigioni già pagate per questo titolo." },
      error: null,
    });
    const res = await annullaMessaACassa("titolo-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/provvigioni già pagate/i);
  });

  it("maappa tutti i contatori di rollback", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        provvigioni_eliminate: 3,
        pagamenti_righe_eliminate: 1,
        rimessa_dettagli_eliminati: 2,
        rimesse_testate_eliminate: 1,
        movimenti_eliminati: 4,
        anticipi_eliminati: 1,
        compensazioni_eliminate: 1,
        rata_successiva_eliminata: false,
        quietanze_aggiornate: 1,
        bonifici_riaperti: 2,
      },
      error: null,
    });

    const res = await annullaMessaACassa("titolo-x");
    expect(res).toEqual({
      ok: true,
      provvigioniEliminate: 3,
      pagamentiRigheEliminate: 1,
      rimessaDettagliEliminati: 2,
      rimesseTestateEliminate: 1,
      movimentiEliminati: 4,
      anticipiEliminati: 1,
      compensazioniEliminate: 1,
      rataSuccessivaEliminata: false,
      quietanzeAggiornate: 1,
      bonificiRiaperti: 2,
    });
  });
});
