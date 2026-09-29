import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
};

/**
 * Scroll orizzontale in alto e in basso, sincronizzati.
 * Lo scroller alto compare solo se il contenuto è più largo del contenitore.
 */
export function TableScrollArea({ children, className, ...props }: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [needsHScroll, setNeedsHScroll] = useState(false);

  const measure = useCallback(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const table = bottom.querySelector("table");
    const width = Math.max(bottom.scrollWidth, table?.scrollWidth ?? 0, table?.offsetWidth ?? 0);
    setContentWidth(width);
    setNeedsHScroll(width > bottom.clientWidth + 2);
  }, []);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(bottom);
    const table = bottom.querySelector("table");
    if (table) ro.observe(table);

    const mo = new MutationObserver(() => measure());
    mo.observe(bottom, { childList: true, subtree: true, characterData: true });

    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const syncFrom = (source: "top" | "bottom") => {
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!top || !bottom) return;
    const from = source === "top" ? top : bottom;
    const to = source === "top" ? bottom : top;
    if (to.scrollLeft === from.scrollLeft) return;
    to.scrollLeft = from.scrollLeft;
  };

  return (
    <div className="relative w-full min-w-0" data-table-scroll-root="" {...props}>
      <div
        ref={topRef}
        data-table-h-scroll-top=""
        aria-hidden
        className={cn(
          "overflow-x-scroll overflow-y-hidden [scrollbar-gutter:stable]",
          "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40",
          needsHScroll ? "h-3.5 mb-0.5" : "hidden",
        )}
        onScroll={() => syncFrom("top")}
      >
        <div style={{ width: contentWidth || 1, height: 1 }} />
      </div>
      <div
        ref={bottomRef}
        data-table-h-scroll=""
        className={cn("relative w-full min-w-0 overflow-auto", className)}
        onScroll={() => syncFrom("bottom")}
      >
        {children}
      </div>
    </div>
  );
}
