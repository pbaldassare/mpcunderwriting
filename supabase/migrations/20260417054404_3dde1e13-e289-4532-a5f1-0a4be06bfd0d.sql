DO $$
DECLARE
  demo_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO demo_ids FROM public.uffici WHERE codice_ufficio LIKE 'DEMO-%';
  IF demo_ids IS NULL THEN RETURN; END IF;
  
  DELETE FROM public.matrice_provvigioni WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.notifiche WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.log_attivita WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.impostazioni_ufficio WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.chat_canali WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.anomalie_sistema WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.iva_registri WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.scadenziario WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.primanota_generale WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.spedizioni_cartacee WHERE ufficio_id = ANY(demo_ids) 
    OR nota_id IN (SELECT id FROM public.note_restituzione WHERE ufficio_id = ANY(demo_ids));
  DELETE FROM public.note_restituzione WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.portafoglio_incassi WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.flussi_compagnia WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.pagamenti_provvigioni WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.elaborazioni_periodiche WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.certificazioni_cu WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.elab_annuali WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.distinte_giornaliere WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.chiusure_contabili WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.movimenti_polizza WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.movimenti_contabili WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.estratti_conto WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.banca_documenti WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.rimessa_premi WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.fornitori WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.anagrafiche_professionali WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.trattative WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.sinistri WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.titoli WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.prospect WHERE ufficio_id = ANY(demo_ids);
  DELETE FROM public.clienti WHERE ufficio_id = ANY(demo_ids);
  UPDATE public.profiles SET ufficio_id = NULL WHERE ufficio_id = ANY(demo_ids);
  
  DELETE FROM public.uffici WHERE id = ANY(demo_ids);
END $$;