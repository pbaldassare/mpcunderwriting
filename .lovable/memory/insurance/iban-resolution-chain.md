---
name: IBAN resolution chain for client communications
description: Catena di priorità per scegliere l'IBAN da proporre al cliente in PDF/email — Specialist → Sede → default Consulbrokers
type: feature
---

## Catena di priorità IBAN cliente

Per qualsiasi comunicazione finanziaria al cliente (E/C cliente PDF, email solleciti) l'IBAN proposto segue questa priorità:

1. **Specialist assegnato al cliente** — `profiles.conto_bancario_id` dello Specialist con `ruolo='backoffice'` collegato via `codici_commerciali_cliente.profilo_id` con `ruolo='Backoffice'`.
2. **Sede del cliente** — `uffici.conto_bancario_id` dell'ufficio in `clienti.ufficio_id`.
3. **Default Consulbrokers** (silenzioso) — riga in `conti_bancari` con `tipo='incasso_clienti' AND is_default=true AND attivo=true`. Garantito dalla migration: se manca, viene creato un placeholder.

## Implementazione

- Funzione SQL: `public.get_iban_cliente(p_cliente_id uuid)` ritorna `(iban, intestato_a, banca, bic, fonte)` con `fonte ∈ ('specialist','sede','default','nessuno')`.
- Helper TS: `src/lib/resolveIbanCliente.ts` espone `resolveIbanCliente(clienteId)`.
- Trigger `enforce_single_default_conto` su `conti_bancari` impedisce più di un `is_default=true` per ogni `tipo`.

## UX

- L'IBAN proposto è **sempre editabile** dall'operatore prima della stampa/invio (campo libero in `ECClientePdfPage`).
- Sotto il campo viene mostrata la fonte ("Specialist assegnato", "Sede del cliente", "Default Consulbrokers") solo come info, mai come blocco.
- Nessun avviso "IBAN non configurato": il default Consulbrokers entra silenziosamente.

## Where to set the IBAN

- Per Specialist: tab "Banca" in `SpecialistList.tsx` → `ContoBancarioSelect` con `tipi=["incasso_clienti"]`.
- Per Sede: dialog "Modifica Sede" in `SediManager.tsx` → `ContoBancarioSelect` con `tipi=["incasso_clienti"]`.
- Conto master e gestione default: `/archivi/conti-bancari` (`ContiBancariPage.tsx`).

## Legacy

- `uffici.iban`, `uffici.intestato_a`, `uffici.banca`: deprecati, non più editati da UI ma lasciati per back-compat.
- `uffici.conto_incasso_id`: campo errato che puntava a `conti_incasso` (classificatore primanota), non più usato per IBAN.
- `profiles.iban`, `profiles.intestatario_cc`: legacy free-text, ancora visibili in form Specialist ma il valore di verità per i PDF è `conto_bancario_id`.
