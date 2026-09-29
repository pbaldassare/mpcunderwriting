
CREATE OR REPLACE FUNCTION public.tg_titolo_after_insert_crea_polizza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_polizza_id uuid;
  v_madre_titolo_id uuid;
  v_numero_rata integer;
  v_quietanza_id uuid;
BEGIN
  -- skip se già linkato (creato da sync inverso o backfill)
  IF NEW.polizza_id IS NOT NULL THEN RETURN NEW; END IF;
  -- skip se richiesto esplicitamente
  IF current_setting('app.skip_titolo_to_polizza', true) = 'on' THEN RETURN NEW; END IF;

  -- Evita ricorsione dal sync quietanze->titoli
  IF current_setting('app.skip_legacy_sync', true) = 'on' THEN RETURN NEW; END IF;

  -- Disattiva temporaneamente il trigger di sync inverso
  PERFORM set_config('app.skip_legacy_sync','on',true);

  IF NEW.sostituisce_polizza IS NULL THEN
    -- E' una "madre": crea Polizza + prima Quietanza
    PERFORM set_config('app.skip_genera_quietanze','on',true);

    INSERT INTO public.polizze (
      numero_polizza, cliente_anagrafica_id, ufficio_id,
      compagnia_id, ramo_id, prodotto_nome, descrizione_polizza,
      frazionamento, tipo_portafoglio, tipo_mandatario, risk_type,
      durata_da, durata_a, anni_durata, tacito_rinnovo,
      premio_annuo_lordo, premio_annuo_netto, tasse_annue, addizionali_annue,
      provvigioni_annue_firma, provvigioni_annue_quietanza,
      targa_telaio, cig_rif, vincolo,
      stato, titolo_madre_id, created_at
    ) VALUES (
      NEW.numero_titolo, NEW.cliente_anagrafica_id, NEW.ufficio_id,
      NEW.compagnia_id, NEW.ramo_id, NEW.prodotto_nome, NEW.descrizione_polizza,
      NEW.periodicita, NEW.tipo_portafoglio, NEW.tipo_mandatario, NEW.risk_type,
      NEW.durata_da, NEW.durata_a, NEW.anni_durata, coalesce(NEW.tacito_rinnovo,false),
      coalesce(NEW.premio_lordo,0), coalesce(NEW.premio_netto,0), coalesce(NEW.tasse,0), coalesce(NEW.addizionali,0),
      coalesce(NEW.provvigioni_firma,0), coalesce(NEW.provvigioni_quietanza,0),
      NEW.targa_telaio, NEW.cig_rif, NEW.vincolo,
      CASE NEW.stato WHEN 'sospeso' THEN 'sospesa'::polizza_stato
                     WHEN 'annullato' THEN 'annullata'::polizza_stato
                     ELSE 'attiva'::polizza_stato END,
      NEW.id, coalesce(NEW.created_at, now())
    ) RETURNING id INTO v_polizza_id;

    INSERT INTO public.quietanze (
      polizza_id, numero_rata, numero_rate_totali,
      garanzia_da, garanzia_a, data_competenza, data_scadenza,
      mora_giorni, limite_mora,
      premio_lordo, premio_netto, tasse, addizionali,
      provvigioni_firma, provvigioni_quietanza,
      stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
      tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
      titolo_id, created_at
    ) VALUES (
      v_polizza_id, 1, 1,
      NEW.garanzia_da, NEW.garanzia_a, NEW.data_competenza, NEW.data_scadenza,
      NEW.mora_giorni, NEW.limite_mora,
      coalesce(NEW.premio_lordo,0), coalesce(NEW.premio_netto,0), coalesce(NEW.tasse,0), coalesce(NEW.addizionali,0),
      coalesce(NEW.provvigioni_firma,0), coalesce(NEW.provvigioni_quietanza,0),
      CASE WHEN NEW.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
           WHEN NEW.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
           WHEN NEW.stato = 'annullato' THEN 'annullata'::quietanza_stato
           ELSE 'da_incassare'::quietanza_stato END,
      NEW.data_messa_cassa, NEW.data_pagamento, NEW.data_incasso, NEW.importo_incassato,
      NEW.tipo_incasso, NEW.conto_incasso, NEW.appendice, NEW.numero_titolo,
      NEW.id, coalesce(NEW.created_at, now())
    );

    PERFORM set_config('app.skip_genera_quietanze','off',true);

    UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = NEW.id;
  ELSE
    -- E' una rata: trova la polizza della madre tramite numero_titolo
    SELECT id INTO v_polizza_id
    FROM public.polizze
    WHERE numero_polizza = NEW.numero_titolo
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_polizza_id IS NOT NULL THEN
      SELECT coalesce(MAX(numero_rata),0)+1 INTO v_numero_rata
      FROM public.quietanze WHERE polizza_id = v_polizza_id;

      INSERT INTO public.quietanze (
        polizza_id, numero_rata, numero_rate_totali,
        garanzia_da, garanzia_a, data_competenza, data_scadenza,
        mora_giorni, limite_mora,
        premio_lordo, premio_netto, tasse, addizionali,
        provvigioni_firma, provvigioni_quietanza,
        stato, data_messa_cassa, data_pagamento, data_incasso, importo_incassato,
        tipo_incasso, conto_incasso, appendice, numero_polizza_snapshot,
        titolo_id, created_at
      ) VALUES (
        v_polizza_id, v_numero_rata, v_numero_rata,
        NEW.garanzia_da, NEW.garanzia_a, NEW.data_competenza, NEW.data_scadenza,
        NEW.mora_giorni, NEW.limite_mora,
        coalesce(NEW.premio_lordo,0), coalesce(NEW.premio_netto,0), coalesce(NEW.tasse,0), coalesce(NEW.addizionali,0),
        coalesce(NEW.provvigioni_firma,0), coalesce(NEW.provvigioni_quietanza,0),
        CASE WHEN NEW.data_messa_cassa IS NOT NULL THEN 'incassato'::quietanza_stato
             WHEN NEW.stato = 'sospeso' THEN 'sospesa'::quietanza_stato
             WHEN NEW.stato = 'annullato' THEN 'annullata'::quietanza_stato
             ELSE 'da_incassare'::quietanza_stato END,
        NEW.data_messa_cassa, NEW.data_pagamento, NEW.data_incasso, NEW.importo_incassato,
        NEW.tipo_incasso, NEW.conto_incasso, NEW.appendice, NEW.numero_titolo,
        NEW.id, coalesce(NEW.created_at, now())
      );

      -- aggiorna numero_rate_totali per tutta la catena
      UPDATE public.quietanze SET numero_rate_totali = v_numero_rata WHERE polizza_id = v_polizza_id;

      UPDATE public.titoli SET polizza_id = v_polizza_id WHERE id = NEW.id;
    END IF;
  END IF;

  PERFORM set_config('app.skip_legacy_sync','off',true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_titolo_after_insert_polizza ON public.titoli;
CREATE TRIGGER trg_titolo_after_insert_polizza
  AFTER INSERT ON public.titoli
  FOR EACH ROW EXECUTE FUNCTION public.tg_titolo_after_insert_crea_polizza();
