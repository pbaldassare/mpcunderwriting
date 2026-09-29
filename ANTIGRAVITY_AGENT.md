# 🤖 Antigravity 2.0 — Agent Instructions
## Project: Consulnet / CBnet — Insurance Brokerage Platform

> **Agent Role**: You are an expert full-stack engineer specialized in React + TypeScript + Supabase + Lovable projects. Your mission is to analyze, repair, and improve the Consulnet/CBnet codebase, then return clean, production-ready code to Lovable.

---

## 🎯 MISSION OVERVIEW

**Project**: Consulnet / CBnet — Gestionale assicurativo per il mercato italiano (Consulbrokers)
**Stack**: React 18.3 + TypeScript 5 + Vite 5 + shadcn/ui + TanStack Query v5 + Supabase + Resend
**Lovable Project ID**: `a3b1457e-dbbe-41da-866b-8411e8cba913`
**Supabase Ref**: `zbjmnnlojxprlogbnxef`
**Production URLs**: https://cbnet.it · https://consulnet.iaconnect.it

Your job is to:
1. **ANALYZE** the existing codebase thoroughly
2. **FIX** all known bugs and broken functionality
3. **IMPROVE** performance, security, and UX
4. **IMPLEMENT** missing features (prioritized list below)
5. **RETURN** clean, tested, production-ready code to Lovable

---

## ⚠️ CRITICAL CONSTRAINTS — READ FIRST

Before touching anything, internalize these rules:

### DO NOT BREAK
- `titoli` table has **115 columns** — never drop or rename columns
- Legacy column `prodotto_id` is deprecated but **do not delete** — use `prodotto_nome` (text) instead
- `tipo_rinnovo` is legacy — UI uses boolean `tacito_rinnovo` — **do not reintroduce** `tipo_rinnovo` in UI
- `titoli.gruppo_ramo` column has been dropped — always use `gruppi_ramo` via FK chain
- `filiali` table is **deprecated** — do not reference it in new code
- **Duplicate policies** `204366651`, `6131402092`, `RCM00010074404` are **intentional** — do NOT deduplicate or delete them (needed for Apr 2026 accounting reconciliation)
- **476 legacy agenzie** were wiped on 16/05/2026 — new agencies require `tipo` + `codice` as unique composite
- Pages already removed (Cont. Generale, FatturaPA, Fornitori, Banca Import) — **do NOT reintroduce**
- `verify_jwt = false` on most edge functions is **by design** — do not change without explicit instruction
- Pagination: **25 rows** max + **350ms debounce** — necessary for large datasets, do not increase

### ARCHITECTURE INVARIANTS
- All Supabase tables have RLS enabled — never query without respecting RLS
- Role hierarchy: L1 admin > L2 cfo > L3 ufficio/backoffice/contabilita > L4 manager > L5 produttore/corrispondente > L6 cliente/prospect
- `has_role()` is a SECURITY DEFINER SQL function — use it in RLS policies, never bypass
- Roles stored in `user_roles` table (NOT on `profiles.ruolo` alone) — always write to both
- `SearchableSelect` (Popover + Command pattern) is mandatory for all long lists — never use plain `<select>` for lists > 10 items
- `useServerPagination` hook is mandatory for all paginated lists

---

## 🔴 PRIORITY 1 — CRITICAL FIXES

### 1.1 Security: Force Password Rotation
**Problem**: Auto-provisioned users (cliente/corrispondente/prospect) get default password `Leone123!` — no forced rotation on first login.

**Fix**:
- Add `must_change_password` boolean column to `profiles` table (default `false`)
- Set `must_change_password = true` in `create-cliente-user`, `create-prospect-user`, `provision-user`, `provision-clienti-users`, `provision-corrispondenti-users` edge functions
- Add `PasswordChangeGuard` component: intercepts authenticated routes, redirects to password change page if `must_change_password = true`
- Create `/change-password` page (public-but-auth-required): form with current password + new password + confirm, calls Supabase `updateUser`, then sets `must_change_password = false` in profiles
- Apply guard to `ClienteGuard`, `ProspectGuard`, and `AuthGuard`

### 1.2 Security: Edge Function JWT Review
**Problem**: `verify_jwt = false` on 25+ edge functions — many are internal-only and should validate caller identity.

**Fix**:
- Audit each function: classify as `public` (called by unauthenticated clients) or `internal` (called only by authenticated app)
- For `internal` functions: add JWT validation header check at function entry point
- Functions that MUST stay `verify_jwt = false` (public flows): `create-user`, `create-cliente-user`, `create-prospect-user`, `bootstrap-admin`
- Functions that should validate: `calcola-provvigioni`, `gestione-rimessa`, `gestione-sinistri`, `import-*` series

### 1.3 Email: Resend Production Domain
**Problem**: Sender is `onboarding@resend.dev` — only delivers to account owner email in test mode.

**Fix**:
- Update `send-email` edge function to use verified production domain sender
- Add fallback logic: if `RESEND_VERIFIED_DOMAIN` secret is set, use it; else use test sender and log warning
- Add `RESEND_FROM_EMAIL` and `RESEND_FROM_NAME` as Supabase secrets
- Update `send-email` to read these secrets for the `from` field
- Add domain verification check in admin dashboard (`/impostazioni`) — show warning banner if domain not verified

---

## 🟠 PRIORITY 2 — BROKEN FUNCTIONALITY (Placeholders to implement)

### 2.1 Sinistri — 4 Missing Sub-Pages

#### `/sinistri/apertura` — Apertura Wizard
Multi-step wizard for opening a new sinistro:
- Step 1: Cerca polizza collegata (SearchableSelect on `titoli`, filter by cliente/numero polizza)
- Step 2: Dati sinistro (data accadimento, data denuncia, tipo sinistro, descrizione)
- Step 3: Documenti iniziali (upload via storage bucket `documenti`)
- Step 4: Assegnazione (responsabile, liquidatore)
- Step 5: Riepilogo + Conferma → INSERT into `sinistri` + INSERT into `sinistro_eventi` (tipo: `apertura`)
- On success: redirect to `/sinistri/:id`

#### `/sinistri/prescrizioni` — Prescrizioni Manager
- List view of all sinistri with `data_prescrizione` set
- Columns: numero sinistro, cliente, compagnia, data accadimento, data prescrizione, giorni alla prescrizione, stato
- Color coding: rosso < 30gg, arancione < 90gg, verde > 90gg
- Filter by: ufficio, responsabile, compagnia, range date prescrizione
- Action: click → navigate to `/sinistri/:id`
- Export to XLSX via `xlsx` library

#### `/sinistri/scadenze` — Scadenziario Sinistri
- Calendar + list view of sinistri deadlines
- Data sources: `sinistro_checklist` items with due dates + `sinistro_eventi` with scheduled follow-ups
- Views: weekly calendar (Recharts or CSS grid), list sorted by urgency
- Filter by: responsabile, compagnia, tipo scadenza
- Mark as completed: updates `sinistro_checklist.completato = true`

#### `/sinistri/report-sir` — Report Sanitario SIR
- Form-based report generation for infortuni/malattia sinistri
- Fields: dati anagrafici infortunato, medico curante, diagnosi, prognosi, invalidità permanente %
- PDF generation via `genera-pdf-template` edge function with SIR template
- Store generated PDF in `documenti` bucket linked to sinistro

### 2.2 Portafoglio — Collettive / Libri Matricola
**Route**: `/portafoglio/collettive`

Implement collective policy management:
- List view of `titoli` where `tipo_polizza = 'collettiva'` (or equivalent flag)
- Detail view: madre policy + matricola entries (list of insured subjects)
- CRUD for matricola entries
- PDF export of libro matricola

### 2.3 Contabilità — Stampa Sospesi
**Route**: `/contabilita/stampa-sospesi`

- Query `titoli` where `stato = 'sospeso'` grouped by ufficio/compagnia
- Printable table: numero polizza, cliente, compagnia, ramo, premio lordo, data sospensione, giorni sospeso
- Filter by: ufficio, compagnia, ramo, range date
- Export PDF via `genera-pdf-template`
- Export XLSX

---

## 🟡 PRIORITY 3 — IMPROVEMENTS

### 3.1 Email System — Queue + Retry
**Problem**: Email sends are fire-and-forget with no queue, retry, or DLQ.

**Implement**:
- Add `email_send_log` table: `id, created_at, to, subject, template_id, status (pending/sent/failed/bounced), attempts, last_attempt_at, error_message, resend_message_id`
- Modify `send-email` edge function: log every send to `email_send_log`; on Resend error, set `status = failed`
- Add `retry-failed-emails` edge function: cron every 30min, picks `status = failed AND attempts < 3`, retries
- Admin UI in `/impostazioni`: show `email_send_log` with filter by status, re-send button for failed

### 3.2 Email — Automated Triggers
Add these automated email flows (beyond existing `messa a cassa`):

| Trigger | When | Template |
|---|---|---|
| Scadenza polizza | 60gg, 30gg, 7gg before `data_scadenza` | `scadenza_polizza` |
| Rinnovo polizza | On quietanza generation | `rinnovo_polizza` |
| Nuovo sinistro | On sinistro INSERT | `apertura_sinistro` |
| Password reset | User requests reset | Branded (override Supabase default) |

- Add `scadenziario_job` edge function (cron daily 08:00) that queries expiring policies and triggers `send-email`
- Store template references in `template_email` table (already exists)

### 3.3 Auth — Branded Email Templates
**Problem**: Supabase Auth emails (signup, recovery, magiclink) use Supabase defaults — not branded.

**Fix**:
- In Supabase dashboard, configure custom SMTP to route through Resend
- Override auth email templates with branded HTML (use `email_branding` table data)
- Use domain `cbnet.it` as sender once verified

### 3.4 Performance — Query Optimization
- Add database indexes on high-frequency filter columns: `titoli.stato`, `titoli.data_scadenza`, `titoli.cliente_id`, `titoli.compagnia_id`, `sinistri.stato`, `sinistri.responsabile_id`
- Ensure materialized views for dashboard KPIs are refreshed via cron edge function (daily + on-demand)
- Add `EXPLAIN ANALYZE` comments in edge functions for queries > 100ms
- Implement `staleTime: 300000 * 60 * 1000` in TanStack Query for lookup tables (rami, compagnie, etc.) — these change rarely

### 3.5 UX — Titoli Form (115 columns)
**Problem**: The `titoli` form is very heavy with 115 columns.

**Improve**:
- Verify all `PolizzaSection` components are lazy-loaded (React.lazy + Suspense)
- Add section collapse/expand state persisted in `localStorage` per user
- Add "Completamento profilo" progress bar showing filled vs empty optional fields
- Sticky section navigation sidebar for desktop (jump to: Dati Principali, RCA, Garanzie, Documenti, etc.)

### 3.6 Dashboard — CFO Improvements
- Add Recharts area chart: premi incassati vs premi in attesa (last 12 months rolling)
- Add KPI tile: tasso di rinnovo (polizze rinnovate / polizze in scadenza, last 90 days)
- Add sinistri aperti / chiusi ratio tile
- All new dashboard data must use existing materialized views or new ones — never unbounded queries

### 3.7 Bulk Operations — Pagamenti Provvigioni
**Problem**: `pagamenti_provvigioni` data model exists but UI is minimal.

**Implement**:
- Bulk selection UI with checkbox column in `provvigioni_generate` list
- "Segna come pagato" bulk action: INSERT into `pagamenti_provvigioni` + `pagamenti_provvigioni_righe`
- PDF distinta pagamento via `genera-distinta-pdf` edge function
- Filter by: produttore, periodo, stato (da pagare / pagato)

---

## 🔵 PRIORITY 4 — TECHNICAL DEBT

### 4.1 TypeScript Strictness
- Enable `strict: true` in `tsconfig.json` if not already
- Fix all `any` types in hooks and service layers
- Add proper types for all Supabase query returns (use `Database` generated types)

### 4.2 Error Boundaries
- Wrap each route group in its own `<AppErrorBoundary>` with contextual fallback UI
- Add Sentry or similar error tracking (or use `anomalie_sistema` table for client-side errors)

### 4.3 Edge Function Hardening
- Add input validation (Zod) at the entry point of every edge function that accepts a request body
- Standardize response format: `{ success: boolean, data?: unknown, error?: string }`
- Add request logging to `performance_log` for functions > 2s response time

### 4.4 PWA — Client Portal
- Verify service worker cache strategy for offline-first on `/cliente/polizze` and `/cliente/scadenze`
- Add install prompt for iOS (WKWebView detection)
- Push notifications for scadenze via Supabase Realtime → service worker

---

## 📐 CODE STANDARDS

### Component Structure
```
src/
  components/
    [feature]/
      [FeatureName].tsx          # Main component
      [FeatureName].types.ts     # Types/interfaces
      hooks/use[FeatureName].ts  # Feature-specific hook
      index.ts                   # Barrel export
```

### Data Fetching Pattern
Always use TanStack Query v5:
```typescript
// ✅ Correct
const { data, isLoading, error } = useQuery({
  queryKey: ['titoli', filters],
  queryFn: () => fetchTitoli(filters),
  staleTime: 300000,
})

// ❌ Never use useEffect + useState for server data
```

### Supabase Query Pattern
```typescript
// ✅ Always paginate
const { data, count } = await supabase
  .from('titoli')
  .select('*', { count: 'exact' })
  .range(offset, offset + PAGE_SIZE - 1)  // PAGE_SIZE = 25
  .order('created_at', { ascending: false })

// ❌ Never unbounded
const { data } = await supabase.from('titoli').select('*')
```

### Form Pattern
```typescript
// ✅ Always React Hook Form + Zod
const schema = z.object({ ... })
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})
```

### Long Lists
```typescript
// ✅ Always SearchableSelect for lists > 10 items
<SearchableSelect
  options={compagnie}
  value={value}
  onValueChange={onChange}
  placeholder="Cerca compagnia..."
/>

// ❌ Never plain Select for long lists
```

---

## 🧪 TESTING CHECKLIST

Before returning code to Lovable, verify:

- [ ] All 6 user roles can log in and see correct routes
- [ ] `titoli` CRUD: create, read, update, quietanza auto-generation on messa a cassa
- [ ] RLS: L5 produttore cannot see other producers' titoli
- [ ] Email: `send-email` edge function returns 200 with valid payload
- [ ] PDF: `genera-pdf-template` returns valid base64 PDF
- [ ] New sinistri pages: apertura wizard completes without error
- [ ] Password rotation: auto-provisioned user is redirected to `/change-password` on first login
- [ ] Mobile/PWA: client portal renders correctly on 375px viewport
- [ ] No TypeScript errors: `tsc --noEmit` passes clean
- [ ] No console errors on page load for any main route

---

## 🗃️ DATABASE REFERENCE

### Key Tables
| Table | Cols | Purpose |
|---|---|---|
| `titoli` | 115 | Central policy entity |
| `clienti` | 86 | Client anagraphics |
| `compagnie` | 50 | Insurance companies |
| `compagnia_rapporti` | 30 | N:N company-office mandates |
| `sinistri` | 38 | Claims |
| `trattative` | 24 | Negotiations |
| `profiles` | 32 | User profiles |
| `user_roles` | — | Role assignments |

### Critical Enums
- `app_role`: `admin`, `cfo`, `ufficio`, `backoffice`, `contabilita`, `manager`, `produttore`, `corrispondente`, `cliente`, `prospect`
- `titolo_stato`: `attivo`, `incassato`, `sospeso`, `stornato`, `annullato`
- `movimento_tipo`: `PI` (prima installazione), `PQ` (quietanza), `AM` (appendice modifica)

### Auth Pattern
```sql
-- Always use has_role() in RLS policies
CREATE POLICY "users see own data" ON profiles
  FOR SELECT USING (id = auth.uid() OR has_role('admin'));
```

---

## 📧 ENVIRONMENT VARIABLES

```env
# Frontend (Vite)
VITE_SUPABASE_URL=https://zbjmnnlojxprlogbnxef.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon JWT>
VITE_SUPABASE_PROJECT_ID=zbjmnnlojxprlogbnxef
VITE_APP_ENV=DEV  # or PROD
VITE_GOOGLE_MAPS_API_KEY=<key>

# Edge Function Secrets (Supabase Dashboard)
SUPABASE_URL=auto
SUPABASE_ANON_KEY=auto
SUPABASE_SERVICE_ROLE_KEY=auto
SUPABASE_DB_URL=auto
LOVABLE_API_KEY=<Gemini gateway>
RESEND_API_KEY=<key>
RESEND_FROM_EMAIL=noreply@cbnet.it  # ADD THIS
RESEND_FROM_NAME=CBnet              # ADD THIS
MOONSHOT_API_KEY=<key>          # Kimi (alias MOONSHINE_API_KEY)
TAVILY_API_KEY=<key>            # fallback ricerca bandi
SERPER_API_KEY=<key>            # fallback ricerca bandi
```

---

## 🚀 DELIVERY FORMAT

When returning code to Lovable:
1. Provide a **summary of changes** at the top (what was fixed, what was added)
2. For each changed file: full file content (not diffs)
3. For new DB migrations: provide the SQL as a numbered migration file
4. For new edge functions: provide complete `index.ts` content
5. Flag any **manual steps** required (Supabase dashboard config, secret additions, etc.)
6. Update `PROJECT_DOCUMENTATION.md` sections 7, 8, 9 to reflect the new state

---

*Agent generated by Antigravity 2.0 · Project: Consulnet/CBnet · June 2026*
