---
name: Scorciatoie da tastiera globali
description: Hook useKeyboardShortcuts + componente GlobalShortcuts con overlay di help (?) e sequenze stile Gmail (g+c, n+p, ecc.).
type: feature
---

## Hook `useKeyboardShortcuts(shortcuts: ShortcutDef[])`

`src/hooks/useKeyboardShortcuts.ts` — registra shortcut globali. Supporta:
- Combo singolo: `"shift+?"`, `"mod+k"` (`mod` = ⌘ su Mac, Ctrl altrove)
- Sequenze stile Gmail: `"g c"` (premi g, poi c entro 1.2s)
- Disabilitato automaticamente quando il focus è su input/textarea/contentEditable (salvo `allowInInput: true`)

## `GlobalShortcuts`

`src/components/GlobalShortcuts.tsx` — montato in `MainLayout`. Registra:
- **Vai a**: `g d` Dashboard, `g c` Clienti, `g p` Polizze attive, `g k` Carico, `g s` Sinistri, `g t` Trattative, `g a` Compagnie, `g r` Report
- **Crea**: `n p` polizza, `n c` cliente, `n t` trattativa, `n s` sinistro
- **Aiuto**: `?` apre overlay con tabella completa

L'overlay è un `Dialog` con le combo formattate come `<kbd>` separati da "poi" per sequenze.

## Convenzioni

- ⌘K / Ctrl+K resta riservato al Command Palette (gestito altrove).
- Per aggiungere nuove shortcut globali, estendi l'array in `GlobalShortcuts.tsx`. Per shortcut locali a una pagina, usa direttamente l'hook `useKeyboardShortcuts` nel componente.
