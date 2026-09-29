-- Trasferisce polizze/rimesse da "Agenzia Generale di CAMPOBASSO" (00022, fantasma)
-- a "DL ASSISERVICE SAS DI ARMANETTI AG.GENERALE" (CAT1101) e rimuove l'agenzia errata.

DO $$
DECLARE
  v_src_ag uuid := 'a64c5a99-6ad7-4c6d-8194-a58310ed394d';
  v_src_rapp uuid := '8748c8a9-ed24-4f7f-9eeb-25a100c81fdc';
  v_dst_ag uuid := 'df6dad25-2600-4474-8056-f60e8cb14fdd';
  v_dst_rapp uuid := '8c217431-ca77-4666-aaf7-344b99f1b352';
  v_src_conto uuid := 'aa9afa28-aab3-47fa-9134-85dd9014d50c';
  v_n_titoli int;
  v_n_rimesse int;
  v_n_riparti int;
BEGIN
  -- Snapshot di sicurezza (idempotente)
  CREATE TABLE IF NOT EXISTS public._snapshot_campobasso_titoli AS
  SELECT t.*, now() AS snapshot_at
  FROM public.titoli t
  WHERE false;

  IF NOT EXISTS (
    SELECT 1 FROM public._snapshot_campobasso_titoli
    WHERE compagnia_id = v_src_ag
    LIMIT 1
  ) THEN
    INSERT INTO public._snapshot_campobasso_titoli
    SELECT t.*, now()
    FROM public.titoli t
    WHERE t.compagnia_id = v_src_ag
       OR t.compagnia_rapporto_id = v_src_rapp;
  END IF;

  -- 1) Titoli → Armanetti
  UPDATE public.titoli
  SET
    compagnia_id = v_dst_ag,
    compagnia_rapporto_id = v_dst_rapp,
    codice_rapporto = 'CAT1101',
    updated_at = now()
  WHERE compagnia_id = v_src_ag
     OR compagnia_rapporto_id = v_src_rapp;
  GET DIAGNOSTICS v_n_titoli = ROW_COUNT;

  -- 2) Rimesse
  UPDATE public.rimessa_premi
  SET compagnia_id = v_dst_ag
  WHERE compagnia_id = v_src_ag;
  GET DIAGNOSTICS v_n_rimesse = ROW_COUNT;

  -- 3) Riparti provvigioni
  UPDATE public.dettaglio_riparto
  SET
    compagnia_id = v_dst_ag,
    compagnia_rapporto_id = v_dst_rapp
  WHERE compagnia_id = v_src_ag
     OR compagnia_rapporto_id = v_src_rapp;
  GET DIAGNOSTICS v_n_riparti = ROW_COUNT;

  -- 4) Tabella legacy polizze
  UPDATE public.polizze
  SET
    compagnia_id = v_dst_ag,
    compagnia_rapporto_id = v_dst_rapp
  WHERE compagnia_id = v_src_ag
     OR compagnia_rapporto_id = v_src_rapp;

  -- 5) Scollega conto bancario fantasma (Armanetti ha già il proprio)
  UPDATE public.compagnie
  SET conto_bancario_id = NULL
  WHERE id = v_src_ag;

  UPDATE public.compagnia_rapporti
  SET conto_bancario_id = NULL
  WHERE compagnia_id = v_src_ag;

  DELETE FROM public.conti_bancari
  WHERE id = v_src_conto;

  -- 6) Elimina agenzia Campobasso (cascade su compagnia_rapporti e provvigioni legate)
  DELETE FROM public.compagnie
  WHERE id = v_src_ag;

  IF NOT EXISTS (SELECT 1 FROM public.compagnie WHERE id = v_src_ag) THEN
    RAISE NOTICE 'Campobasso→Armanetti: % titoli, % rimesse, % riparti; agenzia 00022 eliminata',
      v_n_titoli, v_n_rimesse, v_n_riparti;
  ELSE
    RAISE EXCEPTION 'Eliminazione agenzia Campobasso fallita: verificare FK residue';
  END IF;
END $$;
