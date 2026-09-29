---
name: Demo Ospedale Pubblico
description: Utenza demo cliente ente sanitario pubblico con polizze e sinistri simulati per il portale /cliente
type: feature
---

## Credenziali login portale cliente
- **Email**: protocollo@medical.it
- **Password**: Leone123!
- **Cliente ID**: `c9f5a3b1-7e4d-5f8a-0c2b-3d4e5f6a7b81`
- **Ragione sociale**: Azienda Ospedaliera Universitaria Demo
- **Gruppo finanziario**: `AZ_SAN_PUB` (Aziende Sanitarie Pubbliche)
- **Sede broker**: SEDE SAN DONA' DI PIAVE (`327e92f7-64f0-48b9-9e48-73611d8cb406`)

## Setup (una tantum)
1. Applicare migration `20260709153000_seed_ospedale_pubblico_demo.sql`
2. Invocare edge function `seed-ospedale-demo` (crea utente auth + PDF placeholder):
   ```sh
   curl -X POST "$SUPABASE_URL/functions/v1/seed-ospedale-demo" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## Dati simulati (marcati [DEMO] nelle note)
- **10 polizze** `titoli` prefisso `DEMO-OS-2025-*` e `DEMO-OS-2026-*` (RC medica, RCT/O, infortuni, All Risks, cyber, tutela, RCA ambulanze)
- **6 sinistri** `sinistri` prefisso `SIN-OS-*` (malpractice, infortunio, furto, caduta visitatore, cyber, tamponamento ambulanza)
- **Documenti** in bucket `documenti_clienti` e `documenti_titoli` (PDF placeholder generati dalla edge function)

## Esclusione dai report finanziari reali
```sql
WHERE numero_titolo NOT LIKE 'DEMO-OS-%' AND numero_sinistro NOT LIKE 'SIN-OS-%'
```
oppure `WHERE note IS NULL OR note NOT LIKE '[DEMO]%'`.

## Portale cliente
Stessa struttura del Comune di Varese: `/cliente` (dashboard, polizze, sinistri, documenti, assistente AI).
Differenziazioni ospedaliere previste in fase 2 (label UI, widget RC medica, mappa Milano).
