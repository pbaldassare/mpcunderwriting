---
name: Chat contestuale - sync membri e roster
description: Il ChatTab persiste su chat_canali (DB) e ad ogni apertura sincronizza i membri ricalcolando findAllRelatedUsers (cliente, produttori, specialist=backoffice, AE/Consul, staff sede inclusi responsabile_sede). Mostra un roster header con avatar+nome+ruolo (terminologia Specialist/Consul/Sede). I membri storici non vengono mai rimossi. Tab "Timeline" rinominato "Log Attività" e aggrega log di cliente + titoli + sinistri + trattative collegate via prop extraEntities di TimelineTab.
type: feature
---

## Persistenza
- Canale salvato in `chat_canali` (ambito='contestuale', entita_tipo, entita_id).
- Messaggi in `chat_messaggi_interni`.
- Membri in `chat_canali_membri` con UNIQUE(canale_id, user_id) — abilita upsert sicuri.

## Sync automatica membri
A ogni apertura del tab Chat viene eseguito un useQuery che:
1. Chiama `findAllRelatedUsers(entitaTipo, entitaId)`.
2. Confronta con membri esistenti del canale.
3. Inserisce solo i nuovi via upsert con `onConflict: 'canale_id,user_id', ignoreDuplicates: true`.
4. Mai rimuove membri storici (preserva storia conversazionale).

## Roster header
Lista pill con iniziali+nome+ruolo logico mappato a terminologia UI:
- backoffice/Backoffice → Specialist
- produttore → Produttore, Agente, Consul N (corrispondenti)
- ufficio → Sede, responsabile_sede → Resp. Sede

## Log Attività (ex Timeline)
ClienteDetail passa al `TimelineTab` la prop `extraEntities` con gli ID di:
- titoli del cliente (`titoli.cliente_anagrafica_id`)
- sinistri (`sinistri.cliente_anagrafica_id`)
- trattative (`trattative.cliente_id`)

`TimelineTab` aggrega tutti i log di `log_attivita` ordinati per data.
