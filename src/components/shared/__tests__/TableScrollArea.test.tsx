import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

class ResizeObserverMock {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe() {
    this.cb([] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function mockWidths(el: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: scrollWidth });
}

describe("TableScrollArea", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("MutationObserver", MutationObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nasconde lo scroller alto se la tabella entra nel contenitore", () => {
    const { container } = render(
      <TableScrollArea>
        <table>
          <tbody>
            <tr>
              <td>ok</td>
            </tr>
          </tbody>
        </table>
      </TableScrollArea>,
    );
    const bottom = container.querySelector("[data-table-h-scroll]") as HTMLElement;
    const table = container.querySelector("table") as HTMLElement;
    mockWidths(bottom, 400, 400);
    mockWidths(table, 400, 400);
    fireEvent(window, new Event("resize"));
    const top = container.querySelector("[data-table-h-scroll-top]");
    expect(top).toHaveClass("hidden");
  });

  it("mostra lo scroller alto e sincronizza lo scroll", () => {
    const { container } = render(
      <TableScrollArea>
        <table>
          <tbody>
            <tr>
              <td>largo</td>
            </tr>
          </tbody>
        </table>
      </TableScrollArea>,
    );
    const bottom = container.querySelector("[data-table-h-scroll]") as HTMLElement;
    const table = container.querySelector("table") as HTMLElement;
    const top = container.querySelector("[data-table-h-scroll-top]") as HTMLElement;
    mockWidths(bottom, 120, 480);
    mockWidths(table, 480, 480);
    fireEvent(window, new Event("resize"));
    expect(top).not.toHaveClass("hidden");

    bottom.scrollLeft = 55;
    fireEvent.scroll(bottom);
    expect(top.scrollLeft).toBe(55);

    top.scrollLeft = 12;
    fireEvent.scroll(top);
    expect(bottom.scrollLeft).toBe(12);
  });
});
