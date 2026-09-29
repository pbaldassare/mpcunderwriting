---
name: UX form primitives
description: Tre componenti riusabili per validazione real-time, tooltip su campi tecnici e conferme distruttive con typing — da adottare in tutte le form.
type: feature
---

## Componenti

### 1. `ValidatedInput` — `@/components/ui/validated-input`

Input con validazione live (CF, P.IVA, IBAN, email, custom). Mostra icona ✓/✗ a destra,
bordo colorato, messaggio errore inline. Normalizza a maiuscolo per CF/PIVA/IBAN.

```tsx
<ValidatedInput
  kind="cf"
  value={cf}
  onChange={setCf}
  placeholder="Codice Fiscale"
/>
```

`kind`: `"cf" | "piva" | "iban" | "email" | "custom"`. Per `"custom"` passare prop `validator`.
Riutilizza i validator esistenti in `@/lib/validate{CF,PIVA,Iban}`.

### 2. `FieldHint` — `@/components/ui/field-hint`

Icona "?" hoverable con tooltip per campi tecnici (`mora_giorni`,
`percentuale_ae`, `tacito_rinnovo`, ecc.). Affianca la label senza
appesantire la UI.

```tsx
<Label>Mora giorni <FieldHint>Giorni di tolleranza dopo la scadenza prima che la copertura decada.</FieldHint></Label>
```

### 3. `ConfirmTypingDialog` — `@/components/ui/confirm-typing-dialog`

Conferma distruttiva che richiede di digitare una stringa esatta (es. numero
polizza, ragione sociale) per abilitare il pulsante. Da usare per cancellazioni,
storni, reset.

```tsx
<ConfirmTypingDialog
  open={open} onOpenChange={setOpen}
  title="Cancellare polizza?"
  confirmationText={t.numero_titolo}
  description="L'operazione è irreversibile."
  onConfirm={handleDelete}
/>
```

## Convenzione di adozione

Sostituire progressivamente:
- `<Input>` su campi CF / P.IVA / IBAN / email → `<ValidatedInput kind="...">`
- Tooltip ad-hoc su campi tecnici → `<FieldHint>`
- `AlertDialog` distruttivi con solo "Conferma" → `ConfirmTypingDialog`
