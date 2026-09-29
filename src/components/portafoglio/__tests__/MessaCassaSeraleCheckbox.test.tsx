import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MESSA_CASSA_SERALE_HINT,
  MessaCassaSeraleCheckbox,
} from "@/components/portafoglio/MessaCassaSeraleCheckbox";

describe("MessaCassaSeraleCheckbox", () => {
  it("mostra la checkbox in alto a destra con hint accessibile", () => {
    render(
      <div className="relative">
        <MessaCassaSeraleCheckbox checked={false} onCheckedChange={vi.fn()} />
      </div>,
    );
    expect(screen.getByLabelText("Messa a cassa serale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MESSA_CASSA_SERALE_HINT })).toBeInTheDocument();
  });
});
