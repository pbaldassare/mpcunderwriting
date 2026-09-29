## Obiettivo

Allineare il codebase attuale a `github.com/pbaldassare/consulbrokers` branch `main`, assunto come fonte di verità.

## Contesto verificato

- Branch di lavoro locale = `origin/main` (mirror interno Lovable): 0 commit di differenza, working tree clean.
- Nessun URL `github.com` referenziato in `.git/config` o nel progetto.
- Cercando "Acconti" nel codebase attuale: la label è `"Acconti"` in sidebar, breadcrumb, card cliente e chip. La stringa `"Acconti e Compensazioni"` non esiste da nessuna parte.
- Conclusione: se GitHub ha "Acconti e Compensazioni" (o altre differenze), la Lovable↔GitHub sync non ha portato indietro quei commit. Va verificato clonando davvero il repo.

## Passi

1. **Clone** in `/tmp/ghcheck/consulbrokers` (fuori dal progetto, non tocca `/dev-server/.git`).
2. **Diff strutturale**:
   - `diff -rq /tmp/ghcheck/consulbrokers /dev-server` filtrato per escludere `node_modules`, `dist`, `.git`, `bun.lock*`, `package-lock.json`.
   - Elenco: file solo su GitHub, file solo in locale, file diversi.
3. **Diff per aree critiche** (per capire la natura delle divergenze):
   - `src/pages/**`, `src/components/**`, `src/routes/**`, `src/lib/**`
   - `src/components/AppSidebar.tsx` e `src/components/PageBreadcrumb.tsx` (verifica label "Acconti")
   - `supabase/migrations/**` e `supabase/functions/**`
   - `index.html`, `package.json`, `tailwind.config.*`, `vite.config.*`
4. **Report sintetico** all'utente prima di scrivere:
   - N file da aggiornare, N da creare, N da rimuovere.
   - Elenco puntuale con dimensione del delta (righe +/-) per i primi 30 file più grossi.
   - Segnalazione esplicita di: migrations nuove (potenziale impatto DB), edge functions nuove/modificate, cambi di schema tipi Supabase (`src/integrations/supabase/types.ts`), route/permessi diversi.
5. **Sospensione per conferma**: chiedo esplicitamente l'ok prima di sovrascrivere. Motivo: gli ultimi commit locali (`Fixed CfoExplorer TS errors`, `Aggiornato annullamento incasso`, migrazioni `data_copertura` / `coassicurazione` / `note_interne`, RPC `annulla_quietanza_incasso` aggiornata) potrebbero non essere su GitHub e andrebbero persi.
6. **Applicazione dell'allineamento** (dopo conferma):
   - Copia file per file dallo stato GitHub → locale, escludendo qualsiasi cosa dentro `.git/`, `node_modules/`, `dist/`, `.lovable/`, e lock file di bun a meno che tu non chieda esplicitamente di allinearli.
   - Rimozione dei file presenti solo in locale ma non su GitHub, previa conferma per lista.
   - Non tocco `src/integrations/supabase/client.ts` e `types.ts` se sono generati (verifico prima).
7. **Post-allineamento**:
   - Se ci sono migrations nuove da GitHub non ancora applicate al DB, le eseguo con lo strumento migration di Supabase.
   - Verifico che il build TypeScript passi; sistemo eventuali rotture minori nate dal merge.

## Cosa NON faccio in questo piano

- Non tocco il DB oltre alle migrations che risultano nuove su GitHub.
- Non uccido i commit locali finché non hai visto la lista delle differenze e detto "procedi".
- Non allineo `bun.lock*` / `package-lock.json` (rigenerati da `bun install`) a meno che tu lo chieda.

## Domanda unica prima di partire

Se durante lo step 4 vedo che l'allineamento **cancellerebbe** i tuoi ultimi commit locali (migrations e RPC citate sopra), come devo comportarmi?
- (A) Vince sempre GitHub → sovrascrivo tutto.
- (B) Fermo tutto e ti mostro cosa perderesti → decidi tu file per file.
- (C) Vince sempre il locale in caso di conflitto → uso GitHub solo per aggiungere file/rinomine ma non per sovrascrivere.

Il default che consiglio è **(B)**.
