import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CbBotPage from "@/pages/cb-bot/CbBotPage";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const result = Promise.resolve({ count: 0, error: null, data: [] });
      return {
        select: () =>
          Object.assign(result, {
            eq: () => result,
          }),
      };
    },
  },
}));

vi.mock("@/components/documentale/AssistenteGaranzieSection", () => ({
  default: () => <div>Assistente CB Bot</div>,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CbBotPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CbBotPage", () => {
  it("mostra l'assistente e non crasha senza randomUUID", () => {
    vi.stubGlobal("crypto", {});
    renderPage();
    expect(screen.getByRole("heading", { name: "CB Bot" })).toBeInTheDocument();
    expect(screen.getByText("Assistente CB Bot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fonti siti/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
