# Test E2E (Playwright)

Suite end-to-end per Consulnet/CBnet: login, smoke navigazione, portafoglio,
contabilità, auth/RLS e integrazioni.

## Credenziali

```sh
export TEST_USER_EMAIL="cloude@gmail.com"
export TEST_USER_PASSWORD="Leone123!"
```

Per test auth/RLS e mutazioni DB serve anche `SUPABASE_SERVICE_ROLE_KEY` nel `.env`.

## Esecuzione

```sh
bunx playwright install chromium
bun run test:e2e

# solo smoke
bunx playwright test tests/e2e/02-smoke

# portafoglio
bunx playwright test tests/e2e/04-portafoglio

# contabilità
bunx playwright test tests/e2e/05-contabilita

# auth / RLS
bunx playwright test tests/e2e/auth
```

## Struttura (2026-06)

| Cartella / file | Copertura |
|---|---|
| `00-auth.setup.ts` | Login e storageState |
| `01-login.spec.ts` | Form login (progetto dedicato) |
| `02-navigation.spec.ts` | Smoke ~70 rotte gestionale |
| `02-smoke/` | Smoke portale cliente |
| `03-clienti.spec.ts` … `08-cruscotto-filtri.spec.ts` | Test numerati legacy |
| `04-portafoglio/` | Carico filtri, immissione wizard, quietanze, messa a cassa |
| `05-contabilita/` | Movimenti bancari, ricongiungimento, anticipi |
| `09-integrazioni/` | Messa a cassa + quietanza end-to-end |
| `auth/` | Admin, sede, cliente, rotte non autorizzate |
| `contabilita/` | **Legacy** — ignorato da Playwright (vedi `05-contabilita/`) |
| `portafoglio/` | Helper condivisi (`portafoglio-helpers.ts`) |

## Helper

| File | Scopo |
|---|---|
| `helpers/auth-helper.ts` | Login, rotte, `GESTIONALE_ROUTES` |
| `helpers/db-helper.ts` | Setup/teardown Supabase (prefisso `E2E-` / `REG-E2E-`) |
| `helpers/contabilita-helper.ts` | Excel movimenti bancari, filtri carico |
| `helpers/selectors.ts` | Etichette UI italiane |
| `helpers/role-test-data.ts` | Fixture auth cross-sede |
| `fixtures/estratto-conto-sample.csv` | CSV sample per import |

## Unit test (Vitest)

```sh
bun run test
```

Copertura aggiunta: `frazionamento`, `getDefaultRoute`, `annullaMessaACassa` (mock Supabase).
