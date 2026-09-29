---
name: Polizza vs Quietanza filtering
description: Distinzione visiva Polizze/Quietanze (segmented control, badge teal/ambra, bordo sinistro, link madre) e filtro Tipo unificato
type: feature
---

## Logica filtro

- Distinzione via `titoli.sostituisce_polizza`: NULL = polizza madre, valorizzato = quietanza.
- Tab unico "Polizze (n) · Quietanze (n)" con filtro `tutti | polizze | quietanze`:
  - **tutti**: madri come righe principali, quietanze espandibili (chevron) sotto la madre.
  - **polizze**: solo madri, niente chevron.
  - **quietanze**: vista flat di tutte le rate, con colonna "Polizza madre".

## Design tokens

In `src/index.css` (light + dark) + `tailwind.config.ts`:
- `--polizza` (teal pieno) / `--polizza-foreground` / `--polizza-soft`
- `--quietanza` (ambra) / `--quietanza-foreground` / `--quietanza-soft`

NON usare colori Tailwind hardcoded (es. `amber-400`); usare le classi `bg-polizza`, `border-l-quietanza`, `bg-quietanza-soft`.

## Componenti condivisi

- `src/components/polizze/TipoPolizzaBadge.tsx` — Badge `tipo: "polizza" | "quietanza"`, opz. `numero`/`totale` → "Quietanza N/M".
- `src/components/polizze/TipoFilterSegmented.tsx` — Segmented control (Tutti/Polizze/Quietanze) con chip attivo colorato del tipo selezionato. Sostituisce il vecchio `<Select>`.

## Convenzioni di rendering (tabelle)

- Riga **Polizza madre**: `border-l-4 border-l-polizza`, `font-medium` sul numero, badge `<TipoPolizzaBadge tipo="polizza" />`.
- Riga **Quietanza**: `border-l-4 border-l-quietanza`, `bg-quietanza-soft/40` (flat) o `/30` (figlia espansa), badge `<TipoPolizzaBadge tipo="quietanza" numero={idx} totale={tot} />`.
- Quietanze figlie (vista "tutti" espansa): indentazione `pl-8` + glifo `└` color `text-quietanza/70` davanti al numero, tipografia `font-mono text-xs text-muted-foreground`.
- Colonna "Polizza madre": per le quietanze è un `<Button variant="link">` cliccabile → naviga a `/titoli/${madreId}`.

## Vale per

- `ClienteDetail` tab "Polizze · Quietanze" (implementato).
- `PortafoglioAttivePage` / `PortafoglioCaricoPage` / `PortafoglioStoricoPage` — stesso pattern da replicare quando si toccano (oggi usano ancora i badge legacy).
