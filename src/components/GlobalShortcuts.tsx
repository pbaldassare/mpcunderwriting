import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useKeyboardShortcuts, type ShortcutDef } from "@/hooks/useKeyboardShortcuts";

/**
 * Registra le scorciatoie globali di Consulnet e mostra l'overlay di
 * help quando l'utente preme "?".
 *
 * Convenzione:
 *   ⌘K / Ctrl+K   → command palette (già gestita altrove)
 *   ?             → mostra questo help
 *   g + lettera   → navigazione ("go to")
 *   n + lettera   → nuovo record
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const shortcuts: ShortcutDef[] = [
    { combo: "shift+?", description: "Mostra questa guida", category: "Aiuto", handler: () => setHelpOpen((v) => !v) },

    { combo: "g d", description: "Dashboard", category: "Vai a", handler: () => navigate("/") },
    { combo: "g c", description: "Clienti", category: "Vai a", handler: () => navigate("/clienti") },
    { combo: "g p", description: "Polizze attive", category: "Vai a", handler: () => navigate("/portafoglio/attive") },
    { combo: "g k", description: "Incassi", category: "Vai a", handler: () => navigate("/portafoglio/incassi") },
    { combo: "g b", description: "Bonifici", category: "Vai a", handler: () => navigate("/contabilita/caricamento-mov-bancari?tab=da-ricongiungere") },
    { combo: "g s", description: "Sinistri", category: "Vai a", handler: () => navigate("/sinistri") },
    { combo: "g t", description: "Trattative", category: "Vai a", handler: () => navigate("/trattative") },
    { combo: "g a", description: "Compagnie", category: "Vai a", handler: () => navigate("/compagnie") },
    { combo: "g r", description: "Cruscotto Direzione", category: "Vai a", handler: () => navigate("/cruscotto-direzione") },

    { combo: "n p", description: "Nuova polizza", category: "Crea", handler: () => navigate("/portafoglio/nuova") },
    { combo: "n c", description: "Nuovo cliente", category: "Crea", handler: () => navigate("/clienti?new=1") },
    { combo: "n t", description: "Nuova trattativa", category: "Crea", handler: () => navigate("/trattative?new=1") },
    { combo: "n s", description: "Nuovo sinistro", category: "Crea", handler: () => navigate("/sinistri?new=1") },
  ];

  useKeyboardShortcuts(shortcuts);

  const grouped = shortcuts.reduce<Record<string, ShortcutDef[]>>((acc, s) => {
    const k = s.category || "Generale";
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  const renderCombo = (combo: string) =>
    combo.split(" ").map((token, i) => (
      <span key={i} className="inline-flex items-center gap-1">
        {i > 0 && <span className="text-muted-foreground text-xs">poi</span>}
        {token.split("+").map((k, j) => (
          <kbd
            key={j}
            className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono font-semibold"
          >
            {k === "mod" ? (navigator.platform.includes("Mac") ? "⌘" : "Ctrl") : k === "shift" ? "⇧" : k.toUpperCase()}
          </kbd>
        ))}
      </span>
    ));

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scorciatoie da tastiera</DialogTitle>
          <DialogDescription>
            Premi <kbd className="px-1 py-0.5 rounded border bg-muted text-[11px] font-mono">?</kbd> in qualsiasi pagina per riaprire questa guida.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{cat}</h4>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li key={s.combo} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.description}</span>
                    <span className="flex items-center gap-1">{renderCombo(s.combo)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ricerca</h4>
            <ul className="space-y-1.5">
              <li className="flex items-center justify-between gap-3 text-sm">
                <span>Command palette / Ricerca globale</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono font-semibold">
                    {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono font-semibold">K</kbd>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GlobalShortcuts;
