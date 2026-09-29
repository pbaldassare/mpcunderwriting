---
name: Fiscal validators
description: Validazione P.IVA (Luhn IT) e CF (carattere di controllo) tramite helper riusabili e componente FiscalCodeInput
type: feature
---
- `src/lib/validatePIVA.ts` → checksum Luhn italiano (11 cifre).
- `src/lib/validateCF.ts` → carattere di controllo CF 16 (tabelle ODD/EVEN). Ammette anche 11 cifre per CF azienda (delegato a validatePIVA, flag `isPIVAFormat`).
- `src/components/ui/FiscalCodeInput.tsx` → wrapper su `<Input>` con kind `cf16 | piva | cf-azienda`. Auto-uppercase, strip spazi, maxLength dinamico, errore inline a blur, callback `onValidChange`.
- Usato in: `NuovoClienteDialog`, `ClienteDetail` (FieldInput mostra errore checksum), `ProspectList`, `AnagraficheCompagniePage`, `AnagraficheInternePage`, `ImportNuovaPolizzaAIDialog`.
- Submit `NuovoClienteDialog` blocca con messaggio dettagliato se P.IVA/CF non superano il checksum.
- Test: `src/lib/__tests__/validateFiscal.test.ts`.
