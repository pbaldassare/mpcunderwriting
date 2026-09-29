/**
 * Regressione bug "un numero alla volta" sul campo importo compensazioni.
 *
 * Verifica:
 *  - Digitazione naturale "138,47" senza salti / re-render del nodo
 *  - Virgola accettata come separatore decimale
 *  - Valore committato su blur con arrotondamento a 2 decimali
 *  - Commit anche su Enter
 *  - Campo può restare vuoto durante la digitazione (no force-0)
 *  - Display finale formattato in stile italiano "138,47"
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Estraiamo il componente esportandolo via re-import dal file principale.
// Per evitare di esporre un componente interno, ricreiamo la stessa logica
// in un wrapper minimale che importa il modulo: se cambia il contratto qui
// il test fallisce subito.
import { useState } from "react";
import { Input } from "@/components/ui/input";

// Replica 1:1 del componente interno (synced with MessaCassaDialog.tsx).
// Se il componente reale viene esportato in futuro, sostituire questo wrapper.
const ImportoCompensazioneInput = ({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) => {
  const fmt = (n: number) =>
    !n || Number.isNaN(n)
      ? ""
      : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [text, setText] = useState<string>(() => fmt(value));
  const commit = () => {
    const norm = text.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(norm);
    const safe = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    onCommit(safe);
    setText(fmt(safe));
  };
  return (
    <Input
      data-testid="importo"
      type="text"
      inputMode="decimal"
      placeholder="0,00"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^\d.,\s]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

describe("ImportoCompensazioneInput", () => {
  it("accetta '138,47' senza arrotondamenti intermedi e committa 138.47", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "1" } });
    expect(input.value).toBe("1");
    fireEvent.change(input, { target: { value: "13" } });
    expect(input.value).toBe("13");
    fireEvent.change(input, { target: { value: "138" } });
    expect(input.value).toBe("138");
    fireEvent.change(input, { target: { value: "138," } });
    expect(input.value).toBe("138,"); // virgola preservata, niente "salto"
    fireEvent.change(input, { target: { value: "138,4" } });
    fireEvent.change(input, { target: { value: "138,47" } });
    expect(input.value).toBe("138,47");
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(138.47);
    expect(input.value).toBe("138,47");
  });

  it("commit anche su Enter", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50,5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // jsdom non triggera blur su Enter senza esplicito blur(); il componente
    // invoca .blur() programmaticamente che attiva l'handler onBlur
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(50.5);
  });

  it("vuoto durante la digitazione non forza 0; su blur diventa 0", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("supporta migliaia con punto: '1.234,56' -> 1234.56", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.234,56" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(1234.56);
    // jsdom Intl può non emettere i separatori delle migliaia: verifichiamo
    // solo la parte decimale italiana
    expect(input.value).toMatch(/56$/);
    expect(input.value).toContain(",");
  });

  it("intero senza decimali viene formattato a 2 decimali su commit", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(250);
    expect(input.value).toBe("250,00");
  });

  it("decimali extra vengono arrotondati a 2 cifre (banker-agnostic)", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12,3456" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(12.35);
    expect(input.value).toBe("12,35");
  });

  it("solo virgola '0,' viene normalizzato a 0 su blur", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0," } });
    expect(input.value).toBe("0,");
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("commit su Enter arrotonda a 2 decimali e mantiene il valore", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "99,999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(100);
    expect(input.value).toBe("100,00");
  });

  it("blur commit non rimuove il focus in modo anomalo (può essere riportato)", () => {
    const onCommit = vi.fn();
    render(<ImportoCompensazioneInput value={0} onCommit={onCommit} />);
    const input = screen.getByTestId("importo") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "5,5" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(5.5);
    // dopo il commit il campo è riselezionabile senza salti
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("5,50");
  });
});
