import { useEffect, useRef } from "react";

/** Modificatori richiesti per uno shortcut. */
export interface ShortcutDef {
  /** Combinazione: es. "?", "n", "g c" (sequenza), "mod+k". `mod` = ⌘ su Mac, Ctrl altrove. */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Descrizione mostrata nell'help overlay. */
  description: string;
  /** Categoria per raggruppare nell'help. */
  category?: string;
  /** Se true esegue anche quando il focus è su input/textarea. Default false. */
  allowInInput?: boolean;
}

const SEQ_TIMEOUT_MS = 1200;

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
}

function matchCombo(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const key = e.key.toLowerCase();
  const wantsMod = parts.includes("mod");
  const wantsShift = parts.includes("shift");
  const wantsAlt = parts.includes("alt");
  const main = parts.filter((p) => !["mod", "shift", "alt", "ctrl", "meta"].includes(p)).join("+");
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modOk = wantsMod ? (isMac ? e.metaKey : e.ctrlKey) : !(e.metaKey || e.ctrlKey);
  return (
    modOk &&
    e.shiftKey === wantsShift &&
    e.altKey === wantsAlt &&
    key === main
  );
}

/**
 * Hook globale per registrare shortcut da tastiera, comprese sequenze
 * stile Gmail (es. "g c" = vai a Clienti).
 *
 * Le shortcut con un solo carattere (lettera/?) sono ignorate se il
 * focus è su input/textarea (a meno di allowInInput).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    let seqBuffer: string[] = [];
    let seqTimer: number | null = null;

    const resetSeq = () => {
      seqBuffer = [];
      if (seqTimer) { window.clearTimeout(seqTimer); seqTimer = null; }
    };

    const handler = (e: KeyboardEvent) => {
      // Ignora modificatori da soli
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

      const typing = isTypingTarget(e.target);

      for (const s of ref.current) {
        const combo = s.combo.trim();
        // Sequenza tipo "g c"
        if (combo.includes(" ")) {
          if (typing && !s.allowInInput) continue;
          const expected = combo.toLowerCase().split(/\s+/);
          const next = [...seqBuffer, e.key.toLowerCase()];
          // match progressivo
          const matchesPrefix = expected.slice(0, next.length).every((k, i) => k === next[i]);
          if (!matchesPrefix) continue;
          if (next.length === expected.length) {
            e.preventDefault();
            resetSeq();
            s.handler(e);
            return;
          }
          // accumula e attendi
          seqBuffer = next;
          if (seqTimer) window.clearTimeout(seqTimer);
          seqTimer = window.setTimeout(resetSeq, SEQ_TIMEOUT_MS);
          return;
        }
        // Combo singolo
        if (matchCombo(combo, e)) {
          if (typing && !s.allowInInput) continue;
          e.preventDefault();
          resetSeq();
          s.handler(e);
          return;
        }
      }
      // Tasto non corrisponde a nessuna sequenza in corso → reset
      if (seqBuffer.length) resetSeq();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
