# CLAUDE.md — Contesto Consulnet / CBnet per Agenti AI

Guida operativa per agenti AI esterni (Cursor, Claude Code, ecc.) che devono lavorare su questa codebase senza conoscerla. Il dominio applicativo è interamente in **italiano**: mantieni la lingua italiana per UI, nomi di colonne/tabelle e messaggi utente.

> **Leggi anche [`ANTIGRAVITY_AGENT.md`](./ANTIGRAVITY_AGENT.md)** per i vincoli storici, le invarianti di dominio e la roadmap di feature critica (sicurezza, funzionalità da completare, aree sensibili).

---

## 1. Panoramica progetto

**Nome:** Consulnet / CBnet  
**Scopo:** Gestionale assicurativo completo per broker italiani (Consulbrokers). Copre l’intero ciclo di vita di una polizza: anagrafiche, emissione, rinnovi, sinistri, contabilità, provvigioni, documentale e portale cliente/prospect.  
**Origine:** Progetto Lovable (Project ID: `a3b1457e-dbbe-41da-866b-8411e8cba913`).  
**URL produzione:** https://cbnet.it · https://consulnet.iaconnect.it  
**URL preview:** https://id-preview--a3b1457e-dbbe-41da-866b-8411e8cba913.lovable.app  
**Supabase Ref:** `zbjmnnlojxprlogbnxef`  
**Database:** Postgres 15+ su Supabase, ~130 tabelle, RLS abilitata su tutte.

---

## 2. Stack tecnologico completo

| Area | Tecnologia |
|---|---|
| Build / dev | **Vite 5** + `@vitejs/plugin-react-swc`, `lovable-tagger` |
| Linguaggio | **TypeScript 5.8** (`strict` parziale — vedi tsconfig) |
| UI | **React 18.3**, **shadcn/ui** (Radix UI), **Tailwind CSS 3.4**, `tailwindcss-animate`, `next-themes` |
| Routing | **react-router-dom 6** (route splittate in `src/routes/*`) |
| Data fetching | **TanStack Query v5** (`@tanstack/react-query`) |
| Form / validazione | **react-hook-form** + **zod** + `@hookform/resolvers` |
| Backend / DB / Auth | **Supabase** (`@supabase/supabase-js` 2.x) — Postgres + Auth + Storage + Edge Functions (Deno) |
| AI gateway | **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1`) — modelli Gemini 2.5 Flash / 3 Flash |
| Email | **Resend** (via edge functions) |
| PDF | `pdf-lib`, `pdfjs-dist` (worker in `public/pdfjs`) |
| Excel | `xlsx` (SheetJS) |
| Grafici | `recharts` |
| Mappe | Google Maps (`@types/google.maps`) |
| Notifiche UI | `sonner` |
| Icone | `lucide-react` |
| Test | **Vitest** + Testing Library + jsdom (unit), **Playwright** (e2e) |
| Package manager | **bun** (`bun.lock` / `bun.lockb`) — presente anche `package-lock.json` |

### Comandi principali

```sh
bun install            # installa dipendenze
bun run dev            # dev server su http://localhost:5175
bun run build          # build di produzione
bun run build:dev      # build development
bun run lint           # ESLint
bun run test           # Vitest run singolo
bun run test:watch     # Vitest watch
bun run test:e2e       # Playwright e2e
bun run preview        # anteprima build
```

Dev server: porta **5175** (`VITE_DEV_PORT`; la 8080 è spesso occupata da altri progetti), host `::`, header `Cache-Control: no-store`.  
Migrazioni: `supabase/migrations/` (323 file).  
Edge functions: `supabase/functions/` (42+ funzioni Deno).  
Config `verify_jwt` per funzione: `supabase/config.toml`.

---

## 3. Struttura cartelle

```
src/
├── App.tsx                  # Root: providers (QueryClient, Auth, Tooltip), router, guards
├── main.tsx                 # Entry point
├── pages/                   # ~70 pagine (1 file = 1 schermata)
│   ├── cliente/             # Portale cliente (read-only / self-service)
│   ├── prospect/            # Portale prospect
│   ├── contabilita/         # Cruscotto, E/C, rimesse, movimenti bancari
│   ├── anagrafiche/         # Conti bancari, ecc.
│   └── estrazioni/          # Portafoglio per cliente/compagnia, premi, E/C
├── routes/                  # Definizioni React Router raggruppate per area
│   ├── archivi.tsx          # Clienti, prospect, compagnie, trattative, bandi
│   ├── portafoglio.tsx      # Polizze, titoli, quietanze, documentale
│   ├── sinistri.tsx         # Sinistri list/detail/wizard/report
│   ├── contabilita.tsx      # Contabilità, rimesse, anticipi, movimenti bancari
│   ├── sistema.tsx          # Impostazioni, utenti, manutenzione, template
│   ├── cliente.tsx          # Portale cliente (fuori MainLayout)
│   └── prospect.tsx         # Portale prospect
├── components/
│   ├── ui/                  # shadcn/ui primitives (NON modificare a mano)
│   ├── shared/ common/      # Componenti riusabili (SearchableSelect, DatePicker, ecc.)
│   ├── titolo/ polizze/ rca/# Form e sezioni polizze (molto pesante)
│   ├── clienti/ cliente/ anagrafiche/
│   ├── contabilita/ provvigioni/ portafoglio/
│   ├── trattative/ compagnie/ estrazioni/
│   ├── documentale/ template/ chat/ ai/
│   ├── calendario/ utenti/ impostazioni/ tour/
│   ├── AuthGuard.tsx AppVersionGuard.tsx AppErrorBoundary.tsx MainLayout.tsx
│   └── **/__tests__/        # test co-locati
├── contexts/AuthContext.tsx # Stato auth + profilo + permessi
├── hooks/                   # useServerPagination, useLookupTables, useDashboardData, ecc.
├── lib/                     # Logica di dominio pura (testabile)
│   ├── ai/                  # Client/util AI lato frontend
│   ├── __tests__/           # test unitari
│   └── frazionamento.ts, resolveProvvigione.ts, validateCF.ts, ecc.
├── integrations/supabase/
│   ├── client.ts            # Istanza Supabase (generato — non editare)
│   └── types.ts             # Tipi Database GENERATI (non editare)
└── test/                    # setup test + esempi

supabase/
├── migrations/              # 323+ migrazioni SQL (schema + RLS + trigger)
├── functions/              # Edge Functions Deno
└── config.toml             # verify_jwt per funzione

public/pdfjs/               # worker + standard_fonts per pdfjs-dist
public/manifest.json        # PWA manifest
public/service-worker.js    # PWA service worker (NON toccare)
```

---

## 4. Routing

Le route sono definite in `src/App.tsx` e raggruppate in `src/routes/*.tsx`. L’area protetta è sotto `AuthGuard + MainLayout`. I portali cliente e prospect hanno guardie dedicate (`ClienteGuard`, `ProspectGuard`).

### Route pubbliche
| Route | Pagina | Accesso |
|---|---|---|
| `/login` | `LoginPage` | pubblica |
| `/reset-password` | `ResetPasswordPage` | pubblica |

### Route autenticate (MainLayout)
| Route | Pagina | Ruolo / Permesso |
|---|---|---|
| `/` | `Dashboard` | qualsiasi ruolo autenticato |
| `/mio-profilo` | `MioProfilo` | qualsiasi |
| `/ai-assistant` | `AiAssistantPage` | qualsiasi |

### Archivi (`src/routes/archivi.tsx`)
| Route | Pagina | Ruolo / Permesso |
|---|---|---|
| `/archivi/prospect` | `ProspectList` | admin, ufficio, backoffice, contabilita, manager, produttore |
| `/archivi/prospect/:id` | `ProspectDetail` | come sopra |
| `/prospect/:id` | `ProspectDetail` | compatibilità legacy |
| `/archivi/clienti` | `ClientiList` | autenticato con permesso `titoli` o visibilità commerciale |
| `/archivi/clienti/deduplica` | `DeduplicaClientiPage` | admin |
| `/archivi/clienti/:id` | `ClienteDetail` | autenticato con visibilità sul cliente |
| `/archivi/anagrafiche-agenzie` | `AnagraficheCompagniePage` | admin, ufficio |
| `/archivi/anagrafiche-amministrative` | `AnagraficheInternePage` | admin, ufficio |
| `/archivi/anagrafiche-interne` | redirect | — |
| `/archivi/anagrafiche` | redirect | — |
| `/archivi/conti-bancari` | `ContiBancariPage` | admin, ufficio, contabilita |
| `/trattative` | `TrattativeList` | autenticato |
| `/trattative/calendario` | `CalendarioTrattativePage` | autenticato |
| `/trattative/storico` | `StoricoTrattativePage` | autenticato |
| `/bandi-pubblici` | `BandiPubbliciPage` | admin, cfo, ufficio, backoffice, produttore, executive |

### Portafoglio (`src/routes/portafoglio.tsx`)
| Route | Pagina | Ruolo / Permesso |
|---|---|---|
| `/titoli` | `TitoliList` | autenticato con visibilità titoli |
| `/titoli/:id` | `TitoloDetail` | come sopra |
| `/polizze/:id` | `PolizzaDetail` | come sopra |
| `/quietanze/:id` | `QuietanzaDetail` | come sopra |
| `/portafoglio` | redirect → `/portafoglio/attive` | — |
| `/portafoglio/attive` | `PortafoglioAttivePage` | autenticato con visibilità portafoglio |
| `/portafoglio/carico` | `PortafoglioCaricoPage` | come sopra |
| `/portafoglio/storico` | `PortafoglioStoricoPage` | come sopra |
| `/portafoglio/:id` | `PortafoglioDetail` | come sopra |
| `/portafoglio/:id/compensazioni` | `CompensazioniTitoloDetail` | admin, cfo, contabilita, ufficio |
| `/portafoglio/immissione` | `ImmissionePolizzaPage` | admin, ufficio, backoffice, produttore |
| `/portafoglio/appendici` | `AppendiciPolizzaPage` | admin, ufficio, backoffice |
| `/portafoglio/rinnovi` | `RinnoviPolizzaPage` | admin, ufficio, backoffice |
| `/portafoglio/gestione` | `GestionePolizzePage` | admin, ufficio, backoffice |
| `/portafoglio/doc-precontrattuale` | `DocPrecontrattualePage` | admin, ufficio, backoffice |
| `/portafoglio/estrazioni-stampe` | `EstrazioniStampePage` | admin, cfo, ufficio, backoffice |
| `/portafoglio/estrazioni/per-cliente` | `PortafoglioPerClientePage` | admin, cfo, ufficio |
| `/portafoglio/estrazioni/per-compagnia` | `PortafoglioPerCompagniaPage` | admin, cfo, ufficio |
| `/portafoglio/estrazioni/premi-provvigioni` | `PremiProvvigioniPage` | admin, cfo, ufficio |
| `/portafoglio/estrazioni/premi-scoperti-garantiti` | `PremiScopertiGarantitiPage` | admin, cfo, ufficio |
| `/portafoglio/estrazioni/ec-clienti` | `ECClientiPage` | admin, cfo, ufficio, contabilita |
| `/portafoglio/collettive` | `PlaceholderPage` | — |
| `/portafoglio/documentale` | `DocumentalePage` | autenticato |
| `/provvigioni-maturate` | `ProvvigioniMaturatePage` | admin, cfo, ufficio, contabilita, produttore (con `provvigioni`) |

### Sinistri (`src/routes/sinistri.tsx`)
| Route | Pagina | Ruolo / Permesso |
|---|---|---|
| `/sinistri` | `SinistriList` | autenticato con permesso `sinistri` |
| `/sinistri/:id` | `SinistroDetail` | come sopra |
| `/sinistri/apertura` | `SinistroAperturaWizardPage` | admin, ufficio, backoffice, produttore |
| `/sinistri/prescrizioni` | `SinistroPrescrizioniPage` | admin, ufficio, backoffice |
| `/sinistri/scadenze` | `SinistroScadenzePage` | admin, ufficio, backoffice |
| `/sinistri/report-sir` | `SinistroReportSirPage` | admin, ufficio, backoffice |

### Contabilità (`src/routes/contabilita.tsx`)
| Route | Pagina | Ruolo / Permesso |
|---|---|---|
| `/contabilita` | `ContabilitaUfficio` | admin, cfo, ufficio, backoffice, contabilita |
| `/contabilita/cruscotto` | `CruscottoGiornaliero` | come sopra |
| `/contabilita/ec-clienti` | `ECClientiContabPage` | admin, cfo, ufficio, contabilita |
| `/contabilita/ec-compagnia` | `ECCompagniaContabPage` | admin, cfo, ufficio, contabilita |
| `/contabilita/ec-agenzia` | `ECCompagniaContabPage` | admin, cfo, ufficio, contabilita |
| `/contabilita/ec-agenzia/pdf` | `ECAgenziaPdfPage` | come sopra |
| `/contabilita/ec-agenzia/in-pagamento` | `AgenzieInPagamentoPage` | come sopra |
| `/contabilita/ec-cliente/pdf` | `ECClientePdfPage` | come sopra |
| `/contabilita/ec-agenzia/storico` | `ECAgenzieStoricoPage` | come sopra |
| `/contabilita/ec-cliente/storico` | `ECClientiStoricoPage` | come sopra |
| `/contabilita/ec-produttori` | `ECProduttoriContabPage` | come sopra |
| `/contabilita/ec-produttore/storico` | `ECProduttoriStoricoPage` | come sopra |
| `/contabilita/storico-rimesse` | `StoricoRimessePage` | admin, cfo, ufficio, contabilita |
| `/contabilita/anticipi-clienti` | `RiepilogoAnticipiPage` | admin, cfo, ufficio, contabilita |
| `/contabilita/caricamento-mov-bancari` | `CaricamentoMovBancariPage` | admin, cfo, ufficio, contabilita |
| `/contabilita/ricongiungimento-bancario` | `RicongiungimentoBancarioPage` | come sopra |
| `/contabilita/stampa-sospesi` | redirect → anticipi | — |
| `/rimessa-premi` | redirect | — |
| `/report-iva` | `ReportIVA` | admin, cfo, contabilita |

### Sistema (`src/routes/sistema.tsx`)
| Route | Pagina | Ruolo |
|---|---|---|
| `/impostazioni` | `ImpostazioniPage` | admin, ufficio |
| `/crea-utente` | redirect | — |
| `/gestione-utenti` | redirect | — |
| `/utenti-privilegi` | `GestioneUtentiPrivilegi` | **admin** |
| `/backup-export` | `BackupExport` | **admin** |
| `/manutenzione` | `ManutenzionePage` | **admin** |
| `/tabelle-base` | `TabelleBasePage` | **admin** |
| `/compagnie` | `CompagnieList` | **admin** |
| `/gestione-uffici` | `GestioneUfficiPage` | **admin** |
| `/template` | `TemplatePage` | admin, ufficio |
| `/anomalie-sistema` | `AnomalieList` | admin, cfo, ufficio |
| `/sitemap` | `SitemapPage` | **admin** |
| `/anomalie-ko` | `AnomalieKO` | autenticato |
| `/note-restituzione` | `NoteRestituzioneList` | autenticato |
| `/note-restituzione/:id` | `NotaRestituzioneDetail` | autenticato |
| `/spedizioni` | `SpedizioniList` | autenticato |
| `/notifiche` | `NotifichePage` | autenticato |
| `/privacy` | `PrivacyConsensi` | autenticato |
| `/flussi-compagnie` | `FlussiCompagnieList` | admin, cfo, ufficio |
| `/flussi-compagnie/:id` | `FlussoCompagniaDetail` | come sopra |
| `/pagamenti-provvigioni` | `PagamentiProvvigioniList` | admin, cfo, contabilita |
| `/pagamenti-provvigioni/:id` | `PagamentoProvvigioneDetail` | come sopra |
| `/report` | `ReportPage` | admin, cfo, ufficio, backoffice |
| `/chat` | `ComunicazioniPage` | autenticato |
| `/comunicazioni` | `ComunicazioniPage` | autenticato |
| `/trattative/storico-gare` | `StoricoGarePage` | admin, cfo, ufficio, backoffice, produttore, executive |

### Portale Cliente (`src/routes/cliente.tsx`)
Tutte sotto `ClienteGuard + ClienteLayout`. Accesso solo per utenti con `ruolo = 'cliente'`. Read-only per la propria anagrafica/polizze/sinistri.

| Route | Pagina |
|---|---|
| `/cliente` | `ClienteDashboard` |
| `/cliente/polizze` | `ClientePolizze` |
| `/cliente/polizze/:id` | `ClientePolizzaDetail` |
| `/cliente/documenti` | `ClienteDocumenti` |
| `/cliente/scadenze` | `ClienteScadenze` |
| `/cliente/chat` | `ClienteComunicazioni` |
| `/cliente/comunicazioni` | `ClienteComunicazioni` |
| `/cliente/notifiche` | `ClienteNotifiche` |
| `/cliente/upload` | `ClienteUploadDoc` |
| `/cliente/sinistri` | `ClienteSinistri` |
| `/cliente/sinistri/:id` | `ClienteSinistroDetail` |
| `/cliente/anagrafica` | `ClienteAnagrafica` |
| `/cliente/ufficio` | `ClienteUfficio` |
| `/cliente/assistente` | `ClienteAssistente` |

### Portale Prospect (`src/routes/prospect.tsx`)
Tutte sotto `ProspectGuard + ProspectLayout`. Accesso solo per `ruolo = 'prospect'`.

| Route | Pagina |
|---|---|
| `/prospect` | `ProspectDashboard` |
| `/prospect/trattative` | `ProspectTrattative` |
| `/prospect/documenti` | `ProspectDocumenti` |
| `/prospect/upload` | `ProspectUploadDoc` |

---

## 5. Ruoli e permessi

Auth gestita da **Supabase Auth** (email/password, sessione in `localStorage`).
Su login viene caricato il profilo da `profiles` (`id, nome, cognome, email, ruolo, ufficio_id, permessi_json, attivo`).
Profilo senza riga in `profiles` → `signOut` forzato (`AuthGuard`).

### Gerarchia livelli L1 → L6

| Livello | Label | `profiles.ruolo` | Visibilità default | Cosa può fare |
|---|---|---|---|---|
| **L1** | Admin | `admin` | `all` (tutte le sedi) | Accesso totale. Gestisce utenti, tabelle base, compagnie, backup, manutenzione, vede tutti i dati. |
| **L2** | CFO | `cfo` | `all` | Lettura globale + finanza/report. Vede tutte le sedi, report, estrazioni, IVA, provvigioni. |
| **L3** | Sede / Specialist / Contabilità | `ufficio`, `backoffice`, `contabilita` | `own_office` (propria sede) | Operatività di sede: polizze, sinistri, trattative, contabilità, rimesse, E/C clienti, report. |
| **L4** | Manager | `manager` | `own_producers` (propri produttori) | Coordina i propri produttori. Vede titoli, sinistri, trattative, report, documentale, provvigioni. |
| **L5** | Produttore / Corrispondente | `produttore`, `corrispondente` | `self_only` (solo se stesso) | Vede solo il proprio portafoglio. Può creare polizze? dipende da `permessi_json`. |
| **L6** | Cliente / Prospect | `cliente`, `prospect` | `self_only` | Portale read-only. Vede solo i propri dati, polizze, scadenze, sinistri, documenti. |

### Chiavi permesso (`permessi_json`)

```
titoli, sinistri, trattative, calendario,
contabilita, rimesse, ec_clienti, chiusure,
report, estrazioni, anagrafiche, tabelle_base, agenzie, uffici, manutenzione,
documentale, template, provvigioni, riceve_provvigioni, pagamenti_provvigioni
```

I gruppi sono definiti in `src/lib/userLevels.ts` (`PERMISSION_GROUPS`).  
`AuthContext.hasPermission(key)` ritorna `true` automaticamente per `admin`; altrimenti legge `permessi_json[key]`.

### ⚠️ Doppia fonte di verità ruoli

Lo schema/RLS usa la tabella `user_roles` + funzione `public.has_role()` (SECURITY DEFINER), mentre il frontend usa `profiles.ruolo` e `profiles.permessi_json`. Quando crei/aggiorni un utente devi scrivere su **entrambi** (`profiles` e `user_roles`), altrimenti UI e RLS divergono.

---

## 6. Tabelle Supabase principali

### Anagrafiche / clienti

**`clienti`** (86 colonne) — anagrafica clienti/aziende/enti.
- Campi chiave: `id`, `ragione_sociale`, `nome`, `cognome`, `codice_fiscale`, `partita_iva`, `tipo_soggetto` (privato/azienda/ente), `ufficio_id`, `produttore_id`, `backoffice_id`, `account_executive_id`, `ragione_sociale`, `indirizzo`, `citta`, `provincia`, `cap`, `email`, `telefono`, `data_nascita`, `luogo_nascita`, `privacy_consensi`.
- Relazioni: `ufficio_id → uffici.id`, `produttore_id → anagrafiche_professionali.id`, `gruppo_compagnia_id → gruppi_compagnia.id`.

**`anagrafiche_professionali`** (47 colonne) — produttori, corrispondenti, account executive, specialist.
- Campi chiave: `id`, `tipo` (corrispondente, produttore, account_executive, backoffice, ...), `nome`, `cognome`, `email`, `telefono`, `ufficio_id`, `percentuale_ra`, `user_id`.

**`prospect`** (69 colonne) — prospect commerciali, prima della conversione in cliente.
- Ha un flusso di conversione in `clienti` con `convertito_cliente_id`.

**`profiles`** (32 colonne) — utenti applicativi collegati a `auth.users`.
- Campi chiave: `id` (FK auth.users), `nome`, `cognome`, `email`, `ruolo`, `ufficio_id`, `permessi_json`, `attivo`, `livello`, `data_scadenza_pw`.

**`user_roles`** — tabella separata per ruoli (obbligatoria per RLS `has_role()`).
- Campi: `id`, `user_id`, `role` (enum `app_role`).

**`nominativi_cliente`** — referenti multipli per cliente (ON DELETE CASCADE).
**`codici_commerciali_cliente`** — codici commerciali legati a produttore/sede/ramo.
**`documenti_utenti`** — documenti identità utenti interni.

### Compagnie / agenzie / prodotti

**`compagnie`** (50 colonne) — anagrafica compagnie/agenzie.
- Campi chiave: `id`, `ragione_sociale`, `tipo` (mandataria, non-mandataria, ...), `codice` (univoco con `tipo`), `partita_iva`, `codice_ivass`, `pec`, `email`, `telefono`, `percentuale_ra`, `gruppo_compagnia_id`, `gruppo_finanziario_id`.
- ⚠️ Dopo reset 16/05/2026: `tipo + codice` è univoco obbligatorio.

**`compagnia_rapporti`** (30 colonne) — rapporti N:N agenzia-compagnia (plurimandatarie, broker).
- Campi chiave: `id`, `compagnia_id`, `agenzia_codice`, `data_inizio`, `data_fine`, `is_default`, `percentuale_ra`.

**`compagnia_rapporto_rami`** — rami/sottorami abilitati per rapporto.
- Campi: `compagnia_rapporto_id`, `ramo_id`, `sottoramo_id`.

**`prodotti`** / **`prodotti_cga`** / **`prodotti_articoli`** / **`prodotti_condizioni`** / **`prodotti_definizioni`** / **`prodotti_garanzie`** / **`prodotti_riferimenti_normativi`** — catalogo prodotti + CGA.

**`rami`** / **`gruppi_ramo`** — gruppo ramo (UI "Ramo") e sottoramo (UI "Sottoramo").
- `gruppi_ramo` contiene i macro-gruppi; `rami` contiene i sottorami con `gruppo_ramo_id`.
- ⚠️ `titoli.gruppo_ramo` è stata eliminata; la UI usa la combinazione `ramo_id` (prima riga garanzia) + `gruppi_ramo`.

### Polizze (`titoli`) e quietanze

**`titoli`** (121 colonne) — polizze, quietanze, regolazioni, storni, appendici.
- Campi chiave: `id`, `numero_polizza`, `tipo` (polizza, quietanza, regolazione, storno, appendice), `stato` (attivo, sospeso, scaduto, incassato, annullato), `cliente_id`, `compagnia_id`, `compagnia_rapporto_id`, `prodotto_nome` (verità UI), `ramo_id`, `garanzia_da`, `garanzia_a`, `data_emissione`, `data_scadenza`, `data_messa_cassa`, `premio_lordo`, `premio_netto`, `tasse`, `ssn`, `addizionali`, `provvigione_perc`, `provvigione_lordo`, `provvigione_netto`, `percentuale_ra`, `anagrafica_commerciale_id`, `account_executive_id`, `ufficio_id`, `tacito_rinnovo`, `sostituisce_polizza`, `parent_id` (per quietanze figlie di polizza), `frazionamento` (testuale).
- ⚠️ `prodotto_id` è legacy; usare `prodotto_nome`. `tipo_rinnovo` è legacy; usare `tacito_rinnovo`.
- Trigger attivi: `trg_titoli_normalizza_importi`, `trg_seed_cf_oneri`, `auto-quietanza`, audit trail.

**`quietanze`** (30 colonne) — tabella legacy per quietanze; nuove quietanze sono record `titoli` indipendenti (modello "polizza/quietanza split").

**`appendici_polizza`** — appendici polizza.
**`titoli_regolazioni`** — regolazioni.
**`titoli_sostituzioni`** — sostituzioni / estinzioni.
**`titoli_storni`** — storni.
**`titoli_split_commerciali`** — riparto provvigioni tra commerciale e Consul.
**`titoli_compensazioni`** — compensazioni / utilizzi anticipi.
**`titoli_eventi_snapshot`** — snapshot eventi per audit.
**`titoli_numeri_storici`** — storico numeri polizza.

**`movimenti_polizza`** (30 colonne) — movimenti contabili legati a titoli (incassi, rimesse, ecc.).
**`movimenti_polizze`** (10 colonne) — relazione N:N movimenti bancari ↔ polizze (multi-cliente).

**`premi_garanzia_polizza`** (21 colonne) — composizione premi per garanzia.
**`polizza_cga`** (38 colonne) — CGA estratte per polizza (modulo CGA RAG).
**`polizza_cga_premio_garanzia`** (8 colonne) — premi per garanzia da CGA.
**`polizza_garanzie_personali`** (8 colonne) — override garanzie personalizzate.

**`veicoli_polizza`** (35 colonne) — dati veicolo RCA.
**`conducenti_polizza`** (14 colonne) — conducenti RCA.
**`rca_garanzie`** / **`rca_usi`** — catalogo garanzie RCA e usi/settori.
**`aliquote_provinciali_rca`** — aliquote RCA per provincia.

### Sinistri

**`sinistri`** (40 colonne) — scheda sinistro.
- Campi chiave: `id`, `numero_sinistro`, `cliente_id`, `titolo_id`, `compagnia_id`, `data_accadimento`, `data_denuncia`, `stato`, `tipo_sinistro`, `danno`, `riserva`, `liquidato`, `data_prescrizione`, `responsabile_id`, `liquidatore_id`.

**`sinistro_eventi`** (7 colonne) — timeline eventi.
**`sinistro_checklist`** (6 colonne) — checklist task.

### Contabilità

**`movimenti_bancari`** (12 colonne) — movimenti importati da banca.
- Campi: `id`, `data_movimento`, `importo`, `descrizione`, `ordinante`, `stato` (importato, matchato, ricongiunto, contabilizzato), `cliente_id`, `ufficio_id`, `banca_id`.

**`incroci_bancari`** (10 colonne) — incroci / ricongiungimenti bancari.
**`conti_bancari`** (21 colonne) — conti bancari clienti/Consulbrokers.
**`primanota_generale`** (21 colonne) — prima nota contabile.
**`movimenti_contabili`** (15 colonne) — movimenti contabili generali.
**`causali_contabili`** / **`causali_movimento_contabile`** — causali.
**`piano_conti_conti`** / **`piano_conti_gruppi`** / **`sezioni_bilancio`** — piano dei conti.
**`chiusure_contabili`** (16 colonne) — chiusure contabili periodiche.
**`estratti_conto`** (10 colonne) — estratti conto clienti/compagnie.
**`iva_registri`** (8 colonne) — registri IVA.
**`certificazioni_cu`** (19 colonne) — certificazioni uniche.
**`elab_annuali`** / **`elaborazioni_periodiche`** — elaborazioni.

### Rimesse / portafoglio incassi

**`rimessa_premi`** (22 colonne) — rimesse agenzie.
**`rimessa_dettaglio`** (5 colonne) — righe rimessa.
**`note_restituzione`** / **`note_restituzione_dettaglio`** — note di restituzione.
**`portafoglio_incassi`** / **`portafoglio_incassi_eventi`** — portafoglio incassi e eventi.
**`spedizioni_cartacee`** (10 colonne) — spedizioni documenti.

### Provvigioni

**`matrice_provvigioni`** (9 colonne) — matrice provvigioni base.
**`provvigioni_compagnia_ramo`** (9 colonne) — provvigioni per compagnia/ramo.
**`provvigioni_default_tipo`** (8 colonne) — default per tipo contratto.
**`provvigioni_generate`** (11 colonne) — provvigioni generate.
**`produttori_provvigioni_ramo`** (8 colonne) — override provvigioni produttore per ramo.
**`pagamenti_provvigioni`** / **`pagamenti_provvigioni_righe`** — pagamenti produttori.
**`dettaglio_riparto`** (17 colonne) — riparto provvigioni.

### Trattative / bandi

**`trattative`** (24 colonne) — pipeline commerciale.
**`trattativa_eventi`** / **`trattativa_scadenze`** / **`trattativa_documenti`**.
**`bandi_pubblici`** (19 colonne) — bandi pubblici raccolti dall’API ufficiale TED (nessuna IA).
**`bandi_trattative`** / **`ricerche_bandi`** / **`storico_gare`** (29 colonne).

### Documentale / template / comunicazione

**`documenti`** (11 colonne) — documenti allegati.
**`document_library`** (11 colonne) — libreria documentale gerarchica.
**`document_folders`** (10 colonne) — cartelle documentali.
**`template_email`** / **`template_categorie`** — template comunicazioni.
**`email_branding`** (9 colonne) — branding email.
**`notifiche`** (11 colonne) — notifiche realtime.
**`privacy_consensi`** / **`privacy_informative`** — consensi privacy.
**`richieste_modifica_cliente`** — richieste modifica dati cliente.
**`report_salvati`** — report salvati.

### Chat / AI

**`chat_canali`** / **`chat_canali_membri`** / **`chat_messaggi`** / **`chat_messaggi_interni`** / **`chat_conferme_lettura`**.
**`ai_chat_conversazioni`** / **`ai_chat_messaggi`** / **`ai_user_memory`** / **`ai_allowed_enums`**.

### Sistema / lookup / audit

**`uffici`** (16 colonne) — sedi/uffici.
**`profilo_sedi`** (4 colonne) — relazione profilo-sede.
**`impostazioni_sistema`** / **`impostazioni_ufficio`** — impostazioni.
**`audit_config`** / **`log_attivita`** (10 colonne) / **`log_attivita_archivio`** — audit trail.
**`anomalie_sistema`** (12 colonne) — anomalie rilevate dal sistema.
**`performance_log`** — log performance.
**`upload_rate_limit`** — rate limit upload.
**`lookup_*`** — tabelle di lookup (attività, conti incasso, contratti, fasce, indotti, risk type, settori, tipo documento, zone).

---

## 7. Pattern da rispettare

### 7.1 Query dati (TanStack Query v5)

- Tutto il data fetching passa per `useQuery` / `useMutation` di `@tanstack/react-query`.
- Le query devono usare `queryKey` stabili e descrittivi, includendo parametri di filtro/paginazione.
- Esempio tipico:
  ```ts
  const { data, isLoading, error } = useQuery({
    queryKey: ["titoli", page, search, filters],
    queryFn: async () => {
      let q = supabase.from("titoli").select("*", { count: "exact" });
      if (search) q = q.ilike("numero_polizza", `%${search}%`);
      const { data, error, count } = await q.range(range.from, range.to);
      if (error) throw error;
      return { data, count };
    },
  });
  ```
- Per paginazione server-side usa sempre `useServerPagination` (default 25 righe).
- Per liste > 10 elementi usa `SearchableSelect` (Popover + Command), mai `<select>` nativo.
- Debounce ricerca: **350ms**.
- Limit query Supabase: default 1000 righe. Se serve di più, usa paginazione o RPC.

### 7.2 Row Level Security (RLS)

- **Tutte** le tabelle hanno RLS abilitata.
- La visibilità è filtrata principalmente tramite `profiles.ufficio_id` (sede) o gerarchia commerciale.
- Le policy usano `public.has_role(auth.uid(), 'admin')` o controlli su `ufficio_id` / `produttore_id` / `cliente_id`.
- `has_role()` è una funzione SQL `SECURITY DEFINER` che legge `public.user_roles` — usarla nelle policy, non bypassarla.
- Edge functions che necessitano di privilegi elevati usano `service_role` internamente (`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`), ma il client SPA usa sempre l’anon key.

### 7.3 Chiamata Edge Function

Pattern tipico dal frontend:
```ts
const { data, error } = await supabase.functions.invoke("nome-funzione", {
  body: { ...payload },
});
```

Pattern Deno interno:
```ts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
```

⚠️ La maggior parte delle edge functions ha `verify_jwt = false` nel `config.toml` — è una scelta documentata. Non cambiare senza istruzione esplicita.

### 7.4 Routing (React Router v6)

- Route definite in `src/routes/*.tsx` e importate in `App.tsx`.
- Route protette: `AuthGuard` controlla sessione; `RoleGuard` controlla ruolo.
- Portali cliente/prospect usano `ClienteGuard`/`ProspectGuard` con layout dedicati (fuori da `MainLayout`).
- Redirect di default gestiti da `getDefaultRoute` (`src/lib/getDefaultRoute.ts`) in base a ruolo e permessi.

### 7.5 Componenti shadcn/ui

- I componenti base sono in `src/components/ui/` (Button, Input, Table, Dialog, Select, ecc.).
- **Non modificarli a mano** se possibile: componili o crea varianti custom in `src/components/shared/`.
- Per form usa `react-hook-form` + `zod` + `<Form>` di shadcn.
- Per dialoghi/modali usa `Dialog`, `Sheet`, `Drawer` di shadcn.
- Per tabelle con paginazione usa `Table` + `ServerPagination`.
- Per date usa `DatePicker` / `DateRangePicker` condivisi.
- Per liste lunghe: `SearchableSelect` (Popover + Command).

---

## 8. Edge functions esistenti

Le edge functions sono in `supabase/functions/`. Configurate in `supabase/config.toml` con `verify_jwt = false` per quasi tutte, salvo `check-resend-domain` (`verify_jwt = true`).

| Nome | Scopo |
|---|---|
| `ai-assistant` | Backend per l’Assistente IA conversazionale |
| `ai-match-movimenti-bancari` | Matching AI + fuzzy movimenti bancari → clienti |
| `analisi-documenti-multipli` | Analisi batch di documenti con AI |
| `bootstrap-admin` | Crea il primo utente admin |
| `calcola-provvigioni` | Calcolo provvigioni su titoli |
| `cerca-bandi` | Ricerca bandi pubblici (API ufficiale TED, senza IA) |
| `cfo-ai-analyst` | Analisi dati CFO tramite AI |
| `check-resend-domain` | Verifica dominio Resend configurato |
| `chiedi-mie-polizze` | Query natural language polizze cliente |
| `chiedi-polizza-cga` | RAG su CGA di una polizza |
| `create-cliente-user` | Provisioning utente cliente |
| `create-prospect-user` | Provisioning utente prospect |
| `create-user` | Provisioning utente generico |
| `extract-document-data` | Estrazione dati da documenti generici |
| `genera-distinta-pdf` | Generazione PDF distinta provvigioni |
| `genera-pdf-template` | Generazione PDF da template |
| `gestione-rimessa` | Creazione/gestione rimesse agenzie |
| `gestione-sinistri` | Operazioni su sinistri (eventi, checklist) |
| `import-clienti` | Import massivo clienti |
| `import-compagnie` | Import massivo compagnie |
| `import-corrispondenti` | Import massivo corrispondenti |
| `import-portafoglio` | Import massivo portafoglio |
| `import-storico-gare-oneshot` | Import one-shot storico gare |
| `import-storico-gare` | Import storico gare |
| `incrocio-bancario` | Incrocio / ricongiungimento bancario |
| `match-bank-rows` | Matching fuzzy movimenti bancari |
| `notifica-messa-cassa-agenzia` | Invio email notifica messa a cassa all’agenzia |
| `parse-bank-document` | Parsing estratto conto bancario (PDF) |
| `parse-cga` | Estrazione dati da Condizioni Generali Assicurazione (CGA) |
| `parse-polizza-completa` | Parsing polizza completa (AI) |
| `parse-polizza-rca` | Parsing polizza RCA (AI) |
| `parse-provvigioni-pdf` | Parsing PDF provvigioni da compagnie |
| `parse-tariffario-rami` | Parsing tariffario rami |
| `provision-clienti-users` | Provisioning automatico utenti cliente |
| `provision-corrispondenti-users` | Provisioning automatico utenti corrispondente |
| `provision-sedi-users` | Provisioning automatico utenti sede |
| `provision-user` | Provisioning generico utente |
| `reset-demo-password` | Reset password demo |
| `scarica-bando-pdf` | Download PDF bando pubblico |
| `seed-comune-varese-polizze` | Seed demo polizze per Comune di Varese |
| `send-email` | Invio email tramite Resend |

> **Non duplicare** queste funzioni. Se serve una variazione, estendi quella esistente o aggiungi una con nome diverso e documenta lo scopo.

---

## 9. Cosa NON toccare

### Tabelle con trigger DB attivi
Le seguenti tabelle hanno trigger complessi che normalizzano importi, generano quietanze, scrivono audit trail, ecc. Non modificarne la struttura senza leggere i trigger:
- **`titoli`** — `trg_titoli_normalizza_importi`, `trg_seed_cf_oneri`, `auto-quietanza`, audit trail.
- **`clienti`** — trigger normalizzazione CF/P.IVA, audit trail.
- **`sinistri`** — trigger audit, calcolo prescrizione.
- **`trattative`** — trigger audit, stati.
- **`compagnie`** — trigger su codice univoco, audit.

### Componenti / logica critica
- **`MessaCassaDialog`** — logica critica di messa a cassa: crea movimenti, genera quietanze successive, invia notifiche, gestisce compensazioni. Modificare solo con test mirati.
- **`service-worker.js`** / **`public/sw.js`** — configurazione PWA. Cambiamenti possono rompere la cache offline.
- **`AppVersionGuard`** + **`lib/versionCheck.ts`** — gestione reload bundle. Attenzione a loop di reload.
- **`src/integrations/supabase/client.ts`** e **`src/integrations/supabase/types.ts`** — file generati automaticamente. Non editarli a mano.
- **`bun.lock`** / **`bun.lockb`** — gestiti dal package manager.

### Dati intenzionali
- Polizze duplicate `204366651`, `6131402092`, `RCM00010074404` — **non deduplicare o cancellare**. Servono per riconciliazione contabile Apr 2026.
- 476 agenzie legacy cancellate il 16/05/2026 — **non ripristinare**. Nuove agenzie richiedono `tipo + codice` univoco.

### Pagine rimosse (non reintrodurre)
- Contabilità Generale (`/contabilita-generale`)
- FatturaPA
- Fornitori
- Banca Import

### Tabelle deprecate
- `filiali` — non usarla in nuovo codice.
- `prodotto_id` su `titoli` — legacy, usare `prodotto_nome`.
- `tipo_rinnovo` — legacy, usare `tacito_rinnovo`.
- `titoli.gruppo_ramo` — colonna eliminata.

### Bucket Supabase Storage
Non cancellare o rinominare i bucket esistenti: `documenti`, `documenti-clienti`, `documenti-utenti`, `modelli`, `template` (verificare i nomi esatti nel dashboard Supabase prima di modificare).

### Configurazione Edge Functions
- Non cambiare `verify_jwt` senza istruzione esplicita e audit di sicurezza.
- Non esporre `SUPABASE_SERVICE_ROLE_KEY` o `LOVABLE_API_KEY` nel client.

---

## 10. Feature recenti — contesto aggiornato

### 10.1 Portafoglio — Carico (filtri toggle + datepicker)
- **File:** `src/pages/PortafoglioCaricoPage.tsx`
- **Filtri aggiunti:** toggle "Mese Corrente / Messe a Cassa / Tutte", toggle "Tutti / Quietanze / Regolazioni", datepicker Dal/Al, ricerca testuale.
- **Colonne:** sostituita la colonna "Scadenza" con **Inizio Garanzia** e **Fine Garanzia** (`garanzia_da`, `garanzia_a`). Rimossa colonna "Anticipo".
- **Fallback:** quando Inizio/Fine Garanzia sono null viene mostrato `—`.
- Stessa modifica applicata anche a `PortafoglioAttivePage` e `PortafoglioStoricoPage`.

### 10.2 Movimenti Bancari (2 pagine + 3 tabelle)
- **Pagine:**
  - `src/pages/contabilita/CaricamentoMovBancariPage.tsx` — importazione movimenti bancari (PDF/CSV/XLSX), stato `importato`.
  - `src/pages/contabilita/RicongiungimentoBancarioPage.tsx` — ricongiungimento incroci tra movimenti e polizze.
- **Tabelle coinvolte:** `movimenti_bancari`, `incroci_bancari`, `movimenti_polizze`.
- **Edge function:** `ai-match-movimenti-bancari` — fuzzy matching + AI per assegnare `cliente_id` e `ufficio_id` ai movimenti in stato `importato`.
- **Hook:** `useAnticipiResiduoByClienti` era usato per colonna anticipi nei portafogli, ora rimosso dalle pagine portafoglio ma ancora usato in altri flussi.

### 10.3 Modulo CGA RAG (5 tabelle + 2 edge function)
- **Scopo:** estrarre e consultare le Condizioni Generali di Assicurazione (CGA) in modo strutturato, con RAG per polizza.
- **Tabelle:**
  - `polizza_cga` (38 colonne) — CGA estratta per polizza.
  - `polizza_cga_premio_garanzia` — premi per garanzia personalizzati.
  - `polizza_garanzie_personali` — override garanzie personali.
  - `prodotti_cga` (33 colonne) — template prodotto condiviso.
  - `prodotti_condizioni`, `prodotti_definizioni`, `prodotti_garanzie`, `prodotti_riferimenti_normativi` — catalogo condiviso.
- **Edge functions:**
  - `parse-cga` — parsing PDF CGA con AI Gateway, estrae prodotto + dati personali + garanzie + condizioni + definizioni.
  - `chiedi-polizza-cga` — RAG su una CGA specifica di polizza (domande/risposte).
- **UI:** accessibile dal dettaglio polizza, sezione CGA / Assistente IA polizza.

---

## 11. Cantieri aperti

Questa sezione elenca funzionalità parzialmente implementate, placeholder o aree che richiedono completamento. Per il dettaglio tecnico vedere [`ANTIGRAVITY_AGENT.md`](./ANTIGRAVITY_AGENT.md).

### Sicurezza
- **Rotazione password forzata:** auto-provisioned users hanno password default `Leone123!`. Manca `must_change_password` in `profiles` e relativa UI di primo cambio password.
- **Edge Function JWT review:** molte funzioni con `verify_jwt = false` sono interne e dovrebbero validare il chiamante.
- **Resend production domain:** attualmente in test mode. Serve configurare dominio verificato e secrets `RESEND_FROM_EMAIL`/`RESEND_FROM_NAME`.

### Sinistri
- **`/sinistri/apertura`** — wizard di apertura sinistro: ricerca polizza, dati sinistro, upload documenti, assegnazione, riepilogo.
- **`/sinistri/prescrizioni`** — gestione prescrizioni con color coding.
- **`/sinistri/scadenze`** — scadenziario sinistri.
- **`/sinistri/report-sir`** — report SIR completo.

### Contabilità
- **Ricongiungimento bancario multi-cliente:** la tabella `movimenti_polizze` supporta N clienti per movimento, ma la UI e la logica di pagamento sono in evoluzione.
- **Quadrature e chiusure:** cruscotto chiusure contabili e quadrature premi/provvigioni.

### Portafoglio
- **Collettive / Libri Matricola:** route `/portafoglio/collettive` è un `PlaceholderPage`.
- **Estrazioni avanzate:** alcune estrazioni sono in fase di consolidamento.

### Compagnie
- **Rapporti multipli per agenzia:** `compagnia_rapporti` e `compagnia_rapporto_rami` sono attivi, ma la matrice provvigioni e la gestione plurimandataria sono in evoluzione.

### AI
- **AI Assistant:** miglioramento continuativo del contesto entità (vedi `src/lib/ai/context.ts`).
- **Ricerca bandi pubblici:** script su API ufficiale TED (brokeraggio / CPV 66518100). Nessuna IA. Deduplicazione e linking a trattative in miglioramento.

### UX / Performance
- **PWA:** `service-worker.js` e `manifest.json` potrebbero richiedere aggiornamenti per nuove cache.
- **Bundle size:** monitorare dimensioni bundle e lazy-loading pagine pesanti.

---

> Ultimo aggiornamento: 2026-06-22. Se trovi informazioni non coerenti con il codice attuale, aggiorna questo file e notifica il team.
