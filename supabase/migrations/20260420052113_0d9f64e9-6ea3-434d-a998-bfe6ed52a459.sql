-- Seed estensione libreria template email: 6 nuove categorie + 16 template formali assicurativi
-- Idempotente: usa WHERE NOT EXISTS sui nomi univoci

-- ============ CATEGORIE ============
INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Benvenuto', 'Onboarding cliente e attivazione area riservata'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Benvenuto');

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Sinistro', 'Comunicazioni relative al ciclo di vita del sinistro'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Sinistro');

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Quietanza & Incasso', 'Conferme di pagamento e quietanze formali'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Quietanza & Incasso');

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Documentazione', 'Invio polizze, appendici, certificati e CGA'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Documentazione');

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Trattativa & Preventivo', 'Invio preventivi e follow-up commerciali'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Trattativa & Preventivo');

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Cortesia', 'Auguri, ringraziamenti e comunicazioni di cortesia'
WHERE NOT EXISTS (SELECT 1 FROM public.template_categorie WHERE nome = 'Cortesia');

-- ============ TEMPLATE: BENVENUTO ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Benvenuto nuovo cliente',
'Benvenuto in {{sede_nome}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le diamo il più cordiale benvenuto tra i clienti di {{sede_nome}}. Siamo lieti di poterLa annoverare tra coloro che si affidano alla nostra esperienza e professionalità in materia assicurativa.

Il nostro team è a Sua completa disposizione per qualsiasi esigenza di consulenza, gestione contrattuale, denuncia sinistri o richiesta di chiarimento.

Per ogni necessità potrà contattarci ai seguenti recapiti:
- Telefono: {{sede_telefono}}
- E-mail: {{sede_email}}
- Sede: {{sede_indirizzo}}

Le porgiamo i nostri più distinti saluti.

{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Benvenuto'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Benvenuto nuovo cliente');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Attivazione area riservata',
'Attivazione della Sua Area Riservata Cliente',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le confermiamo l''avvenuta attivazione della Sua Area Riservata personale, attraverso la quale potrà consultare in qualsiasi momento le Sue polizze, le scadenze, i documenti contrattuali e lo stato dei sinistri eventualmente in essere.

Le credenziali di primo accesso Le verranno trasmesse separatamente per ragioni di sicurezza. Al primo accesso Le sarà richiesto di personalizzare la password.

Restiamo a disposizione per ogni assistenza.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Benvenuto'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Attivazione area riservata');

-- ============ TEMPLATE: SINISTRO ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Apertura sinistro – presa in carico',
'Comunicazione di apertura sinistro – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le confermiamo l''avvenuta apertura della pratica relativa al sinistro denunciato in data {{data_oggi}}, riferito alla polizza n. {{polizza_numero}} presso la Compagnia {{compagnia_nome}}.

La pratica è stata regolarmente trasmessa agli uffici competenti della Compagnia. Le verrà comunicato a breve il nominativo del perito incaricato e le tempistiche previste per la valutazione del danno.

La invitiamo a conservare con cura tutta la documentazione relativa all''evento e a comunicarci tempestivamente ogni elemento utile sopravvenuto.

Restiamo a Sua disposizione per ogni chiarimento.

Cordiali saluti,
{{sede_nome}}
{{sede_indirizzo}} – Tel. {{sede_telefono}}'
FROM public.template_categorie c WHERE c.nome = 'Sinistro'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Apertura sinistro – presa in carico');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Richiesta documentazione integrativa',
'Richiesta documentazione integrativa – sinistro polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

facciamo seguito alla pratica di sinistro relativa alla polizza n. {{polizza_numero}} stipulata con la Compagnia {{compagnia_nome}}, per richiederLe la trasmissione della seguente documentazione integrativa, necessaria al perfezionamento dell''istruttoria:

- [Elencare qui i documenti mancanti]

La preghiamo cortesemente di volerci far pervenire quanto sopra entro e non oltre 15 giorni dalla data odierna, al fine di non incorrere in ritardi nella definizione della pratica.

I documenti potranno essere trasmessi all''indirizzo {{sede_email}} ovvero consegnati direttamente presso la nostra sede.

Restando a disposizione per ogni chiarimento, Le porgiamo cordiali saluti.

{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Sinistro'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Richiesta documentazione integrativa');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Liquidazione sinistro',
'Comunicazione di liquidazione sinistro – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

siamo lieti di comunicarLe che la Compagnia {{compagnia_nome}} ha definito favorevolmente la pratica di sinistro relativa alla polizza n. {{polizza_numero}}, disponendo la liquidazione dell''importo concordato.

L''accredito verrà effettuato sulle coordinate bancarie da Lei comunicate nei termini previsti dalle condizioni contrattuali.

Restiamo a disposizione per ogni eventuale chiarimento o ulteriore necessità.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Sinistro'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Liquidazione sinistro');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Chiusura sinistro',
'Chiusura della pratica di sinistro – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le comunichiamo formalmente la chiusura della pratica di sinistro relativa alla polizza n. {{polizza_numero}} con la Compagnia {{compagnia_nome}}, avvenuta in data {{data_oggi}}.

Tutti gli adempimenti istruttori e liquidativi risultano regolarmente conclusi. La documentazione completa della pratica resta archiviata presso i nostri uffici e disponibile per ogni Sua eventuale consultazione.

Cogliamo l''occasione per ringraziarLa della fiducia accordataci nella gestione della pratica e restiamo a Sua disposizione per ogni futura esigenza.

Cordiali saluti,
{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Sinistro'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Chiusura sinistro');

-- ============ TEMPLATE: QUIETANZA & INCASSO ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Conferma incasso premio',
'Conferma incasso premio – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le confermiamo l''avvenuto incasso del premio di € {{polizza_premio}}, relativo alla polizza n. {{polizza_numero}} presso la Compagnia {{compagnia_nome}}, in data {{data_oggi}}.

La copertura assicurativa risulta pertanto pienamente operante alle condizioni contrattuali pattuite.

La quietanza ufficiale viene allegata alla presente comunicazione per Sua conservazione.

Restiamo a disposizione per ogni esigenza.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Quietanza & Incasso'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Conferma incasso premio');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Quietanza di pagamento',
'Quietanza di pagamento – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

in allegato alla presente Le trasmettiamo la quietanza ufficiale a fronte del pagamento di € {{polizza_premio}}, regolarmente ricevuto in data {{data_oggi}} a saldo della polizza n. {{polizza_numero}} stipulata con la Compagnia {{compagnia_nome}}.

Il documento ha valore liberatorio ai sensi di legge e La invitiamo a conservarlo unitamente alla documentazione contrattuale.

Cordiali saluti,
{{sede_nome}}
{{sede_indirizzo}}'
FROM public.template_categorie c WHERE c.nome = 'Quietanza & Incasso'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Quietanza di pagamento');

-- ============ TEMPLATE: DOCUMENTAZIONE ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Invio polizza emessa',
'Trasmissione contratto di polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

in allegato alla presente Le trasmettiamo il contratto di polizza n. {{polizza_numero}}, regolarmente emesso dalla Compagnia {{compagnia_nome}}, unitamente alle Condizioni Generali di Assicurazione (CGA) e ai documenti precontrattuali previsti dalla normativa IVASS vigente.

La invitiamo a prendere attenta visione di tutta la documentazione e a contattarci tempestivamente qualora rilevasse difformità rispetto a quanto concordato in sede di sottoscrizione.

Restiamo a disposizione per ogni chiarimento.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Documentazione'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Invio polizza emessa');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Invio appendice contrattuale',
'Trasmissione appendice – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

in allegato alla presente Le trasmettiamo l''appendice contrattuale relativa alla polizza n. {{polizza_numero}} stipulata con la Compagnia {{compagnia_nome}}, contenente le variazioni richieste e regolarmente perfezionate.

Le modifiche risultano efficaci a tutti gli effetti dalla data di decorrenza indicata nel documento allegato.

La invitiamo a conservare l''appendice unitamente al contratto originario.

Cordiali saluti,
{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Documentazione'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Invio appendice contrattuale');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Invio certificato assicurativo',
'Trasmissione certificato assicurativo – polizza n. {{polizza_numero}}',
'Gentile {{cliente_nome}} {{cliente_cognome}},

in allegato alla presente Le trasmettiamo il certificato assicurativo relativo alla polizza n. {{polizza_numero}} emesso dalla Compagnia {{compagnia_nome}}, valido fino alla scadenza del {{polizza_scadenza}}.

Il documento attesta la regolare operatività della copertura ed è utilizzabile per ogni adempimento previsto dalla normativa vigente o richiesto da terzi.

Restiamo a disposizione per ogni esigenza.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}}'
FROM public.template_categorie c WHERE c.nome = 'Documentazione'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Invio certificato assicurativo');

-- ============ TEMPLATE: SCADENZE (categoria Rinnovo già esistente) ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Preavviso scadenza 60 giorni',
'Preavviso scadenza polizza n. {{polizza_numero}} – 60 giorni',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente desideriamo segnalarLe, con il consueto anticipo, che la Sua polizza n. {{polizza_numero}} stipulata con la Compagnia {{compagnia_nome}} giungerà a scadenza in data {{polizza_scadenza}}.

Considerata la rilevanza della copertura, La invitiamo a contattarci con cortese sollecitudine per concordare un appuntamento finalizzato alla revisione delle condizioni contrattuali e alla valutazione del rinnovo, ovvero di eventuali soluzioni alternative più rispondenti alle Sue attuali esigenze.

Restiamo a Sua disposizione ai recapiti in calce.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome IN ('Rinnovo','Scadenze') OR c.nome = 'Rinnovo'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Fallback se categoria Rinnovo non esiste, crea sotto Documentazione
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Preavviso disdetta tacito rinnovo',
'Preavviso disdetta polizza n. {{polizza_numero}} a tacito rinnovo',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente Le ricordiamo che la polizza n. {{polizza_numero}}, sottoscritta con la Compagnia {{compagnia_nome}}, prevede la clausola di tacito rinnovo alla scadenza del {{polizza_scadenza}}.

Qualora intendesse esercitare la facoltà di disdetta, La preghiamo di trasmetterci formale comunicazione scritta nei termini contrattualmente previsti, al fine di consentirne la regolare inoltrazione alla Compagnia.

In assenza di disdetta nei termini, il contratto si intenderà tacitamente rinnovato alle medesime condizioni.

Restiamo a disposizione per ogni chiarimento.

Cordiali saluti,
{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Rinnovo'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Preavviso disdetta tacito rinnovo');

-- ============ TEMPLATE: TRATTATIVA & PREVENTIVO ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Invio preventivo',
'Trasmissione preventivo assicurativo personalizzato',
'Gentile {{cliente_nome}} {{cliente_cognome}},

facendo seguito al colloquio intercorso, in allegato alla presente Le trasmettiamo il preventivo assicurativo elaborato sulla base delle esigenze manifestate, redatto con la Compagnia {{compagnia_nome}}.

Il preventivo riporta in dettaglio le coperture proposte, i massimali, le franchigie e il premio annuo lordo. Le condizioni economiche indicate hanno validità di 30 giorni dalla data odierna.

Restiamo volentieri a Sua disposizione per ogni chiarimento e per concordare un eventuale appuntamento di approfondimento.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Trattativa & Preventivo'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Invio preventivo');

INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Sollecito decisione preventivo',
'Cortese sollecito – preventivo assicurativo trasmesso',
'Gentile {{cliente_nome}} {{cliente_cognome}},

facciamo seguito al preventivo assicurativo trasmesso in precedenza per verificare se la proposta sia stata di Suo gradimento e se vi siano elementi che desidera approfondire ovvero rivedere insieme.

Le ricordiamo che le condizioni economiche indicate restano valide ancora per pochi giorni; oltre tale termine sarà necessario procedere a una nuova quotazione presso la Compagnia.

Restiamo a Sua disposizione per ogni chiarimento, anche telefonicamente al numero {{sede_telefono}}.

Cordiali saluti,
{{sede_nome}}'
FROM public.template_categorie c WHERE c.nome = 'Trattativa & Preventivo'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Sollecito decisione preventivo');

-- ============ TEMPLATE: CORTESIA ============
INSERT INTO public.template_email (categoria_id, nome, oggetto, corpo)
SELECT c.id, 'Ringraziamento per rinnovo',
'Un sentito ringraziamento per il rinnovo accordatoci',
'Gentile {{cliente_nome}} {{cliente_cognome}},

con la presente desideriamo ringraziarLa sentitamente per aver rinnovato la fiducia nei nostri confronti procedendo al rinnovo della polizza n. {{polizza_numero}} con la Compagnia {{compagnia_nome}}.

La continuità del rapporto rappresenta per noi il riconoscimento più importante e ci impegna a mantenere alti gli standard di servizio, consulenza e assistenza che da sempre ci contraddistinguono.

Restiamo a Sua completa disposizione per ogni futura esigenza.

Cordiali saluti,
{{sede_nome}}
Tel. {{sede_telefono}} – {{sede_email}}'
FROM public.template_categorie c WHERE c.nome = 'Cortesia'
AND NOT EXISTS (SELECT 1 FROM public.template_email te WHERE te.categoria_id = c.id AND te.nome = 'Ringraziamento per rinnovo');