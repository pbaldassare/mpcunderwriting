// Schema database esposto al modello AI.
// Le colonne riportate qui sono allineate al DB reale (verificate via information_schema).
// Tutte le query passano da ai_exec_select (SELECT-only) e rispettano RLS dell'utente.

export const SCHEMA_CONTEXT = `
# Schema database (PostgreSQL via Supabase, schema "public")

## REGOLE GENERALI
- Tutte le query vengono eseguite con la sessione dell'utente: vedi solo ciò che le RLS gli permettono.
- Limita SEMPRE i risultati con LIMIT (max 100). Usa ORDER BY per le date più rilevanti.
- Per nomi/testi usa ILIKE '%termine%' (case-insensitive). Prova varianti se non trovi nulla.
- Date in formato ISO (YYYY-MM-DD). Importi in EUR (numeric).
- Per domande aggregate (totali, conteggi, medie) usa SUM/COUNT/AVG/GROUP BY: NON ritornare righe grezze.
- Se non sei sicuro di una colonna, chiama prima il tool "describe_table".
- Per l'utente corrente usa auth.uid().

## ALIASES UI → DB (terminologia interfaccia)
- "Sede" = ufficio (tabella uffici, FK ufficio_id)
- "Specialist" / "Backoffice" = ruolo nel profilo (profiles.ruolo = 'backoffice')
- "Account Executive" / "AE" = ruolo commerciale principale (profiles.ruolo = 'executive', titoli.ae_nome)
- "Consul" / "Produttore" = profiles.ruolo = 'produttore' (titoli.produttore_nome)
- "Commerciale" sulla polizza = anagrafica esterna (titoli.anagrafica_commerciale_id → anagrafiche_professionali)
- "Trattativa" = trattative; "Polizza"/"Titolo" = titoli (vista: v_portafoglio_titoli)

## TABELLE PRINCIPALI

### clienti
Anagrafica clienti (privati, aziende, enti).
Campi chiave: id, tipo_cliente ('privato'|'azienda'|'ente'), tipo_persona, nome, cognome,
ragione_sociale, codice_fiscale, partita_iva, email, pec, telefono, cellulare,
indirizzo_residenza/sede, citta_residenza/sede, provincia_residenza/sede, ufficio_id,
attivo, stato_cliente, gruppo_finanziario_id, settore, attivita, fatturato, num_dipendenti.
Nome visibile: COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email).

### v_portafoglio_titoli (VISTA PRINCIPALE delle polizze)
Una riga per polizza. Usa SEMPRE questa vista invece di "titoli" per visualizzare/filtrare polizze.
Campi: id, numero_titolo, stato ('attivo'|'sospeso'|'scaduto'|'annullato'), data_decorrenza
(durata_da), data_scadenza (durata_a), data_messa_cassa, data_pagamento,
premio_lordo, premio_netto, importo_incassato, data_incasso,
cliente_anagrafica_id, cliente_nome_display, cliente_codice_fiscale, cliente_tipo,
compagnia_id, compagnia_nome, compagnia_codice,
ramo_id, ramo_nome, ramo_codice, gruppo_ramo (es. 'RCA','INFORTUNI'),
ufficio_id, nome_ufficio, produttore_id, produttore_nome, ae_nome, specialist,
tipo_portafoglio, periodicita, rate, tipo_rinnovo, indicizzata, regolazione,
conferimento_gestito, fondi_ricevuti, data_conferimento_gestito,
data_sospensione, data_riattivazione, motivo_sospensione,
sostituisce_polizza, storno_polizza, targa_telaio, vincolo, descrizione_polizza.

### titoli
Tabella sorgente delle polizze (più colonne tecniche di v_portafoglio_titoli).
Usala SOLO per JOIN avanzati (es. con anagrafica_commerciale_id, percentuale_commerciale,
percentuale_riparto, provvigioni_firma, provvigioni_quietanza).
Campo chiave: tacito_rinnovo (boolean, default true) → true = polizza a tacito rinnovo,
false = scadenza naturale/disdetta. Usa SEMPRE questo campo per filtrare/contare il
tacito rinnovo. Il vecchio campo testuale 'tipo_rinnovo' è legacy e NON va usato.
Campo prodotto: usa SEMPRE 'prodotto_nome' (text, testo libero) come verità per il
nome prodotto della polizza. La FK 'prodotto_id' → tabella 'prodotti' è legacy:
NON va letta né scritta (0 polizze su 1047 la usano).

### titoli_movimenti
Storico movimenti polizza (rinnovi, sospensioni, ecc.). Collega titoli nel tempo.

### appendici_polizza
Varianti contrattuali su una polizza.
Campi: id, titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, testo, tipo, file_path.

### sinistri
Campi: id, numero_sinistro, numero_sinistro_compagnia, titolo_id, cliente_id, compagnia_id,
responsabile_id (FK profiles), perito_id, liquidatore_id, ufficio_id, ramo_sinistro,
stato ('bozza'|'in_valutazione'|'aperto'|'in_lavorazione'|'in_attesa_documenti'|'in_liquidazione'|'chiuso'|'respinto'|'archiviato'), tipo_sinistro,
data_apertura, data_chiusura, data_evento, data_denuncia, descrizione, dinamica,
costo_preventivato, costo_effettivo, importo_liquidato, importo_riserva, franchigia,
targa_veicolo, controparte, luogo_sinistro, citta_sinistro, provincia_sinistro.

### trattative
Pipeline commerciale (CRM). Una trattativa è collegata a un prospect OPPURE a un cliente esistente.
Campi reali: id, prospect_id (FK prospect), cliente_id (FK clienti), compagnia_id (FK compagnie),
ramo_id (FK rami), ufficio_id (FK uffici),
prodotto (text libero, es. 'RCA Auto','Vita'), sottoprodotto (text), compagnia (text LEGACY: preferire compagnia_id→compagnie.nome),
fonte (text: 'sito','telefono','referral',...),
premio_previsto (numeric), premio_effettivo (numeric, valorizzato a chiusura vinta),
stato ('aperta'|'contatto'|'preventivo'|'in_negoziazione'|'chiuso_vinto'|'chiuso_perso'),
priorita ('bassa'|'media'|'alta'),
data_apertura (date), data_scadenza (date, prossima azione), data_chiusura (date), motivo_chiusura (text),
assegnato_a (FK profiles — NON usare "responsabile_id"!), created_by (FK profiles),
archiviata (boolean, default false), note (text), created_at, updated_at.
Per il nome del contatto usa JOIN: COALESCE(c.ragione_sociale, c.cognome||' '||c.nome,
                                            p.ragione_sociale, p.cognome||' '||p.nome)
con LEFT JOIN clienti c ON c.id=t.cliente_id e LEFT JOIN prospect p ON p.id=t.prospect_id.

### prospect
Contatti commerciali pre-cliente (privati e aziende). Quando convertiti popolano convertito_cliente_id.
Campi reali: id, tipo_cliente ('privato'|'azienda'|'ente'),
nome, cognome, ragione_sociale, codice_fiscale, partita_iva,
email, pec, telefono, cellulare,
indirizzo_residenza, citta_residenza, provincia_residenza, cap_residenza,
indirizzo_sede, citta_sede, provincia_sede, cap_sede,
fonte (text), stato (text libero, filtra con ILIKE),
assegnato_a (FK profiles), ufficio_id (FK uffici),
convertito_cliente_id (FK clienti — IS NOT NULL ⇒ prospect convertito in cliente),
settore, attivita, codice_ateco, fascia_fatturato, fascia_dipendenti,
created_at, updated_at.
Nome visibile: COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email).

### compagnie
Compagnie assicurative. Campi: id, nome, nome_segue, codice, partita_iva, codice_fiscale,
attiva, stato, gruppo_compagnia, gruppo_compagnia_id, tipo_mandatario, tipo_pagamento,
iban, citta_banca, percentuale_ra, mail, pec.

### rami
Rami assicurativi. Campi: id, codice, descrizione, gruppo (es. 'RCA','INFORTUNI','INCENDIO').

### uffici
Sedi. Campi: id, nome_ufficio, citta, attivo.

### profiles
Utenti interni. Campi: id, nome, cognome, email, ruolo
('admin'|'executive'|'backoffice'|'produttore'|'corrispondente'|'cliente'|'prospect'),
ufficio_id, attivo, codice_contabile.

### nominativi_cliente
Referenti multipli per cliente. Campi: id, cliente_id, nome, cognome, email, telefono, ruolo, note.

### anagrafiche_professionali
Anagrafiche esterne (commerciali, periti, liquidatori, fornitori).
Campi: id, tipo, nome, cognome, ragione_sociale, codice_fiscale, partita_iva,
compagnia_id, ufficio_id, percentuale_base, percentuale_consulenza, percentuale_ra, attivo.

### codici_commerciali_cliente
Assegnazioni commerciali su cliente.
Campi: id, cliente_id, ruolo (es. 'AE','specialist','consul'), profilo_id (FK profiles),
percentuale, mandato, data_acquisito, scadenza_mandato, data_disdetta, altro_broker.

### provvigioni_generate
Calcolo provvigioni per polizza/utente.
Campi: id, titolo_id, user_id (FK profiles), tipo_destinatario ('produttore'|'commerciale'|'sede'),
percentuale, importo_provvigione, calcolata_il, pagata.

### pagamenti_provvigioni
Distinte pagamento provvigioni.
Campi: id, ufficio_id, pagato_a_user_id, periodo_da, periodo_a, totale_importo,
metodo, riferimento, note, creato_da.

### movimenti_contabili
Cassa per ufficio.
Campi: id, ufficio_id, tipo ('entrata'|'uscita'), categoria, importo, data_movimento,
descrizione, riferimento_tipo, riferimento_id, stato, iva_aliquota, iva_imponibile, iva_importo.

### rimesse / rimesse_righe
Rimesse alle compagnie (sintetico — usa describe_table per dettagli).

### notifiche
Campi: id, destinatario_id (FK profiles, NON "user_id"!), ufficio_id, tipo, titolo,
messaggio, entita_tipo, entita_id, priorita, letto, created_at.

### log_attivita
Audit log. Campi: id, user_id, azione, entita_tipo, entita_id, dettagli_json, ufficio_id, severity.

## GLOSSARIO STATI
- titoli.stato: 'attivo' | 'sospeso' | 'scaduto' | 'annullato'
- sinistri.stato: 'bozza' | 'in_valutazione' | 'aperto' | 'in_lavorazione' | 'in_attesa_documenti' | 'in_liquidazione' | 'chiuso' | 'respinto' | 'archiviato'
- trattative.stato: 'aperta' | 'contatto' | 'preventivo' | 'in_negoziazione' | 'chiuso_vinto' | 'chiuso_perso'
- clienti.stato_cliente / prospect.stato: testuale libero (filtra con ILIKE).

## ESEMPI DI QUERY UTILI

-- Quante trattative ho aperte (assegnate a me):
SELECT COUNT(*) AS aperte
FROM trattative
WHERE assegnato_a = auth.uid()
  AND stato NOT IN ('chiuso_vinto','chiuso_perso')
  AND COALESCE(archiviata,false) = false;

-- Trattative aperte raggruppate per stato:
SELECT stato, COUNT(*) AS num, SUM(premio_previsto) AS premio_totale
FROM trattative
WHERE COALESCE(archiviata,false) = false
GROUP BY stato ORDER BY num DESC;

-- Polizze in scadenza nei prossimi 30 giorni:
SELECT numero_titolo, cliente_nome_display, compagnia_nome, ramo_nome, data_scadenza, premio_lordo
FROM v_portafoglio_titoli
WHERE data_scadenza BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  AND stato = 'attivo'
ORDER BY data_scadenza ASC LIMIT 100;

-- Polizze RCA in scadenza per cliente specifico:
SELECT numero_titolo, compagnia_nome, data_scadenza, premio_lordo, targa_telaio
FROM v_portafoglio_titoli
WHERE cliente_nome_display ILIKE '%rossi%'
  AND gruppo_ramo = 'RCA'
  AND stato = 'attivo'
ORDER BY data_scadenza ASC LIMIT 50;

-- Top 10 clienti per premio totale anno corrente:
SELECT cliente_nome_display, COUNT(*) AS num_polizze, SUM(premio_lordo) AS premio_tot
FROM v_portafoglio_titoli
WHERE EXTRACT(YEAR FROM data_decorrenza) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY cliente_nome_display
ORDER BY premio_tot DESC NULLS LAST LIMIT 10;

-- Premi totali per compagnia ultimo trimestre:
SELECT compagnia_nome, COUNT(*) AS polizze, SUM(premio_lordo) AS premio
FROM v_portafoglio_titoli
WHERE data_decorrenza >= date_trunc('quarter', CURRENT_DATE)
GROUP BY compagnia_nome
ORDER BY premio DESC LIMIT 20;

-- Sinistri aperti con riserva > 0:
SELECT numero_sinistro, data_apertura, importo_riserva, importo_liquidato,
       (SELECT cliente_nome_display FROM v_portafoglio_titoli v WHERE v.id = s.titolo_id) AS cliente
FROM sinistri s
WHERE stato IN ('aperto','in_lavorazione')
  AND COALESCE(importo_riserva,0) > 0
ORDER BY importo_riserva DESC LIMIT 50;

-- Polizze sospese da riattivare:
SELECT numero_titolo, cliente_nome_display, data_sospensione, motivo_sospensione
FROM v_portafoglio_titoli
WHERE stato = 'sospeso'
ORDER BY data_sospensione DESC LIMIT 50;

-- Provvigioni mie maturate ma non pagate:
SELECT SUM(importo_provvigione) AS totale, COUNT(*) AS num
FROM provvigioni_generate
WHERE user_id = auth.uid() AND pagata = false;

-- Provvigioni pagate vs maturate ultimo mese:
SELECT pagata, SUM(importo_provvigione) AS totale, COUNT(*) AS num
FROM provvigioni_generate
WHERE calcolata_il >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
  AND calcolata_il < date_trunc('month', CURRENT_DATE)
GROUP BY pagata;

-- Polizze in conferimento gestito non ancora liquidate dalla compagnia:
SELECT numero_titolo, cliente_nome_display, compagnia_nome, premio_lordo, data_conferimento_gestito
FROM v_portafoglio_titoli
WHERE conferimento_gestito = true AND COALESCE(fondi_ricevuti, false) = false
ORDER BY data_conferimento_gestito ASC LIMIT 50;

-- Cassa entrate del mese corrente per ufficio:
SELECT ufficio_id, SUM(importo) AS entrate
FROM movimenti_contabili
WHERE tipo = 'entrata' AND data_movimento >= date_trunc('month', CURRENT_DATE)
GROUP BY ufficio_id;

-- ============== TRATTATIVE & PROSPECT ==============

-- Pipeline trattative per stato (totali e premio):
SELECT stato, COUNT(*) AS num,
       SUM(premio_previsto) AS premio_previsto,
       SUM(premio_effettivo) AS premio_effettivo
FROM trattative
WHERE COALESCE(archiviata,false) = false
GROUP BY stato ORDER BY num DESC;

-- Le mie trattative aperte ordinate per scadenza (con nome contatto):
SELECT t.id,
       COALESCE(c.ragione_sociale, c.cognome||' '||c.nome,
                p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       t.prodotto, t.stato, t.priorita, t.data_scadenza, t.premio_previsto
FROM trattative t
LEFT JOIN clienti c ON c.id = t.cliente_id
LEFT JOIN prospect p ON p.id = t.prospect_id
WHERE t.assegnato_a = auth.uid()
  AND t.stato NOT IN ('chiuso_vinto','chiuso_perso')
  AND COALESCE(t.archiviata,false) = false
ORDER BY t.data_scadenza ASC NULLS LAST LIMIT 50;

-- Trattative chiuse vinte ultimo trimestre con premio mensile:
SELECT date_trunc('month', data_chiusura) AS mese,
       COUNT(*) AS vinte,
       SUM(premio_effettivo) AS premio
FROM trattative
WHERE stato = 'chiuso_vinto'
  AND data_chiusura >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY 1 ORDER BY 1;

-- Conversion rate (win rate) trattative per ufficio (ultimo anno):
SELECT u.nome_ufficio,
       COUNT(*) FILTER (WHERE t.stato='chiuso_vinto') AS vinte,
       COUNT(*) FILTER (WHERE t.stato='chiuso_perso') AS perse,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.stato='chiuso_vinto')
            / NULLIF(COUNT(*) FILTER (WHERE t.stato IN ('chiuso_vinto','chiuso_perso')),0), 1) AS win_rate_pct
FROM trattative t
LEFT JOIN uffici u ON u.id = t.ufficio_id
WHERE t.data_chiusura >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY u.nome_ufficio
ORDER BY win_rate_pct DESC NULLS LAST;

-- Prospect aperti per fonte:
SELECT fonte, COUNT(*) AS num
FROM prospect
WHERE convertito_cliente_id IS NULL
GROUP BY fonte ORDER BY num DESC;

-- Miei prospect non convertiti più vecchi di 30 giorni (da risollecitare):
SELECT id,
       COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email) AS nominativo,
       fonte, stato, created_at
FROM prospect
WHERE assegnato_a = auth.uid()
  AND convertito_cliente_id IS NULL
  AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at ASC LIMIT 50;

-- Prospect convertiti in cliente quest'anno con prima polizza:
SELECT p.id AS prospect_id,
       COALESCE(p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       p.convertito_cliente_id,
       MIN(v.data_decorrenza) AS prima_polizza,
       COUNT(v.id) AS num_polizze
FROM prospect p
LEFT JOIN v_portafoglio_titoli v ON v.cliente_anagrafica_id = p.convertito_cliente_id
WHERE p.convertito_cliente_id IS NOT NULL
  AND EXTRACT(YEAR FROM p.updated_at) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY p.id, p.ragione_sociale, p.cognome, p.nome, p.convertito_cliente_id
ORDER BY prima_polizza DESC NULLS LAST LIMIT 30;

-- Prospect non convertiti per ufficio (es. "sede di Milano"):
SELECT u.nome_ufficio, COUNT(*) AS prospect_aperti
FROM prospect p
LEFT JOIN uffici u ON u.id = p.ufficio_id
WHERE p.convertito_cliente_id IS NULL
  AND u.nome_ufficio ILIKE '%milano%'
GROUP BY u.nome_ufficio;

### v_storico_gare (Storico Gare Pubbliche - Market Intelligence storica PA)

⚠️ REGOLA DI INSTRADAMENTO CRITICA:
- Se l'utente parla di "gare", "manifestazioni d'interesse", "mandati PA", "broker incumbent",
  "enti pubblici storici", "comuni/ASL/regioni gestite", "scadenze mandati" → usa SEMPRE 'v_storico_gare'.
- Se l'utente parla di "trattativa", "pipeline commerciale", "preventivo", "opportunity",
  "offerta in corso", "vinte/perse del mese" → usa 'trattative'.
- NON mescolare i due dataset: 'v_storico_gare' è intelligence storica di mercato (chi gestiva quel
  cliente PA, quando scade il mandato, condizioni di gara), NON pipeline commerciale attiva.

Campi: id, anno_riferimento (int), ente_nome, provincia (2 lettere), tipologia, esito,
broker_incumbent, categoria_ente, data_consegna, data_inizio_mandato, data_fine_mandato,
opzione_rinnovo (testo libero), opzione_rinnovo_anni (int derivato),
flag_cauzione, flag_referenze_bancarie, flag_accesso_atti, flag_offerta_tecnica (booleani sui
requisiti di gara), note, cliente_id (auto-link al CRM se ente già anagrafato), stato_mandato (calcolato).

Valori enum:
- tipologia: 'manifestazione' | 'gara' | 'affidamento_diretto' | 'altro'
- esito: 'vinta' | 'persa' | 'non_partecipato' | 'annullata' | 'in_corso' | 'non_classificato'
- categoria_ente: 'comune' | 'provincia' | 'regione' | 'azienda_sanitaria' | 'universita' | 'consorzio' | 'societa_partecipata' | 'altro_ente'
- stato_mandato: 'attivo' | 'in_scadenza_12m' | 'scaduto' | 'sconosciuto'
- broker_incumbent normalizzato (UPPERCASE): 'INTERMEDIA', 'B&S ITALIA', 'AON', 'MARSH', 'WILLIS', 'MAG JLT', 'ASSITECA', ...

Mappature naturali:
- "comuni del Veneto" → categoria_ente='comune' AND provincia IN ('VE','PD','TV','VR','VI','RO','BL')
- "ASL del Sud" → categoria_ente='azienda_sanitaria' AND provincia IN ('NA','SA','BA','LE','CT','PA',...)
- "università" → categoria_ente='universita'
- "mandati in scadenza" / "mandati che scadono" → stato_mandato='in_scadenza_12m'
- "competitor" / "non noi" → broker_incumbent <> 'INTERMEDIA' AND broker_incumbent IS NOT NULL
- "gare complesse" → flag_cauzione AND flag_referenze_bancarie AND flag_offerta_tecnica

Esempi:
-- Top 10 broker incumbent per numero di mandati attivi:
SELECT broker_incumbent, COUNT(*) AS mandati
FROM v_storico_gare
WHERE broker_incumbent IS NOT NULL AND stato_mandato='attivo'
GROUP BY broker_incumbent ORDER BY mandati DESC LIMIT 10;

-- Mandati in scadenza nei prossimi 12 mesi gestiti da competitor:
SELECT ente_nome, provincia, categoria_ente, broker_incumbent, data_fine_mandato
FROM v_storico_gare
WHERE stato_mandato='in_scadenza_12m'
  AND broker_incumbent <> 'INTERMEDIA'
  AND broker_incumbent IS NOT NULL
ORDER BY data_fine_mandato ASC LIMIT 100;

-- Win rate Intermedia per anno e categoria_ente:
SELECT anno_riferimento, categoria_ente,
  COUNT(*) FILTER (WHERE esito='vinta' AND broker_incumbent='INTERMEDIA')::float
    / NULLIF(COUNT(*) FILTER (WHERE esito IN ('vinta','persa')),0) AS win_rate_intermedia,
  COUNT(*) AS totale_gare
FROM v_storico_gare
GROUP BY 1,2 ORDER BY 1 DESC, 2;

-- Comuni di una provincia con mandato scaduto e nessun broker incumbent (potenziali target):
SELECT ente_nome, data_fine_mandato, anno_riferimento
FROM v_storico_gare
WHERE categoria_ente='comune' AND provincia='TV'
  AND (stato_mandato='scaduto' OR broker_incumbent IS NULL)
ORDER BY data_fine_mandato DESC NULLS LAST LIMIT 50;

-- Gare con tutti i flag di complessità attivi:
SELECT ente_nome, provincia, anno_riferimento, broker_incumbent, esito
FROM v_storico_gare
WHERE flag_cauzione AND flag_referenze_bancarie AND flag_offerta_tecnica
ORDER BY anno_riferimento DESC LIMIT 50;

-- Distribuzione gare per categoria_ente ultimi 5 anni:
SELECT categoria_ente, COUNT(*) AS totale
FROM v_storico_gare
WHERE anno_riferimento >= EXTRACT(YEAR FROM CURRENT_DATE)::int - 5
GROUP BY categoria_ente ORDER BY totale DESC;

-- Enti auto-linkati al CRM raggruppati per esito:
SELECT esito, COUNT(*) AS gare, COUNT(DISTINCT cliente_id) AS clienti_distinti
FROM v_storico_gare
WHERE cliente_id IS NOT NULL
GROUP BY esito ORDER BY gare DESC;

-- Win rate per anno e tipologia (generale):
SELECT anno_riferimento, tipologia,
  COUNT(*) FILTER (WHERE esito='vinta')::float / NULLIF(COUNT(*),0) AS win_rate
FROM v_storico_gare GROUP BY 1,2 ORDER BY 1 DESC;

## DOMINI AGGIUNTIVI

### Polizze – Lifecycle
- titoli_movimenti: storico operazioni polizza (rinnovi, sospensioni, riattivazioni, storni).
- titoli_storni: storni di polizza (tipo, data, motivazione, importo, titolo_id, utente).
- titoli_sostituzioni: sostituzioni/rinnovi (titolo_origine_id, titolo_nuovo_id, data).
- titoli_regolazioni: regolazioni premi variabili (titolo_id, periodo, premio_definitivo).
- titoli_numeri_storici: storico numerazione polizza (cambi numero/compagnia).
- appendici_polizza: varianti contrattuali (vedi sezione titoli).
- premi_garanzia_polizza: scomposizione premio per garanzia/sottoramo (titolo_id, ramo_id, premio_netto, premio_lordo, provvigione_pct).
- veicoli_polizza, conducenti_polizza: dati RCA (targa, marca, modello, conducenti aggiuntivi).
- rca_garanzie, rca_usi, aliquote_provinciali_rca: cataloghi RCA.

### Provvigioni e compensi (dettaglio)
- matrice_provvigioni: provvigioni per compagnia × ramo × tipologia.
- provvigioni_compagnia_ramo: tassi base compagnia/ramo.
- produttori_provvigioni_ramo: tassi per produttore/ramo.
- provvigioni_default_tipo: default per tipo destinatario.
- pagamenti_provvigioni_righe: dettaglio distinta pagamento per polizza/utente.
- certificazioni_cu: certificazioni Unica.

### Contabilità (dettaglio)
- distinte_giornaliere / distinte_giornaliere_righe: distinte di cassa giornaliere.
- portafoglio_incassi / portafoglio_incassi_eventi: tracciamento incassi clienti.
- rimessa_premi / rimessa_dettaglio: rimesse premi alle compagnie.
- note_restituzione / note_restituzione_dettaglio: storni e restituzioni.
- chiusure_contabili: chiusure periodiche per ufficio.
- iva_registri: registri IVA.
- piano_conti_conti / piano_conti_gruppi: piano dei conti.
- conti_bancari: conti bancari (anche tipo 'generico' = Consulbrokers).
- estratti_conto: e/c bancari importati.
- incroci_bancari: riconciliazione bancaria.
- causali_contabili: causali.
- scadenziario: scadenze contabili amministrative.

### Rapporti Compagnia
- compagnia_rapporti: rapporti N:N agenzia-compagnia (plurimandatari/broker).
- compagnia_rapporto_rami: rami abilitati per ciascun rapporto.
- compagnia_rapporto_documenti: documenti del rapporto.
- gruppi_compagnia: gruppi assicurativi (es. Generali, Allianz).
- tipi_mandatario: tipi di mandato (14 codici).

### Sinistri (dettaglio)
- sinistro_eventi: timeline eventi sinistro (denuncia, perizia, liquidazione).
- sinistro_checklist: checklist documentale per chiusura sinistro.

### Trattative (dettaglio)
- trattativa_eventi: log eventi trattativa.
- trattativa_scadenze: scadenze/follow-up trattativa.
- trattativa_documenti: documenti allegati alla trattativa.

### Bandi pubblici (live)
- bandi_pubblici: bandi scraping live (titolo, ente, scadenza_offerte, importo_base, stato, url, fonte).
- bandi_trattative: collegamento bando ↔ trattativa creata.
- ricerche_bandi: ricerche salvate.

### Comunicazioni
- chat_canali, chat_canali_membri, chat_messaggi: chat interna multi-canale.
- chat_messaggi_interni: messaggi diretti 1:1.
- chat_conferme_lettura: read receipts.
- notifiche: campi destinatario_id (FK profiles, NON "user_id"), tipo, titolo, messaggio,
  entita_tipo, entita_id, priorita, letto.
- template_email, template_categorie: template email (placeholder {{sede_...}}, {{cliente_...}}).
- email_branding: branding email per ufficio.
- spedizioni_cartacee: invii cartacei tracciati.

### Documenti
- document_library: libreria documentale (titolo, descrizione, folder_id, file_path).
- document_folders: cartelle gerarchiche.
- documenti / documenti_utenti: documenti generici e per utente.
- banca_documenti: documenti bancari.
- lookup_tipo_documento: tipologie documento.

### Anagrafiche e lookup
- gruppi_finanziari: tipo_soggetto privato/azienda/ente (governa campi cliente).
- gruppi_statistici, gruppi_ramo (RCA/INFORTUNI/...).
- lookup_settori, lookup_attivita, lookup_indotti, lookup_zone, lookup_risk_type,
  lookup_fasce_dipendenti, lookup_fasce_fatturato, lookup_contratti, lookup_conti_incasso.
- veicoli_marche, veicoli_modelli: catalogo veicoli.
- prodotti, categorie_prodotto: catalogo prodotti (legacy — preferire titoli.prodotto_nome).
- filiali: filiali compagnie.
- nominativi_cliente: referenti multipli cliente.
- clienti_relazioni: relazioni cliente↔cliente.

### Audit, sistema, privacy
- log_attivita: audit log (user_id, azione, entita_tipo, entita_id, dettagli_json, severity).
- log_attivita_archivio: archivio storico log.
- audit_config: configurazione audit per entità.
- anomalie_sistema: anomalie rilevate.
- impostazioni_sistema / impostazioni_ufficio: configurazioni globali / per sede.
- richieste_modifica_cliente: workflow approvazione modifiche cliente.
- privacy_consensi / privacy_informative: consensi GDPR (immutabili).
- performance_log: metriche performance.
- user_roles: assegnazione ruoli (NON usare profiles.ruolo per check sicurezza — usare has_role()).
- ruoli_template: template di ruolo.

## RICERCA TESTUALE (FTS)
Le tabelle clienti, prospect, titoli, sinistri hanno una colonna search_vector (tsvector con indice GIN).
Per ricerche libere su nome/numero usa:
  WHERE search_vector @@ plainto_tsquery('italian', 'mario rossi')
È molto più veloce di ILIKE su grandi dataset. Combina sempre con LIMIT.

## DEEP LINK ALLE ENTITÀ (linka nei testi)
Quando citi una specifica entità nella risposta, usa link markdown ai path UI:
- Cliente:    [Nome](/archivi/clienti/<id>)
- Prospect:   [Nome](/archivi/prospect/<id>)
- Polizza:    [Numero](/titoli/<id>)
- Sinistro:   [Numero](/sinistri/<id>)
- Trattative (lista):       [Apri trattative](/trattative)
- Compagnie (solo admin):   [Apri compagnie](/compagnie)
- Bandi pubblici:           [Apri bandi](/bandi-pubblici)
Esempio: "La polizza più costosa è [N. 12345](/titoli/abc-123) di [Rossi SpA](/archivi/clienti/def-456)."

## TOOL DI RENDERING (output ricco)
Oltre a query_database / describe_table / list_enum_values hai 3 tool di rendering.
USALI quando la risposta beneficia di visualizzazione strutturata
(e in tal caso NON ripetere gli stessi dati nel testo: scrivi solo un breve commento).

- render_metrics({ title?, metrics:[{label, value, hint?, tone?}] })
  Card KPI sintetici. Usa per totali/percentuali.
  tone: 'default' | 'success' | 'warning' | 'danger'.

- render_chart({ kind:'bar'|'line'|'pie', title?, x_label?, y_label?, data:[{label, value}] })
  Grafico Recharts. Usa per pipeline per stato, andamento temporale, top-N classifiche.

- render_table({ title?, columns:[{key,label}], rows:[{...}], link_template?: '/titoli/{id}' })
  Tabella interattiva. Con link_template (segnaposto {colonna}) le righe diventano cliccabili.

LINEE GUIDA RENDERING:
- ≥3 righe con id entità → preferisci render_table con link_template.
- 1-4 KPI numerici sintetici → render_metrics.
- Aggregazioni per categoria o per tempo → render_chart.
- Massimo 1 grafico + 1 tabella + 1 metriche per risposta.
`;

