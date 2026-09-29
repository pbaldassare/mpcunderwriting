
DO $$
DECLARE
  v_ufficio uuid := 'd2d73996-a161-4a04-be84-260f6c514c23';
  v_gf_azienda uuid := '9f712168-3abc-4b09-b7f2-81e819848bd0';
  v_gf_privato uuid := 'a3d9b7c4-dacc-43bc-ba25-7829475a0697';
  v_gf_ente uuid := '0e090595-0f3e-475c-b70b-583ec70fb0b0';
  v_rs_pavoni uuid := '74b767c6-5259-4ab6-9c4e-d4df64dec3d3';
  v_rs_albanese uuid := '835b8720-e4ec-465b-9404-109536424fdb';
  v_rs_canovapir uuid := 'd8868a1c-1308-4159-80e6-4636228f830c';
  v_rs_sedebg uuid := '05cb3173-9c79-4dad-857e-cbd021f40282';
  v_rs_diaferia uuid := 'd2ae0d46-000d-4106-8897-8cad7b359985';
  v_co_pavoni uuid := '2bfd0bea-d8a8-4f86-8657-ce012e083c1e';
  v_co_canovapir uuid := '4968e2bb-58cf-4ed6-944d-c1e52d243079';
  v_co_diaferia uuid := '16b21d06-65be-44b7-991e-9df96e16efd0';
  v_co_interfidi uuid := 'cbe0e599-5f2e-4be9-b9d4-8b48347368d3';
  v_co_albanese uuid := '5d3e513e-f478-4cc7-9b4c-4df8f27774da';
  v_note_da_completare text := 'DA COMPLETARE - CF/P.IVA non disponibile in import del 03/06/2026';
  r RECORD;
  v_cid uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('014262','azienda','BARCORE S.R.L.',NULL,NULL,'VIA CASTEGNATO , 6/D','25050','RODENGO SAIANO','BS','npirovano@consulbrokers.it',NULL,NULL,v_rs_canovapir,v_rs_canovapir,v_co_canovapir,NULL::uuid,v_note_da_completare),
      ('015937','ente','COMUNE CAMERATA CORNELLO',NULL,NULL,'VIA PAPA GIOVANNI XXIII, 7','24010','CAMERATA CORNELLO','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010594','privato','POLETTO DAVIDE','PLTDVD82P08A794S',NULL,'VIA CARLO MENDES, 6','24040','CISERANO','BG',NULL,NULL,NULL,v_rs_albanese,v_rs_albanese,v_co_pavoni,NULL,NULL),
      ('010704','privato','TESTA MAURIZIO','TSTMRZ54T11A794C',NULL,'VIA AL BOEL 35','24010','PONTERANICA','BG',NULL,NULL,'PERSONE FISICHE',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,NULL),
      ('010705','privato','TESTA PAOLA','TSTPLA75D63A794M',NULL,'VIA CIRCONVALLAZIONE OCCIDENTALE 96','47923','RIMINI','RN',NULL,NULL,NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,'Comune non specificato in import, dedotto da CAP 47923 (Rimini)'),
      ('017558','ente','COMUNE SAN GIOVANNI BIANCO','00324100163','00324100163','PIAZZA IV NOVEMBRE 7','24015','SAN GIOVANNI BIANCO','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,NULL),
      ('013613','azienda','LOGECO SRL',NULL,NULL,'VIA GIUSEPPE VERDI, 2','24121','BERGAMO','BG',NULL,NULL,NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010642','privato','ROVESTA DESIREE','RVSDSR85P64G856E',NULL,'VIA MENDES 6','24040','CISERANO','BG',NULL,NULL,NULL,v_rs_albanese,v_rs_albanese,v_co_pavoni,NULL,NULL),
      ('010246','ente','COMUNE TORRE DE'' ROVERI',NULL,NULL,'PIAZZA CONTE SFORZA 3','24060','TORRE DE'' ROVERI','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010595','privato','POLETTO UMBERTO FRANCESCO','PLTMRT55H10F205X',NULL,'VIA DELLE AZALEE N.3','24040','VERDELLINO','BG','pierina.longaretti@pmgcompounds.com',NULL,NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,NULL),
      ('013267','azienda','WEAKRISK SRL',NULL,NULL,'VIA GIUSEPPE VERDI, 2','24121','BERGAMO','BG',NULL,NULL,NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('014063','azienda','IL COLMETTO SRL SOCIETA'' AGRICOLA',NULL,NULL,'VIA FINILNUOVO, 9/11','25050','RODENGO SAIANO','BS',NULL,NULL,NULL,v_rs_canovapir,v_rs_canovapir,v_co_canovapir,NULL,v_note_da_completare),
      ('017648','azienda','BG.BS CONSULTING SRL','04733900163','04733900163','VIA GUGLIELMO D''ALZANO 6/B','24122','BERGAMO','BG','dr.freduzzi@st-tributario.it',NULL,NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,NULL),
      ('017672','privato','OSIO MATTEO','SOIMTT89S07A794A',NULL,'VIA PUCCINI, 6/15','20060','BASIANO','MI',NULL,NULL,NULL,v_rs_sedebg,v_rs_sedebg,NULL,NULL,'Residente fuori provincia BG (Basiano MI), assegnato a Sede Bergamo come da import'),
      ('010620','azienda','ROBUR SPA',NULL,NULL,'VIA PARIGI, 6','24049','VERDELLO','BG',NULL,'035/888262',NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,v_co_interfidi,v_note_da_completare),
      ('017095','azienda','0.3 SRL DI RUSSO ANTONIO','05185400875','05185400875','C.SO SICILIA, 40','95131','CATANIA','CT',NULL,NULL,NULL,v_rs_canovapir,v_rs_canovapir,v_co_canovapir,NULL,NULL),
      ('010108','azienda','BIOFACTORY SPA',NULL,NULL,'VIA NINOLA, 34','24050','CALCINATE','BG',NULL,'035/4423170',NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('013973','ente','COMUNE BARZANA',NULL,NULL,'VIA GUGLIELMO MARCONI, 9','24030','BARZANA','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('013982','ente','COMUNE BRACCA',NULL,NULL,'VIA CAV. A. DENTELLA, 10','24010','BRACCA','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_diaferia,v_rs_diaferia,v_co_diaferia,NULL,v_note_da_completare),
      ('017631','ente','COMUNE DI GAZZANIGA','00250930161','00250930161','VIA MARCONI, 18','24025','GAZZANIGA','BG','dagostini.elisabetta@comune.gazzaniga.bg.it',NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,NULL),
      ('013992','ente','COMUNE LOCATELLO',NULL,NULL,'PIAZZA LIBERTA'', 4','24030','LOCATELLO','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010243','ente','COMUNE PONTE NOSSA',NULL,NULL,'VIA G. FRUA 35','24028','PONTE NOSSA','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010244','ente','COMUNE PREMOLO',NULL,NULL,'VIA RANICA, 105','24069','PREMOLO','BG',NULL,NULL,'Gruppo ENTI PUBBLICI DIVERSI',v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010330','azienda','FERTIL SRL',NULL,NULL,'VIA NINOLA, 34','24050','CALCINATE','BG',NULL,'035/4423170',NULL,v_rs_pavoni,v_rs_pavoni,v_co_pavoni,NULL,v_note_da_completare),
      ('010412','privato','GUERRA ELENA','GRRLNE69D53A794X',NULL,'VIA LONGUELO, 256','24129','BERGAMO','BG',NULL,NULL,NULL,v_rs_sedebg,v_rs_sedebg,v_co_pavoni,NULL,NULL),
      ('014162','azienda','RUSPAL SAS DI RUSSO&GAETANO',NULL,NULL,'VIA DI MEZZO, 64','41037','MIRANDOLA','MO',NULL,NULL,'Gruppo AZIENDE PRIVATE',v_rs_canovapir,v_rs_canovapir,v_co_canovapir,NULL,v_note_da_completare)
    ) AS t(codice, tipo, denom, cf, piva, indir, cap, citta, prov, email, tel, indotto, ae_id, sp_id, prod_id, prod2_id, note_extra)
  LOOP
    IF r.tipo = 'privato' THEN
      INSERT INTO public.clienti (
        tipo_cliente, codice_ricerca, nome, cognome, codice_fiscale,
        indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
        email, telefono, ufficio_id, gruppo_finanziario_id, indotto, note, attivo, stato_cliente
      ) VALUES (
        'privato', r.codice,
        split_part(r.denom, ' ', 2) || CASE WHEN array_length(string_to_array(r.denom,' '),1) > 2 THEN ' ' || array_to_string((string_to_array(r.denom,' '))[3:],' ') ELSE '' END,
        split_part(r.denom, ' ', 1),
        upper(r.cf),
        r.indir, r.cap, r.citta, r.prov,
        r.email, r.tel, v_ufficio, v_gf_privato, r.indotto, r.note_extra, true, 'attivo'
      ) RETURNING id INTO v_cid;
    ELSIF r.tipo = 'azienda' THEN
      INSERT INTO public.clienti (
        tipo_cliente, codice_ricerca, ragione_sociale, codice_fiscale_azienda, partita_iva,
        indirizzo_sede, cap_sede, citta_sede, provincia_sede,
        email, telefono, ufficio_id, gruppo_finanziario_id, indotto, note, attivo, stato_cliente
      ) VALUES (
        'azienda', r.codice, r.denom, upper(r.cf), r.piva,
        r.indir, r.cap, r.citta, r.prov, r.email, r.tel,
        v_ufficio, v_gf_azienda, r.indotto, r.note_extra, true, 'attivo'
      ) RETURNING id INTO v_cid;
    ELSE
      INSERT INTO public.clienti (
        tipo_cliente, codice_ricerca, ragione_sociale, codice_fiscale_azienda, partita_iva,
        indirizzo_sede, cap_sede, citta_sede, provincia_sede,
        email, telefono, ufficio_id, gruppo_finanziario_id, indotto, note, attivo, stato_cliente
      ) VALUES (
        'ente', r.codice, r.denom, upper(r.cf), r.piva,
        r.indir, r.cap, r.citta, r.prov, r.email, r.tel,
        v_ufficio, v_gf_ente, r.indotto, r.note_extra, true, 'attivo'
      ) RETURNING id INTO v_cid;
    END IF;

    IF r.ae_id IS NOT NULL THEN
      INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, percentuale)
      VALUES (v_cid, 'AE', r.ae_id, 100);
    END IF;
    IF r.sp_id IS NOT NULL THEN
      INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, percentuale)
      VALUES (v_cid, 'Backoffice', r.sp_id, 100);
    END IF;
    IF r.prod_id IS NOT NULL THEN
      INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, percentuale)
      VALUES (v_cid, 'Produttore Sede', r.prod_id, CASE WHEN r.prod2_id IS NULL THEN 100 ELSE 50 END);
    END IF;
    IF r.prod2_id IS NOT NULL THEN
      INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, percentuale)
      VALUES (v_cid, 'corrispondente_1', r.prod2_id, 50);
    END IF;
  END LOOP;
END $$;
