# Audit tecnico — Pulizia & Refactor (Step 1)

> Documento di sola analisi. Nessun file di codice è stato modificato in questo step.
> Le azioni concrete partono dallo Step 2.

---

## 1. Pagine principali — top per dimensione (LOC)

| Rank | File | LOC | Note |
|---:|---|---:|---|
| 1 | `src/pages/TitoloDetail.tsx` | 3285 | Pagina monstre: anagrafica + tecnico + provvigioni + movimenti + appendici + log + dialog vari |
| 2 | `src/pages/ClienteDetail.tsx` | 2034 | Tab già logiche ma tutto in un unico file |
| 3 | `src/pages/CompagnieList.tsx` | 1454 | Lista + dialog rapporti + branch + tax mescolati |
| 4 | `src/pages/ImmissionePolizzaPage.tsx` | 1267 | **100 `useState`** — candidato n.1 a `useReducer`/form |
| 5 | `src/pages/ClientiList.tsx` | 1178 | |
| 6 | `src/pages/TabelleBasePage.tsx` | 1114 | Più tab in un file |
| 7 | `src/pages/AreaCFO.tsx` | 1083 | KPI + grafici + drill-down + AI in un file |
| 8 | `src/pages/BandiPubbliciPage.tsx` | 1031 | |
| 9 | `src/pages/AnagraficheInternePage.tsx` | 1027 | |
| 10 | `src/pages/DocPrecontrattualePage.tsx` | 914 | |
| 11 | `src/pages/AnagraficheCompagniePage.tsx` | 883 | |
| 12 | `src/pages/contGenerale/PianoDeiContiPage.tsx` | 707 | |
| 13 | `src/pages/contabilita/DistintaGiornaliera.tsx` | 689 | |

## 2. Componenti più pesanti / disordinati

| File | LOC | Note |
|---|---:|---|
| `src/components/polizze/VociRcaCard.tsx` | 1294 | Voci RCA + ARD + Garanzie nello stesso card |
| `src/components/clienti/NuovoClienteDialog.tsx` | 871 | Wizard cliente con molte sezioni |
| `src/components/anagrafiche/SpecialistList.tsx` | 773 | |
| `src/components/chat/NuovaConversazioneDialog.tsx` | 714 | |
| `src/components/polizze/RinnovoTitoloDialog.tsx` | 652 | |
| `src/components/AddressAutocomplete.tsx` | 587 | Logica geocoding + UI |
| `src/components/anagrafiche/SediManager.tsx` | 565 | |
| `src/components/compagnie/RapportiCompagniaDialog.tsx` | 460 | |
| `src/components/ui/sidebar.tsx` | 637 | shadcn — non toccare |

## 3. Pagine con troppi dati visualizzati insieme

- **`TitoloDetail`** — 8+ aree informative in un'unica vista. Va diviso in tab/sezioni montate solo on-demand.
- **`ClienteDetail`** — tab presenti ma file monolitico: ogni tab dovrebbe essere un componente in `cliente/detail/`.
- **`AreaCFO`** — KPI + Andamento + Drill-down + AI Chat: serve gerarchia visiva con sezioni titolate.
- **`CompagnieList`** — tabella + 2 dialog complessi sullo stesso file.
- **`ImmissionePolizzaPage`** — 100 stati locali = altissima complessità cognitiva.
- **`TabelleBasePage`** — N tab incollate insieme: una tab = un file.

## 4. Duplicazioni di codice rilevate

| Pattern | Occorrenze | Soluzione proposta |
|---|---:|---|
| `Intl.NumberFormat('it-IT', currency:'EUR')` | 13 file | Usare `formatCurrency` (già in `src/lib/formatCurrency.ts`, oggi importato solo in 4 file) |
| `toLocaleDateString('it-IT', …)` | 11 file | Nuovo helper `src/lib/formatDate.ts` |
| Paginazione client (`PAGE_SIZE = 25` + `setPage(0)` su filtri) | **22 file** | Hook `usePagination<T>(rows, pageSize)` |
| Lookup tables (rami / compagnie / produttori / clienti) | molti | Centralizzare in `useLookupTables` (esiste, da estendere) |
| Skeleton/loading | sparsi | Spostare `ProvvigioniSkeletons` → `components/ui/skeletons/` generici |
| Query Supabase "lista clienti / compagnie" simili | varie | Hook dedicati |

## 5. Stati React ridondanti

- `ImmissionePolizzaPage`: **100 useState** → `useReducer` o `react-hook-form` (ma fuori scope del refactor "no-nuove-librerie"; valutare almeno `useReducer`).
- `ClienteDetail`: 28 useState — riducibili raggruppando per tab.
- `CompagnieList`: 13 useState — molti relativi ai dialog → spostare nel componente dialog.
- `TitoloDetail`: 22 useState — dipende dal split per tab.
- Filtri ricalcolati ogni render senza `useMemo` in molte liste.

## 6. Codice morto sospetto (NON rimosso senza conferma)

| File | Evidenza | Decisione consigliata |
|---|---|---|
| `src/pages/GestioneUtenti.tsx` | Nessun import esterno trovato. Sostituita da `GestioneUtentiPrivilegi`. Rotta `/gestione-utenti` redirecta. | **Eliminabile** dopo conferma utente |
| `src/pages/BancaImport.tsx` | Nessun import. Rotta `/banca-import` redirecta a `/contabilita`. | **Eliminabile** dopo conferma |
| `src/pages/FornitoriPage.tsx` | Nessun import. Rotta `/fornitori` redirecta a `/contabilita`. | **Eliminabile** dopo conferma |
| TODO marker | `DuplicazionePolizzaPage`, `DiffProvvigioniPage`, `ConfermaEmittendePage`, `StornoPolizzaPage` | Da rivedere singolarmente |

## 7. Performance

- Nessun `console.log` / `console.debug` residuo in `src/`. ✓
- Mancano `React.memo` / `useMemo` su tabelle grandi (`TitoliList`, `PortafoglioList`, `ClientiList`).
- Alcune query Supabase usano `select('*')` invece di colonne puntuali → tirano payload extra.
- Lookup ripetuti nelle pagine Provvigioni/Estrazioni invece di cache condivisa.

## 8. Rischi / cose da NON toccare

- Schema DB, RLS, edge functions, nomi campi.
- `components/ui/*` (shadcn).
- Logica calcolo provvigioni / messa a cassa / RCA voci premio.
- Polizze legacy citate in memory (204366651, 6131402092, RCM00010074404).

---

## Roadmap operativa

- **Step 2 (sicuro)** ✅ — fatto.
- **Step 3 (refactor)**: split top 5 componenti grossi, migrazione `usePagination` sulle 22 pagine (richiede sollevare `filteredX` al top level con `useMemo`, **non** è un'edit "safe").
- **Step 4 (UX)**: riorganizzazione visiva di `AreaCFO`, `ClientiList`, `TabelleBasePage`.
- **Step 5**: verifica build + report finale.

## Step 2 — risultati

| Azione | Stato |
|---|---|
| Eliminato `src/pages/GestioneUtenti.tsx` (rotta già redirect) | ✅ |
| Eliminato `src/pages/BancaImport.tsx` (rotta già redirect) | ✅ |
| Eliminato `src/pages/FornitoriPage.tsx` (rotta già redirect) | ✅ |
| Creato hook `src/hooks/usePagination.ts` | ✅ pronto, adozione in Step 3 |
| Creato helper `src/lib/formatDate.ts` (`fmtDate`, `fmtDateTime`, `fmtMonthYear`) | ✅ pronto, adozione progressiva |
| Migrazione `Intl.NumberFormat` → `formatCurrency` | ⏸ sospesa: 3 file cliente usano 0 decimali, 9 usano 2 → richiede `fmtEuro0` variant + verifica caso per caso, fatto in Step 3 |
| Rimozione import inutilizzati / `console.log` | ✅ già pulito (0 occorrenze) |

## Note di adozione (per Step 3)

**`usePagination` migration template** — pattern attuale (esempio `PagamentiProvvigioniList`):
```tsx
// PRIMA
const [page, setPage] = useState(0);
// ...dentro IIFE:
const pages = Math.ceil(filteredDistinte.length / PAGE_SIZE);
const safePage = Math.min(page, Math.max(0, pages - 1));
const pageRows = filteredDistinte.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

// DOPO (richiede sollevare filteredDistinte al top level)
const filteredDistinte = useMemo(() => /* ... */, [distinte, filterDa, ...]);
const { page, setPage, pages, pageRows, resetPage } = usePagination(filteredDistinte);
```
Tutti i `setPage(0)` nei filtri diventano `resetPage()`.
