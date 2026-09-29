import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessaCassaProvvigioniDisplay } from "@/components/portafoglio/MessaCassaProvvigioniDisplay";
import { fmtEuro } from "@/lib/formatCurrency";

describe("MessaCassaProvvigioniDisplay", () => {
  it("mostra le label esatte e gli importi in € italiani", () => {
    render(<MessaCassaProvvigioniDisplay attive={1355.99} passive={677.99} />);
    expect(screen.getByText("Provvigioni attive")).toBeInTheDocument();
    expect(screen.getByText("Provvigioni passive")).toBeInTheDocument();
    const box = screen.getByTestId("messa-cassa-provvigioni");
    expect(box.textContent).toContain("1355,99");
    expect(box.textContent).toContain("677,99");
    expect(box.textContent).toMatch(/€/);
    expect(fmtEuro(1355.99)).toMatch(/1355,99/);
  });
});
