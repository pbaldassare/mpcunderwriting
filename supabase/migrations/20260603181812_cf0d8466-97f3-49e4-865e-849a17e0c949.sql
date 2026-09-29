
DO $$
DECLARE
  v_uff uuid := 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a';
  v_gf_az uuid := '3b49294f-373e-456e-9bec-0bb7942aa7bb';
  v_gf_lp uuid := '05478f51-65b4-41d2-b743-d7a5faa181e0';
  v_gf_san uuid := '6a148d8a-c245-4cd3-b81d-38c640941991';
  v_gf_ent uuid := '62ae8e50-e440-4810-b4df-6cb64a8f2155';
  v_p_guarracino uuid := '3dd8c801-e1a2-49eb-8ca2-9fcae095f7ef';
  v_p_scarpelli uuid := '1e16e933-ef2f-4732-a9e6-2aab1a4c89d5';
  v_p_gestmilano uuid := 'd7c19fc3-e1c1-4825-a3f2-d0a54bac7ae3';
  v_a_interfidi uuid := 'cbe0e599-5f2e-4be9-b9d4-8b48347368d3';
  v_a_ema uuid := 'fc541b42-f9c1-4b62-969c-3d44d0f91aec';
  v_a_comodo uuid := 'c691fc2e-aa7d-4732-80c9-da91a50f4a9b';
  v_a_cbdig uuid := '0be427e0-3fd4-44b5-a141-5d79596ae731';
  v_a_federfarma uuid := '05fed5f0-9a3b-422a-b1e3-55badc5a9899';
  v_cid uuid;
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('017823','privato','Linea Persona', NULL::text, 'GNGFRC90H48D969O', NULL,
       'GIANGRIECO','FEDERICA','VIA NICOLA ZINGARELLI,  2','95124','CATANIA','CT',
       'pfailla@cbdigital.tech','0818529283',
       'SEDE NAPOLI','Gestione Milano','Consulbrokers Digital Srl', 'gestmilano','cbdig'),
      ('014557','azienda','Aziende Sanitarie Pubbliche','AOU OSPEDALI RIUNITI DI FOGGIA','02218910715','02218910715',
       NULL,NULL,'VIALE PINTO LUIGI','71122','FOGGIA','FG',
       'pfailla@cbdigital.tech','0818529283',
       'AZIENDE SANITARIE','GUARRACINO GAETANO','COMODO EGIDIO','guarracino','comodo'),
      ('006883','azienda','Aziende Sanitarie Pubbliche','ASL BAT','06391740724','06391740724',
       NULL,NULL,'VIA FORNACI, 201','76123','ANDRIA','BT',
       'pfailla@cbdigital.tech','0818529283',
       'AZIENDE SANITARIE','GUARRACINO GAETANO','COMODO EGIDIO','guarracino','comodo'),
      ('014559','azienda','Aziende Sanitarie Pubbliche','ASL TARANTO','02026690731','02026690731',
       NULL,NULL,'VIALE VIRGILIO, 31','74100','TARANTO','TA',
       'pfailla@cbdigital.tech','0818529283',
       'AZIENDE SANITARIE','GUARRACINO GAETANO','COMODO EGIDIO','guarracino','comodo'),
      ('006975','azienda','Enti Pubblici Territoriali','COMUNE DI SANTA MARINA SALINA',NULL,NULL,
       NULL,NULL,'VIA RISORGIMENTO','98050','SANTA MARINA SALINA','ME',
       'sindaco@comune.santa-marina-salina.me.it','0818529283',
       'SEDE CATANIA','GUARRACINO GAETANO','INTERFIDI SRL','guarracino','interfidi'),
      ('017725','azienda','Enti Pubblici Territoriali','ASSOCIAZIONE TITOLARI DI FARMACIA DELLA PROVINCIA DI TORINO','97530810015','97530810015',
       NULL,NULL,'VIA SANT''ANSELMO, 14','10125','TORINO','TO',
       'pfailla@cbdigital.tech','0818529283',
       'FEDEFARMA INSURANCE BROKER','SCARPELLI PAOLA','FEDERFARMA INSURANCE BROKER SRL','scarpelli','federfarma'),
      ('006453','azienda','Aziende Private','SITA SUD SRL','04336340726','04336340726',
       NULL,NULL,'VIA BRUNO BUOZZI, 36','70132','BARI','BA',
       'g.barnaba@sitasudtrasporti.it','0818529283',
       'SEDE BASILICATA','SCARPELLI PAOLA','COMODO EGIDIO','scarpelli','comodo'),
      ('008510','azienda','Aziende Private','TROTTA BUS SERVICES S.P.A.','00405460585','00405460585',
       NULL,NULL,'VIA CASTEL DI LEVA, 116','00134','ROMA','RM',
       'sinistri@trotta.it','0818529283',
       'SEDE BASILICATA','SCARPELLI PAOLA','COMODO EGIDIO','scarpelli','comodo')
    ) AS t(codice, tipo, gru_fin, ragsoc, piva, cf_az, cognome, nome, indir, cap, comune, prov, email, tel, ae_label, spec_label, prod_label, spec_key, prod_key)
  LOOP
    -- skip se già esiste con stesso codice_ricerca o stessa P.IVA
    IF EXISTS (SELECT 1 FROM clienti WHERE codice_ricerca = r.codice)
       OR (r.piva IS NOT NULL AND EXISTS (SELECT 1 FROM clienti WHERE partita_iva = r.piva)) THEN
      RAISE NOTICE 'Skip cliente esistente: %', r.codice;
      CONTINUE;
    END IF;

    INSERT INTO clienti (
      codice_ricerca, tipo_cliente, ufficio_id, attivo, stato_cliente,
      gruppo_finanziario_id, telefono, email,
      ragione_sociale, cognome, nome,
      codice_fiscale, codice_fiscale_azienda, partita_iva,
      indirizzo_sede, cap_sede, citta_sede, provincia_sede,
      indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
      note
    ) VALUES (
      r.codice, r.tipo, v_uff, true, 'Attivo',
      CASE r.gru_fin
        WHEN 'Aziende Private' THEN v_gf_az
        WHEN 'Linea Persona' THEN v_gf_lp
        WHEN 'Aziende Sanitarie Pubbliche' THEN v_gf_san
        WHEN 'Enti Pubblici Territoriali' THEN v_gf_ent
      END,
      r.tel, r.email,
      CASE WHEN r.tipo='azienda' THEN r.ragsoc END,
      CASE WHEN r.tipo='privato' THEN r.cognome END,
      CASE WHEN r.tipo='privato' THEN r.nome END,
      CASE WHEN r.tipo='privato' THEN r.cf_az END,
      CASE WHEN r.tipo='azienda' THEN r.cf_az END,
      r.piva,
      CASE WHEN r.tipo='azienda' THEN r.indir END,
      CASE WHEN r.tipo='azienda' THEN r.cap END,
      CASE WHEN r.tipo='azienda' THEN r.comune END,
      CASE WHEN r.tipo='azienda' THEN r.prov END,
      CASE WHEN r.tipo='privato' THEN r.indir END,
      CASE WHEN r.tipo='privato' THEN r.cap END,
      CASE WHEN r.tipo='privato' THEN r.comune END,
      CASE WHEN r.tipo='privato' THEN r.prov END,
      CASE WHEN r.piva IS NULL AND r.cf_az IS NULL THEN 'DA COMPLETARE - CF/P.IVA non disponibile in import Napoli 06/2026' END
    ) RETURNING id INTO v_cid;

    -- Backoffice / Specialist
    INSERT INTO codici_commerciali_cliente (cliente_id, ruolo, profilo_id, societa_brand, contatto)
    VALUES (v_cid, 'Backoffice',
      CASE r.spec_key WHEN 'guarracino' THEN v_p_guarracino
                      WHEN 'scarpelli'  THEN v_p_scarpelli
                      WHEN 'gestmilano' THEN v_p_gestmilano END,
      'Consulbrokers', r.spec_label);

    -- Produttore Sede
    INSERT INTO codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, societa_brand, contatto, percentuale)
    VALUES (v_cid, 'Produttore Sede',
      CASE r.prod_key WHEN 'interfidi'  THEN v_a_interfidi
                      WHEN 'ema'        THEN v_a_ema
                      WHEN 'comodo'     THEN v_a_comodo
                      WHEN 'cbdig'      THEN v_a_cbdig
                      WHEN 'federfarma' THEN v_a_federfarma END,
      'Consulbrokers', r.prod_label, 100);

    -- AE (etichetta testuale: SEDE NAPOLI / AZIENDE SANITARIE / ...)
    INSERT INTO codici_commerciali_cliente (cliente_id, ruolo, societa_brand, contatto)
    VALUES (v_cid, 'AE', 'Consulbrokers', r.ae_label);

    RAISE NOTICE 'Inserito %: %', r.codice, COALESCE(r.ragsoc, r.cognome||' '||r.nome);
  END LOOP;
END $$;
