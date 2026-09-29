---
name: Dark mode + print CSS
description: Tema light/dark/system con toggle in topbar (hook useTheme), token KPI/badge completati per dark mode, e CSS stampa che nasconde sidebar/topbar e ottimizza tabelle ed E/C.
type: design
---

## Tema

- Hook `useTheme()` in `src/hooks/useTheme.ts` — persistenza `localStorage` chiave `consulnet-theme`, valori `light | dark | system`, toggle ciclico.
- `ThemeToggle` montato in `Topbar.tsx` (icona Sun/Moon/Monitor).
- Tutti i token KPI (`--kpi-*`) e badge (`--badge-*`) hanno ora variante `.dark` definita in `index.css` (bg scuri, testo chiaro). Niente più "buchi bianchi" in dark mode.
- `colorScheme` del root sincronizzato con il tema per scrollbar/native form.

## Stampa

Regola globale `@media print` in coda a `index.css`:
- Forza palette chiara (anche se l'utente è in dark) per leggibilità.
- Nasconde sidebar, topbar, e qualsiasi nodo con classe `print:hidden` o attributo `data-print-hide="true"`.
- Tabelle con bordi visibili, `thead` ripetuto su pagine multiple, `page-break-inside: avoid` sulle righe.
- Link con URL stampato in coda (`a[href]::after`).
- Helper utility: `.page-break-before`, `.page-break-after`, `.avoid-break`.

Da usare nei PDF E/C / distinte / report quando vengono renderizzati via `window.print()` o stampa browser. I PDF generati lato server (jsPDF / edge functions) non sono toccati.
