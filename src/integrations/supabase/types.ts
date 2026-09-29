export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _backup_compagnie_cleanup_20260516: {
        Row: {
          archived_at: string
          payload: Json | null
          source_table: string | null
        }
        Insert: {
          archived_at?: string
          payload?: Json | null
          source_table?: string | null
        }
        Update: {
          archived_at?: string
          payload?: Json | null
          source_table?: string | null
        }
        Relationships: []
      }
      _backup_compagnie_reset_20260516: {
        Row: {
          allegato_excel_avvisi: boolean | null
          allegato_excel_ec: boolean | null
          attiva: boolean | null
          aut_incasso_118: boolean | null
          bic: string | null
          cap: string | null
          cellulare: string | null
          citta_banca: string | null
          codice: string | null
          codice_abi: string | null
          codice_cab: string | null
          codice_fiscale: string | null
          comune: string | null
          conto_bancario_id: string | null
          created_at: string | null
          escluso_all4: boolean | null
          fax: string | null
          firma_digitale: string | null
          gruppo_compagnia: string | null
          gruppo_compagnia_id: string | null
          gruppo_statistico: string | null
          iban: string | null
          id: string | null
          indirizzo: string | null
          intestato_a: string | null
          iscrizione_rui_num: string | null
          iscrizione_rui_sez: string | null
          mail: string | null
          mail_avvisi: string | null
          mail_ec: string | null
          nazione: string | null
          nome: string | null
          nome_sede: string | null
          nome_segue: string | null
          note: string | null
          pagamento: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_ra: number | null
          provincia: string | null
          ra_ec_negativi: boolean | null
          rapporti_json: Json | null
          stato: string | null
          telefono: string | null
          tipo: string | null
          tipo_copertura: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          ultima_scadenza_polizza: string | null
        }
        Insert: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          rapporti_json?: Json | null
          stato?: string | null
          telefono?: string | null
          tipo?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Update: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          rapporti_json?: Json | null
          stato?: string | null
          telefono?: string | null
          tipo?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Relationships: []
      }
      _backup_conti_compagnia_20260516: {
        Row: {
          attivo: boolean | null
          banca: string | null
          bic: string | null
          citta_banca: string | null
          codice_abi: string | null
          codice_cab: string | null
          created_at: string | null
          created_by: string | null
          etichetta: string | null
          iban: string | null
          id: string | null
          intestato_a: string | null
          is_default: boolean | null
          note: string | null
          piano_conti_conto_id: string | null
          tipo: string | null
          ufficio_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          attivo?: boolean | null
          banca?: string | null
          bic?: string | null
          citta_banca?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          created_at?: string | null
          created_by?: string | null
          etichetta?: string | null
          iban?: string | null
          id?: string | null
          intestato_a?: string | null
          is_default?: boolean | null
          note?: string | null
          piano_conti_conto_id?: string | null
          tipo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          attivo?: boolean | null
          banca?: string | null
          bic?: string | null
          citta_banca?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          created_at?: string | null
          created_by?: string | null
          etichetta?: string | null
          iban?: string | null
          id?: string | null
          intestato_a?: string | null
          is_default?: boolean | null
          note?: string | null
          piano_conti_conto_id?: string | null
          tipo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      _snapshot_campobasso_titoli: {
        Row: {
          addizionali: number | null
          addizionali_quietanza: number | null
          ae_anagrafica_id: string | null
          ae_nome: string | null
          anagrafica_commerciale_id: string | null
          anni_durata: number | null
          appendice: string | null
          appendice_modifica_polizza_madre_id: string | null
          banca_pagamento: string | null
          brokeraggio_firma: number | null
          brokeraggio_quietanza: number | null
          cambio: number | null
          causale_estinzione: string | null
          causale_sostituzione: string | null
          causale_storno: string | null
          cig_rif: string | null
          cig_temporaneo: boolean | null
          cliente_anagrafica_id: string | null
          cliente_id: string | null
          coassicurazione: boolean | null
          codice_rapporto: string | null
          commerciale_id: string | null
          comp_assicurativa: string | null
          comp_contabile: string | null
          compagnia_id: string | null
          compagnia_rapporto_id: string | null
          conferimento_gestito: boolean | null
          conto_incasso: string | null
          created_at: string | null
          data_competenza: string | null
          data_conferimento_gestito: string | null
          data_copertura: string | null
          data_decorrenza_rinnovo: string | null
          data_estinzione: string | null
          data_incasso: string | null
          data_messa_cassa: string | null
          data_pagamento: string | null
          data_riattivazione: string | null
          data_scadenza: string | null
          data_sospensione: string | null
          data_sostituzione: string | null
          data_storno: string | null
          descrizione_polizza: string | null
          disdetta_mesi: number | null
          durata_a: string | null
          durata_da: string | null
          emissione_fee: boolean | null
          filiale: string | null
          fondi_ricevuti: boolean | null
          formato_elettronico: boolean | null
          frazionamento: string | null
          garanzia_a: string | null
          garanzia_da: string | null
          giorni_presentazione: number | null
          id: string | null
          id_legacy: number | null
          importo_incassato: number | null
          indicizzata: boolean | null
          is_appendice_modifica: boolean | null
          is_oneri_riattivazione: boolean | null
          is_oneri_sospensione: boolean | null
          is_proroga: boolean | null
          is_regolazione: boolean | null
          libro_matricola: string | null
          limite_mora: string | null
          limite_riattivazione: string | null
          mora_giorni: number | null
          motivo_estinzione: string | null
          motivo_sospensione: string | null
          motivo_sostituzione: string | null
          motivo_storno: string | null
          no_calcolo_tasse: boolean | null
          note: string | null
          numero_titolo: string | null
          pag_diretto_compagnia: boolean | null
          percentuale_ae: number | null
          percentuale_brokeraggio: number | null
          percentuale_commerciale: number | null
          percentuale_riparto: number | null
          periodicita: string | null
          polizza_id: string | null
          polizza_rateo: boolean | null
          polizza_temporanea: boolean | null
          premio_lordo: number | null
          premio_netto: number | null
          premio_netto_quietanza: number | null
          prodotto_id: string | null
          prodotto_nome: string | null
          produttore_id: string | null
          produttore_nome: string | null
          proroga_polizza_madre_id: string | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          quietanze_sospensione_snapshot: Json | null
          ramo_id: string | null
          rate: number | null
          regolazione: boolean | null
          regolazione_data_presunta: string | null
          regolazione_fattore: string | null
          regolazione_note: string | null
          regolazione_quietanza_id: string | null
          riga: number | null
          rimborso: boolean | null
          risk_type: string | null
          search_vector: unknown
          snapshot_at: string | null
          sostituisce_appendice: string | null
          sostituisce_polizza: string | null
          sostituisce_riga: number | null
          specialist: string | null
          split_personalizzato: boolean | null
          ssn_firma: number | null
          ssn_quietanza: number | null
          stato: string | null
          storno_appendice: string | null
          storno_polizza: string | null
          storno_riga: number | null
          tacito_rinnovo: boolean | null
          targa_telaio: string | null
          tasse: number | null
          tasse_quietanza: number | null
          tipo_incasso: string | null
          tipo_lettera_regolazione: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          tipo_portafoglio: string | null
          tipo_rinnovo: string | null
          tipo_scadenza: string | null
          titolo_storno_id: string | null
          ufficio_id: string | null
          updated_at: string | null
          valuta: string | null
          vincolo: string | null
          vincolo_attivo: boolean | null
        }
        Insert: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          ae_anagrafica_id?: string | null
          ae_nome?: string | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice?: string | null
          appendice_modifica_polizza_madre_id?: string | null
          banca_pagamento?: string | null
          brokeraggio_firma?: number | null
          brokeraggio_quietanza?: number | null
          cambio?: number | null
          causale_estinzione?: string | null
          causale_sostituzione?: string | null
          causale_storno?: string | null
          cig_rif?: string | null
          cig_temporaneo?: boolean | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          coassicurazione?: boolean | null
          codice_rapporto?: string | null
          commerciale_id?: string | null
          comp_assicurativa?: string | null
          comp_contabile?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          conferimento_gestito?: boolean | null
          conto_incasso?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_conferimento_gestito?: string | null
          data_copertura?: string | null
          data_decorrenza_rinnovo?: string | null
          data_estinzione?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_riattivazione?: string | null
          data_scadenza?: string | null
          data_sospensione?: string | null
          data_sostituzione?: string | null
          data_storno?: string | null
          descrizione_polizza?: string | null
          disdetta_mesi?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          filiale?: string | null
          fondi_ricevuti?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          id?: string | null
          id_legacy?: number | null
          importo_incassato?: number | null
          indicizzata?: boolean | null
          is_appendice_modifica?: boolean | null
          is_oneri_riattivazione?: boolean | null
          is_oneri_sospensione?: boolean | null
          is_proroga?: boolean | null
          is_regolazione?: boolean | null
          libro_matricola?: string | null
          limite_mora?: string | null
          limite_riattivazione?: string | null
          mora_giorni?: number | null
          motivo_estinzione?: string | null
          motivo_sospensione?: string | null
          motivo_sostituzione?: string | null
          motivo_storno?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_ae?: number | null
          percentuale_brokeraggio?: number | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          periodicita?: string | null
          polizza_id?: string | null
          polizza_rateo?: boolean | null
          polizza_temporanea?: boolean | null
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          prodotto_nome?: string | null
          produttore_id?: string | null
          produttore_nome?: string | null
          proroga_polizza_madre_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          quietanze_sospensione_snapshot?: Json | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          regolazione_data_presunta?: string | null
          regolazione_fattore?: string | null
          regolazione_note?: string | null
          regolazione_quietanza_id?: string | null
          riga?: number | null
          rimborso?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          snapshot_at?: string | null
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          split_personalizzato?: boolean | null
          ssn_firma?: number | null
          ssn_quietanza?: number | null
          stato?: string | null
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          tacito_rinnovo?: boolean | null
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_incasso?: string | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          titolo_storno_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
          vincolo_attivo?: boolean | null
        }
        Update: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          ae_anagrafica_id?: string | null
          ae_nome?: string | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice?: string | null
          appendice_modifica_polizza_madre_id?: string | null
          banca_pagamento?: string | null
          brokeraggio_firma?: number | null
          brokeraggio_quietanza?: number | null
          cambio?: number | null
          causale_estinzione?: string | null
          causale_sostituzione?: string | null
          causale_storno?: string | null
          cig_rif?: string | null
          cig_temporaneo?: boolean | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          coassicurazione?: boolean | null
          codice_rapporto?: string | null
          commerciale_id?: string | null
          comp_assicurativa?: string | null
          comp_contabile?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          conferimento_gestito?: boolean | null
          conto_incasso?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_conferimento_gestito?: string | null
          data_copertura?: string | null
          data_decorrenza_rinnovo?: string | null
          data_estinzione?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_riattivazione?: string | null
          data_scadenza?: string | null
          data_sospensione?: string | null
          data_sostituzione?: string | null
          data_storno?: string | null
          descrizione_polizza?: string | null
          disdetta_mesi?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          filiale?: string | null
          fondi_ricevuti?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          id?: string | null
          id_legacy?: number | null
          importo_incassato?: number | null
          indicizzata?: boolean | null
          is_appendice_modifica?: boolean | null
          is_oneri_riattivazione?: boolean | null
          is_oneri_sospensione?: boolean | null
          is_proroga?: boolean | null
          is_regolazione?: boolean | null
          libro_matricola?: string | null
          limite_mora?: string | null
          limite_riattivazione?: string | null
          mora_giorni?: number | null
          motivo_estinzione?: string | null
          motivo_sospensione?: string | null
          motivo_sostituzione?: string | null
          motivo_storno?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_ae?: number | null
          percentuale_brokeraggio?: number | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          periodicita?: string | null
          polizza_id?: string | null
          polizza_rateo?: boolean | null
          polizza_temporanea?: boolean | null
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          prodotto_nome?: string | null
          produttore_id?: string | null
          produttore_nome?: string | null
          proroga_polizza_madre_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          quietanze_sospensione_snapshot?: Json | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          regolazione_data_presunta?: string | null
          regolazione_fattore?: string | null
          regolazione_note?: string | null
          regolazione_quietanza_id?: string | null
          riga?: number | null
          rimborso?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          snapshot_at?: string | null
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          split_personalizzato?: boolean | null
          ssn_firma?: number | null
          ssn_quietanza?: number | null
          stato?: string | null
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          tacito_rinnovo?: boolean | null
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_incasso?: string | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          titolo_storno_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
          vincolo_attivo?: boolean | null
        }
        Relationships: []
      }
      ai_allowed_enums: {
        Row: {
          column_name: string
          created_at: string
          descrizione: string | null
          table_name: string
        }
        Insert: {
          column_name: string
          created_at?: string
          descrizione?: string | null
          table_name: string
        }
        Update: {
          column_name?: string
          created_at?: string
          descrizione?: string | null
          table_name?: string
        }
        Relationships: []
      }
      cb_bot_siti_autorizzati: {
        Row: {
          attivo: boolean
          created_at: string
          created_by: string | null
          dominio: string
          id: string
          nome: string
          note: string | null
          updated_at: string
          url: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          dominio: string
          id?: string
          nome: string
          note?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          dominio?: string
          id?: string
          nome?: string
          note?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cb_bot_fonti: {
        Row: {
          attiva: boolean
          conversazione_id: string | null
          created_at: string
          dominio: string
          id: string
          messaggio_id: string | null
          note: string | null
          origine: string
          salvata_da: string | null
          snippet: string | null
          tags: string[]
          titolo: string
          updated_at: string
          url: string
        }
        Insert: {
          attiva?: boolean
          conversazione_id?: string | null
          created_at?: string
          dominio: string
          id?: string
          messaggio_id?: string | null
          note?: string | null
          origine?: string
          salvata_da?: string | null
          snippet?: string | null
          tags?: string[]
          titolo: string
          updated_at?: string
          url: string
        }
        Update: {
          attiva?: boolean
          conversazione_id?: string | null
          created_at?: string
          dominio?: string
          id?: string
          messaggio_id?: string | null
          note?: string | null
          origine?: string
          salvata_da?: string | null
          snippet?: string | null
          tags?: string[]
          titolo?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      ai_chat_conversazioni: {
        Row: {
          created_at: string
          id: string
          titolo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titolo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titolo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_messaggi: {
        Row: {
          content: string
          conversazione_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          conversazione_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversazione_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messaggi_conversazione_id_fkey"
            columns: ["conversazione_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_user_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      aliquote_provinciali_rca: {
        Row: {
          aggiornato_il: string
          aliquota_pct: number
          note: string | null
          provincia: string
        }
        Insert: {
          aggiornato_il?: string
          aliquota_pct?: number
          note?: string | null
          provincia: string
        }
        Update: {
          aggiornato_il?: string
          aliquota_pct?: number
          note?: string | null
          provincia?: string
        }
        Relationships: []
      }
      anagrafiche_professionali: {
        Row: {
          abi: string | null
          albo_numero: string | null
          annullato: boolean | null
          attivo: boolean | null
          banca_riga1: string | null
          banca_riga2: string | null
          banca_riga3: string | null
          cab: string | null
          cap: string | null
          cellulare: string | null
          citta: string | null
          codice: string | null
          codice_fiscale: string | null
          codice_fornitore: string | null
          cognome: string | null
          compagnia_id: string | null
          created_at: string | null
          data_iscrizione_rui: string | null
          email: string | null
          fax: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_cc: string | null
          iscrizione_rui: string | null
          nome: string | null
          nome_breve: string | null
          nome_rui: string | null
          note: string | null
          numero_rui: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_base: number | null
          percentuale_consulenza: number | null
          percentuale_ra: number | null
          provincia: string | null
          ragione_sociale: string | null
          referente_email: string | null
          referente_nome: string | null
          sezione_rui: string | null
          sigla: string | null
          specializzazione: string | null
          studio_ufficio: string | null
          telefono: string | null
          tipo: string
          trattenuta_provvigioni_incasso: boolean
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          abi?: string | null
          albo_numero?: string | null
          annullato?: boolean | null
          attivo?: boolean | null
          banca_riga1?: string | null
          banca_riga2?: string | null
          banca_riga3?: string | null
          cab?: string | null
          cap?: string | null
          cellulare?: string | null
          citta?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          codice_fornitore?: string | null
          cognome?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          iscrizione_rui?: string | null
          nome?: string | null
          nome_breve?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          provincia?: string | null
          ragione_sociale?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          sezione_rui?: string | null
          sigla?: string | null
          specializzazione?: string | null
          studio_ufficio?: string | null
          telefono?: string | null
          tipo: string
          trattenuta_provvigioni_incasso?: boolean
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abi?: string | null
          albo_numero?: string | null
          annullato?: boolean | null
          attivo?: boolean | null
          banca_riga1?: string | null
          banca_riga2?: string | null
          banca_riga3?: string | null
          cab?: string | null
          cap?: string | null
          cellulare?: string | null
          citta?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          codice_fornitore?: string | null
          cognome?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          iscrizione_rui?: string | null
          nome?: string | null
          nome_breve?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          provincia?: string | null
          ragione_sociale?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          sezione_rui?: string | null
          sigla?: string | null
          specializzazione?: string | null
          studio_ufficio?: string | null
          telefono?: string | null
          tipo?: string
          trattenuta_provvigioni_incasso?: boolean
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anagrafiche_professionali_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anagrafiche_professionali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalie_sistema: {
        Row: {
          created_at: string
          data_risoluzione: string | null
          descrizione: string
          entita_id: string
          entita_tipo: string
          gravita: string
          id: string
          note_risoluzione: string | null
          risolta_da: string | null
          stato: string
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          data_risoluzione?: string | null
          descrizione: string
          entita_id: string
          entita_tipo: string
          gravita?: string
          id?: string
          note_risoluzione?: string | null
          risolta_da?: string | null
          stato?: string
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          data_risoluzione?: string | null
          descrizione?: string
          entita_id?: string
          entita_tipo?: string
          gravita?: string
          id?: string
          note_risoluzione?: string | null
          risolta_da?: string | null
          stato?: string
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomalie_sistema_risolta_da_fkey"
            columns: ["risolta_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalie_sistema_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      appendici_polizza: {
        Row: {
          addizionali: number | null
          allegati: Json
          created_at: string | null
          created_by: string | null
          data_appendice: string | null
          data_effetto: string | null
          file_path: string | null
          id: string
          nome_file: string | null
          note: string | null
          numero_appendice: string
          oggetto: string | null
          percentuale_provvigione: number | null
          polizza_id: string | null
          premio_lordo: number | null
          premio_netto: number | null
          provvigioni: number | null
          quietanza_id: string | null
          ssn: number | null
          tasse: number | null
          testo: string | null
          tipo: string | null
          titolo_id: string
          titolo_modifica_id: string | null
          titolo_proroga_id: string | null
          titolo_regolazione_id: string | null
        }
        Insert: {
          addizionali?: number | null
          allegati?: Json
          created_at?: string | null
          created_by?: string | null
          data_appendice?: string | null
          data_effetto?: string | null
          file_path?: string | null
          id?: string
          nome_file?: string | null
          note?: string | null
          numero_appendice: string
          oggetto?: string | null
          percentuale_provvigione?: number | null
          polizza_id?: string | null
          premio_lordo?: number | null
          premio_netto?: number | null
          provvigioni?: number | null
          quietanza_id?: string | null
          ssn?: number | null
          tasse?: number | null
          testo?: string | null
          tipo?: string | null
          titolo_id: string
          titolo_modifica_id?: string | null
          titolo_proroga_id?: string | null
          titolo_regolazione_id?: string | null
        }
        Update: {
          addizionali?: number | null
          allegati?: Json
          created_at?: string | null
          created_by?: string | null
          data_appendice?: string | null
          data_effetto?: string | null
          file_path?: string | null
          id?: string
          nome_file?: string | null
          note?: string | null
          numero_appendice?: string
          oggetto?: string | null
          percentuale_provvigione?: number | null
          polizza_id?: string | null
          premio_lordo?: number | null
          premio_netto?: number | null
          provvigioni?: number | null
          quietanza_id?: string | null
          ssn?: number | null
          tasse?: number | null
          testo?: string | null
          tipo?: string | null
          titolo_id?: string
          titolo_modifica_id?: string | null
          titolo_proroga_id?: string | null
          titolo_regolazione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appendici_polizza_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "appendici_polizza_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_modifica_id_fkey"
            columns: ["titolo_modifica_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_modifica_id_fkey"
            columns: ["titolo_modifica_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_proroga_id_fkey"
            columns: ["titolo_proroga_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_proroga_id_fkey"
            columns: ["titolo_proroga_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_regolazione_id_fkey"
            columns: ["titolo_regolazione_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appendici_polizza_titolo_regolazione_id_fkey"
            columns: ["titolo_regolazione_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_config: {
        Row: {
          dedup_window_seconds: number
          excluded_fields: string[]
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dedup_window_seconds?: number
          excluded_fields?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dedup_window_seconds?: number
          excluded_fields?: string[]
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      banca_documenti: {
        Row: {
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          nome_file: string
          path_storage: string
          righe_estratte: number | null
          stato: string
          tipo_documento: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          nome_file: string
          path_storage: string
          righe_estratte?: number | null
          stato?: string
          tipo_documento: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          nome_file?: string
          path_storage?: string
          righe_estratte?: number | null
          stato?: string
          tipo_documento?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banca_documenti_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banca_documenti_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      bandi_pubblici: {
        Row: {
          cig: string | null
          created_at: string
          ente: string | null
          ente_tipo: string | null
          id: string
          importo: number | null
          keyword: string | null
          link: string | null
          localita: string | null
          oggetto: string | null
          pdf_path: string | null
          pdf_url: string | null
          regione: string | null
          scadenza: string | null
          scheda_id: string
          stato: string
          tipologia: string | null
          titolo: string | null
          updated_at: string
        }
        Insert: {
          cig?: string | null
          created_at?: string
          ente?: string | null
          ente_tipo?: string | null
          id?: string
          importo?: number | null
          keyword?: string | null
          link?: string | null
          localita?: string | null
          oggetto?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          regione?: string | null
          scadenza?: string | null
          scheda_id: string
          stato?: string
          tipologia?: string | null
          titolo?: string | null
          updated_at?: string
        }
        Update: {
          cig?: string | null
          created_at?: string
          ente?: string | null
          ente_tipo?: string | null
          id?: string
          importo?: number | null
          keyword?: string | null
          link?: string | null
          localita?: string | null
          oggetto?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          regione?: string | null
          scadenza?: string | null
          scheda_id?: string
          stato?: string
          tipologia?: string | null
          titolo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bandi_trattative: {
        Row: {
          bando_id: string
          created_at: string
          id: string
          trattativa_id: string
        }
        Insert: {
          bando_id: string
          created_at?: string
          id?: string
          trattativa_id: string
        }
        Update: {
          bando_id?: string
          created_at?: string
          id?: string
          trattativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bandi_trattative_bando_id_fkey"
            columns: ["bando_id"]
            isOneToOne: false
            referencedRelation: "bandi_pubblici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bandi_trattative_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
        ]
      }
      categorie_prodotto: {
        Row: {
          created_at: string | null
          descrizione: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      causali_contabili: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          effetto_contabile: string
          id: string
          segno_default: string | null
          tipo_tabella: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          effetto_contabile?: string
          id?: string
          segno_default?: string | null
          tipo_tabella: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          effetto_contabile?: string
          id?: string
          segno_default?: string | null
          tipo_tabella?: string
        }
        Relationships: []
      }
      causali_movimento_contabile: {
        Row: {
          attiva: boolean
          codice: string
          created_at: string
          descrizione: string
          id: string
          note: string | null
          segno: string
          updated_at: string
        }
        Insert: {
          attiva?: boolean
          codice: string
          created_at?: string
          descrizione: string
          id?: string
          note?: string | null
          segno?: string
          updated_at?: string
        }
        Update: {
          attiva?: boolean
          codice?: string
          created_at?: string
          descrizione?: string
          id?: string
          note?: string | null
          segno?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificazioni_cu: {
        Row: {
          aliquota_ritenuta: number | null
          altri_importi: number | null
          anno_fiscale: number
          codice_fornitore: string | null
          created_at: string | null
          data_primanota: string | null
          fornitore_id: string | null
          id: string
          imponibile: number | null
          nome_fornitore: string | null
          non_soggetto: number | null
          numero_documento: string | null
          numero_primanota: string | null
          numero_protocollo: string | null
          ritenuta: number | null
          stato: string | null
          tipo_reddito: string | null
          totale: number | null
          ufficio_id: string | null
        }
        Insert: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          anno_fiscale: number
          codice_fornitore?: string | null
          created_at?: string | null
          data_primanota?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          nome_fornitore?: string | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_primanota?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo_reddito?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Update: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          anno_fiscale?: number
          codice_fornitore?: string | null
          created_at?: string | null
          data_primanota?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          nome_fornitore?: string | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_primanota?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo_reddito?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificazioni_cu_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificazioni_cu_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_canali: {
        Row: {
          ambito: string
          created_at: string | null
          creato_da: string | null
          entita_id: string | null
          entita_tipo: string | null
          id: string
          nome: string | null
          tipo: string
          ufficio_id: string | null
          visibile_cliente: boolean
        }
        Insert: {
          ambito?: string
          created_at?: string | null
          creato_da?: string | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          ufficio_id?: string | null
          visibile_cliente?: boolean
        }
        Update: {
          ambito?: string
          created_at?: string | null
          creato_da?: string | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          ufficio_id?: string | null
          visibile_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_canali_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_canali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_canali_membri: {
        Row: {
          canale_id: string
          created_at: string | null
          id: string
          ruolo_canale: string
          ultimo_letto_at: string | null
          user_id: string
        }
        Insert: {
          canale_id: string
          created_at?: string | null
          id?: string
          ruolo_canale?: string
          ultimo_letto_at?: string | null
          user_id: string
        }
        Update: {
          canale_id?: string
          created_at?: string | null
          id?: string
          ruolo_canale?: string
          ultimo_letto_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_canali_membri_canale_id_fkey"
            columns: ["canale_id"]
            isOneToOne: false
            referencedRelation: "chat_canali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_canali_membri_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conferme_lettura: {
        Row: {
          confermato: boolean | null
          confermato_at: string | null
          created_at: string | null
          id: string
          messaggio_id: string
          user_id: string
        }
        Insert: {
          confermato?: boolean | null
          confermato_at?: string | null
          created_at?: string | null
          id?: string
          messaggio_id: string
          user_id: string
        }
        Update: {
          confermato?: boolean | null
          confermato_at?: string | null
          created_at?: string | null
          id?: string
          messaggio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conferme_lettura_messaggio_id_fkey"
            columns: ["messaggio_id"]
            isOneToOne: false
            referencedRelation: "chat_messaggi_interni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conferme_lettura_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messaggi: {
        Row: {
          created_at: string | null
          entita_id: string
          entita_tipo: string
          id: string
          letto: boolean | null
          messaggio: string
          mittente_id: string
        }
        Insert: {
          created_at?: string | null
          entita_id: string
          entita_tipo: string
          id?: string
          letto?: boolean | null
          messaggio: string
          mittente_id: string
        }
        Update: {
          created_at?: string | null
          entita_id?: string
          entita_tipo?: string
          id?: string
          letto?: boolean | null
          messaggio?: string
          mittente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messaggi_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messaggi_interni: {
        Row: {
          canale_id: string
          created_at: string | null
          id: string
          messaggio: string
          mittente_id: string
          richiedi_conferma: boolean | null
          tipo_messaggio: string
        }
        Insert: {
          canale_id: string
          created_at?: string | null
          id?: string
          messaggio: string
          mittente_id: string
          richiedi_conferma?: boolean | null
          tipo_messaggio?: string
        }
        Update: {
          canale_id?: string
          created_at?: string | null
          id?: string
          messaggio?: string
          mittente_id?: string
          richiedi_conferma?: boolean | null
          tipo_messaggio?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messaggi_interni_canale_id_fkey"
            columns: ["canale_id"]
            isOneToOne: false
            referencedRelation: "chat_canali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messaggi_interni_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chiusure_contabili: {
        Row: {
          avviato_da: string | null
          completato_da: string | null
          completato_il: string | null
          created_at: string | null
          id: string
          note: string | null
          periodo: string
          stato: string
          step_movimenti: boolean | null
          step_quadratura_iva: boolean | null
          step_report: boolean | null
          step_riconciliazione: boolean | null
          step_scadenziario: boolean | null
          tipo: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          avviato_da?: string | null
          completato_da?: string | null
          completato_il?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          periodo: string
          stato?: string
          step_movimenti?: boolean | null
          step_quadratura_iva?: boolean | null
          step_report?: boolean | null
          step_riconciliazione?: boolean | null
          step_scadenziario?: boolean | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avviato_da?: string | null
          completato_da?: string | null
          completato_il?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          periodo?: string
          stato?: string
          step_movimenti?: boolean | null
          step_quadratura_iva?: boolean | null
          step_report?: boolean | null
          step_riconciliazione?: boolean | null
          step_scadenziario?: boolean | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chiusure_contabili_avviato_da_fkey"
            columns: ["avviato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_contabili_completato_da_fkey"
            columns: ["completato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_contabili_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_anticipi: {
        Row: {
          causale_id: string
          cliente_id: string
          conto_bancario_id: string | null
          created_at: string
          creato_da: string | null
          data_anticipo: string
          id: string
          importo: number
          importo_residuo: number
          movimento_bancario_id: string | null
          note: string | null
          rimborsato_da: string | null
          rimborsato_il: string | null
          rimborsato_note: string | null
          segno: string
          titolo_origine_id: string | null
          updated_at: string
        }
        Insert: {
          causale_id: string
          cliente_id: string
          conto_bancario_id?: string | null
          created_at?: string
          creato_da?: string | null
          data_anticipo?: string
          id?: string
          importo: number
          importo_residuo?: number
          movimento_bancario_id?: string | null
          note?: string | null
          rimborsato_da?: string | null
          rimborsato_il?: string | null
          rimborsato_note?: string | null
          segno?: string
          titolo_origine_id?: string | null
          updated_at?: string
        }
        Update: {
          causale_id?: string
          cliente_id?: string
          conto_bancario_id?: string | null
          created_at?: string
          creato_da?: string | null
          data_anticipo?: string
          id?: string
          importo?: number
          importo_residuo?: number
          movimento_bancario_id?: string | null
          note?: string | null
          rimborsato_da?: string | null
          rimborsato_il?: string | null
          rimborsato_note?: string | null
          segno?: string
          titolo_origine_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_anticipi_causale_id_fkey"
            columns: ["causale_id"]
            isOneToOne: false
            referencedRelation: "causali_contabili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_movimento_bancario_id_fkey"
            columns: ["movimento_bancario_id"]
            isOneToOne: false
            referencedRelation: "movimenti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_rimborsato_da_fkey"
            columns: ["rimborsato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_titolo_origine_id_fkey"
            columns: ["titolo_origine_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_titolo_origine_id_fkey"
            columns: ["titolo_origine_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_anticipi_utilizzi: {
        Row: {
          anticipo_id: string
          created_at: string
          creato_da: string | null
          data_utilizzo: string
          id: string
          importo_utilizzato: number
          titolo_id: string
        }
        Insert: {
          anticipo_id: string
          created_at?: string
          creato_da?: string | null
          data_utilizzo?: string
          id?: string
          importo_utilizzato: number
          titolo_id: string
        }
        Update: {
          anticipo_id?: string
          created_at?: string
          creato_da?: string | null
          data_utilizzo?: string
          id?: string
          importo_utilizzato?: number
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_anticipi_utilizzi_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "cliente_anticipi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_utilizzi_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_utilizzi_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_anticipi_utilizzi_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          area_riservata_tipo: string
          attenzione_di: string | null
          attivita: string | null
          attivo: boolean | null
          azienda_ssn_sx: boolean | null
          azienda_stat: string | null
          cap_alternativo: string | null
          cap_fiscale: string | null
          cap_residenza: string | null
          cap_sede: string | null
          cellulare: string | null
          cig_temporaneo: boolean
          citta_alternativa: string | null
          citta_fiscale: string | null
          citta_residenza: string | null
          citta_sede: string | null
          cliente_associato: boolean | null
          cliente_captive: boolean | null
          cliente_non_ceduto: boolean | null
          codice_ateco: string | null
          codice_cig: string | null
          codice_cliente: string | null
          codice_fiscale: string | null
          codice_fiscale_azienda: string | null
          codice_ricerca: string | null
          codice_sdi: string | null
          cognome: string | null
          comune_nascita: string | null
          contratto: string | null
          created_at: string | null
          data_nascita: string | null
          email: string | null
          fascia_dipendenti: string | null
          fascia_fatturato: string | null
          fatturato: number | null
          fax: string | null
          fido_cauzioni: number | null
          fido_credito: number | null
          forma_giuridica: string | null
          gruppo_finanziario_id: string | null
          gruppo_statistico: string | null
          ha_incarico: boolean
          id: string
          incarico_a: string | null
          incarico_da: string | null
          indirizzo_alternativo: string | null
          indirizzo_fiscale: string | null
          indirizzo_residenza: string | null
          indirizzo_sede: string | null
          indotto: string | null
          internazionale: boolean | null
          luogo_nascita: string | null
          matricola: string | null
          merged_at: string | null
          merged_by: string | null
          merged_into: string | null
          nazione: string | null
          nome: string | null
          note: string | null
          num_dipendenti: number | null
          partita_iva: string | null
          pec: string | null
          prospect: string | null
          provincia_alternativa: string | null
          provincia_fiscale: string | null
          provincia_nascita: string | null
          provincia_residenza: string | null
          provincia_sede: string | null
          ragione_sociale: string | null
          referente_cognome: string | null
          referente_email: string | null
          referente_nome: string | null
          referente_telefono: string | null
          riferimento: string | null
          sesso: string | null
          settore: string | null
          spec_sx_danni: string | null
          spec_sx_sanita: string | null
          statistica_premi_sinistri: boolean | null
          stato_cliente: string | null
          telefono: string | null
          tipo_cliente: string
          tipo_persona: string | null
          tipo_sommario: string | null
          titolo: string | null
          ufficio_id: string | null
          updated_at: string | null
          user_id: string | null
          zona: string | null
        }
        Insert: {
          area_riservata_tipo?: string
          attenzione_di?: string | null
          attivita?: string | null
          attivo?: boolean | null
          azienda_ssn_sx?: boolean | null
          azienda_stat?: string | null
          cap_alternativo?: string | null
          cap_fiscale?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          cig_temporaneo?: boolean
          citta_alternativa?: string | null
          citta_fiscale?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          cliente_non_ceduto?: boolean | null
          codice_ateco?: string | null
          codice_cig?: string | null
          codice_cliente?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fascia_dipendenti?: string | null
          fascia_fatturato?: string | null
          fatturato?: number | null
          fax?: string | null
          fido_cauzioni?: number | null
          fido_credito?: number | null
          forma_giuridica?: string | null
          gruppo_finanziario_id?: string | null
          gruppo_statistico?: string | null
          ha_incarico?: boolean
          id?: string
          incarico_a?: string | null
          incarico_da?: string | null
          indirizzo_alternativo?: string | null
          indirizzo_fiscale?: string | null
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          num_dipendenti?: number | null
          partita_iva?: string | null
          pec?: string | null
          prospect?: string | null
          provincia_alternativa?: string | null
          provincia_fiscale?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          sesso?: string | null
          settore?: string | null
          spec_sx_danni?: string | null
          spec_sx_sanita?: string | null
          statistica_premi_sinistri?: boolean | null
          stato_cliente?: string | null
          telefono?: string | null
          tipo_cliente?: string
          tipo_persona?: string | null
          tipo_sommario?: string | null
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Update: {
          area_riservata_tipo?: string
          attenzione_di?: string | null
          attivita?: string | null
          attivo?: boolean | null
          azienda_ssn_sx?: boolean | null
          azienda_stat?: string | null
          cap_alternativo?: string | null
          cap_fiscale?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          cig_temporaneo?: boolean
          citta_alternativa?: string | null
          citta_fiscale?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          cliente_non_ceduto?: boolean | null
          codice_ateco?: string | null
          codice_cig?: string | null
          codice_cliente?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fascia_dipendenti?: string | null
          fascia_fatturato?: string | null
          fatturato?: number | null
          fax?: string | null
          fido_cauzioni?: number | null
          fido_credito?: number | null
          forma_giuridica?: string | null
          gruppo_finanziario_id?: string | null
          gruppo_statistico?: string | null
          ha_incarico?: boolean
          id?: string
          incarico_a?: string | null
          incarico_da?: string | null
          indirizzo_alternativo?: string | null
          indirizzo_fiscale?: string | null
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          num_dipendenti?: number | null
          partita_iva?: string | null
          pec?: string | null
          prospect?: string | null
          provincia_alternativa?: string | null
          provincia_fiscale?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          sesso?: string | null
          settore?: string | null
          spec_sx_danni?: string | null
          spec_sx_sanita?: string | null
          statistica_premi_sinistri?: boolean | null
          stato_cliente?: string | null
          telefono?: string | null
          tipo_cliente?: string
          tipo_persona?: string | null
          tipo_sommario?: string | null
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_gruppo_finanziario_id_fkey"
            columns: ["gruppo_finanziario_id"]
            isOneToOne: false
            referencedRelation: "gruppi_finanziari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_intermediari_default: {
        Row: {
          anagrafica_commerciale_id: string
          cliente_id: string
          created_at: string
          escludi_provvigioni: boolean
          id: string
          ordine: number
          percentuale: number
          tipo: string
        }
        Insert: {
          anagrafica_commerciale_id: string
          cliente_id: string
          created_at?: string
          escludi_provvigioni?: boolean
          id?: string
          ordine?: number
          percentuale?: number
          tipo: string
        }
        Update: {
          anagrafica_commerciale_id?: string
          cliente_id?: string
          created_at?: string
          escludi_provvigioni?: boolean
          id?: string
          ordine?: number
          percentuale?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_intermediari_default_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_intermediari_default_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_merge_log: {
        Row: {
          cliente_legacy_id: string
          cliente_master_id: string
          entita_spostate: Json
          eseguito_at: string
          eseguito_da: string | null
          id: string
          note: string | null
          snapshot_legacy: Json
        }
        Insert: {
          cliente_legacy_id: string
          cliente_master_id: string
          entita_spostate?: Json
          eseguito_at?: string
          eseguito_da?: string | null
          id?: string
          note?: string | null
          snapshot_legacy: Json
        }
        Update: {
          cliente_legacy_id?: string
          cliente_master_id?: string
          entita_spostate?: Json
          eseguito_at?: string
          eseguito_da?: string | null
          id?: string
          note?: string | null
          snapshot_legacy?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clienti_merge_log_cliente_master_id_fkey"
            columns: ["cliente_master_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_relazioni: {
        Row: {
          cliente_collegato_id: string
          cliente_id: string
          created_at: string | null
          id: string
          note: string | null
          tipo_relazione: string
        }
        Insert: {
          cliente_collegato_id: string
          cliente_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          tipo_relazione?: string
        }
        Update: {
          cliente_collegato_id?: string
          cliente_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          tipo_relazione?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_relazioni_cliente_collegato_id_fkey"
            columns: ["cliente_collegato_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_relazioni_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      codici_commerciali_cliente: {
        Row: {
          altro_broker: boolean | null
          altro_broker_nome: string | null
          anagrafica_id: string | null
          cliente_id: string
          contatto: string | null
          created_at: string | null
          data_acquisito: string | null
          data_disdetta: string | null
          escludi_provvigioni: boolean
          filiale: string | null
          id: string
          mandato: string | null
          percentuale: number | null
          profilo_id: string | null
          ruolo: string
          scadenza_mandato: string | null
          societa_brand: string | null
          termine_proroga: string | null
          updated_at: string | null
        }
        Insert: {
          altro_broker?: boolean | null
          altro_broker_nome?: string | null
          anagrafica_id?: string | null
          cliente_id: string
          contatto?: string | null
          created_at?: string | null
          data_acquisito?: string | null
          data_disdetta?: string | null
          escludi_provvigioni?: boolean
          filiale?: string | null
          id?: string
          mandato?: string | null
          percentuale?: number | null
          profilo_id?: string | null
          ruolo: string
          scadenza_mandato?: string | null
          societa_brand?: string | null
          termine_proroga?: string | null
          updated_at?: string | null
        }
        Update: {
          altro_broker?: boolean | null
          altro_broker_nome?: string | null
          anagrafica_id?: string | null
          cliente_id?: string
          contatto?: string | null
          created_at?: string | null
          data_acquisito?: string | null
          data_disdetta?: string | null
          escludi_provvigioni?: boolean
          filiale?: string | null
          id?: string
          mandato?: string | null
          percentuale?: number | null
          profilo_id?: string | null
          ruolo?: string
          scadenza_mandato?: string | null
          societa_brand?: string | null
          termine_proroga?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codici_commerciali_cliente_anagrafica_id_fkey"
            columns: ["anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_commerciali_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_commerciali_cliente_profilo_id_fkey"
            columns: ["profilo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnia_rapporti: {
        Row: {
          attivo: boolean
          codice_rapporto: string | null
          compagnia_id: string
          conto_bancario_id: string | null
          created_at: string
          created_by: string | null
          data_fine: string | null
          data_inizio: string | null
          email_estratto_conto: string | null
          email_messe_a_cassa: string | null
          email_referente: string | null
          gruppo_compagnia_id: string
          iban_dedicato: string | null
          id: string
          is_principale: boolean
          nome_rapporto: string | null
          note: string | null
          percentuale_provvigione: number | null
          percentuale_ra: number | null
          rami_abilitati: string[] | null
          referente_compagnia: string | null
          sede_cap: string | null
          sede_citta: string | null
          sede_denominazione: string | null
          sede_indirizzo: string | null
          sede_provincia: string | null
          telefono_referente: string | null
          tipo_rapporto: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attivo?: boolean
          codice_rapporto?: string | null
          compagnia_id: string
          conto_bancario_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          email_estratto_conto?: string | null
          email_messe_a_cassa?: string | null
          email_referente?: string | null
          gruppo_compagnia_id: string
          iban_dedicato?: string | null
          id?: string
          is_principale?: boolean
          nome_rapporto?: string | null
          note?: string | null
          percentuale_provvigione?: number | null
          percentuale_ra?: number | null
          rami_abilitati?: string[] | null
          referente_compagnia?: string | null
          sede_cap?: string | null
          sede_citta?: string | null
          sede_denominazione?: string | null
          sede_indirizzo?: string | null
          sede_provincia?: string | null
          telefono_referente?: string | null
          tipo_rapporto?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attivo?: boolean
          codice_rapporto?: string | null
          compagnia_id?: string
          conto_bancario_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          email_estratto_conto?: string | null
          email_messe_a_cassa?: string | null
          email_referente?: string | null
          gruppo_compagnia_id?: string
          iban_dedicato?: string | null
          id?: string
          is_principale?: boolean
          nome_rapporto?: string | null
          note?: string | null
          percentuale_provvigione?: number | null
          percentuale_ra?: number | null
          rami_abilitati?: string[] | null
          referente_compagnia?: string | null
          sede_cap?: string | null
          sede_citta?: string | null
          sede_denominazione?: string | null
          sede_indirizzo?: string | null
          sede_provincia?: string | null
          telefono_referente?: string | null
          tipo_rapporto?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compagnia_rapporti_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnia_rapporti_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnia_rapporti_gruppo_compagnia_id_fkey"
            columns: ["gruppo_compagnia_id"]
            isOneToOne: false
            referencedRelation: "gruppi_compagnia"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnia_rapporto_documenti: {
        Row: {
          created_at: string
          dimensione_bytes: number | null
          file_path: string
          id: string
          mime_type: string | null
          nome_file: string
          rapporto_id: string
          tipo_documento: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          dimensione_bytes?: number | null
          file_path: string
          id?: string
          mime_type?: string | null
          nome_file: string
          rapporto_id: string
          tipo_documento?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          dimensione_bytes?: number | null
          file_path?: string
          id?: string
          mime_type?: string | null
          nome_file?: string
          rapporto_id?: string
          tipo_documento?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compagnia_rapporto_documenti_rapporto_id_fkey"
            columns: ["rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnia_rapporto_documenti_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnia_rapporto_rami: {
        Row: {
          created_at: string
          gruppo_ramo_id: string
          id: string
          ramo_id: string | null
          rapporto_id: string
        }
        Insert: {
          created_at?: string
          gruppo_ramo_id: string
          id?: string
          ramo_id?: string | null
          rapporto_id: string
        }
        Update: {
          created_at?: string
          gruppo_ramo_id?: string
          id?: string
          ramo_id?: string | null
          rapporto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compagnia_rapporto_rami_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnia_rapporto_rami_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "compagnia_rapporto_rami_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnia_rapporto_rami_rapporto_id_fkey"
            columns: ["rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnie: {
        Row: {
          accordo_collaborazione: boolean
          allegato_excel_avvisi: boolean | null
          allegato_excel_ec: boolean | null
          attiva: boolean | null
          aut_incasso_118: boolean | null
          bic: string | null
          cap: string | null
          cellulare: string | null
          citta_banca: string | null
          codice: string | null
          codice_abi: string | null
          codice_cab: string | null
          codice_fiscale: string | null
          comune: string | null
          conto_bancario_id: string | null
          created_at: string | null
          email_estratto_conto: string | null
          email_messe_a_cassa: string | null
          escluso_all4: boolean | null
          fax: string | null
          firma_digitale: string | null
          gruppo_compagnia: string | null
          gruppo_compagnia_id: string | null
          gruppo_statistico: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestato_a: string | null
          iscrizione_rui_num: string | null
          iscrizione_rui_sez: string | null
          mail: string | null
          mail_avvisi: string | null
          mail_ec: string | null
          nazione: string | null
          nome: string
          nome_sede: string | null
          nome_segue: string | null
          note: string | null
          pagamento: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_ra: number | null
          provincia: string | null
          ra_ec_negativi: boolean | null
          ratifica_art_118: boolean
          stato: string | null
          telefono: string | null
          tipo: string
          tipo_copertura: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          ultima_scadenza_polizza: string | null
        }
        Insert: {
          accordo_collaborazione?: boolean
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          email_estratto_conto?: string | null
          email_messe_a_cassa?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome: string
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          ratifica_art_118?: boolean
          stato?: string | null
          telefono?: string | null
          tipo?: string
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Update: {
          accordo_collaborazione?: boolean
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          email_estratto_conto?: string | null
          email_messe_a_cassa?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          ratifica_art_118?: boolean
          stato?: string | null
          telefono?: string | null
          tipo?: string
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compagnie_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compagnie_gruppo_compagnia_id_fkey"
            columns: ["gruppo_compagnia_id"]
            isOneToOne: false
            referencedRelation: "gruppi_compagnia"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnie_snapshot_post_dedup: {
        Row: {
          allegato_excel_avvisi: boolean | null
          allegato_excel_ec: boolean | null
          attiva: boolean | null
          aut_incasso_118: boolean | null
          bic: string | null
          cap: string | null
          cellulare: string | null
          citta_banca: string | null
          codice: string | null
          codice_abi: string | null
          codice_cab: string | null
          codice_fiscale: string | null
          comune: string | null
          created_at: string | null
          escluso_all4: boolean | null
          fax: string | null
          firma_digitale: string | null
          gruppo_compagnia: string | null
          gruppo_compagnia_id: string | null
          gruppo_statistico: string | null
          iban: string | null
          id: string | null
          indirizzo: string | null
          intestato_a: string | null
          iscrizione_rui_num: string | null
          iscrizione_rui_sez: string | null
          mail: string | null
          mail_avvisi: string | null
          mail_ec: string | null
          nazione: string | null
          nome: string | null
          nome_sede: string | null
          nome_segue: string | null
          note: string | null
          pagamento: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_ra: number | null
          provincia: string | null
          ra_ec_negativi: boolean | null
          snapshot_at: string | null
          stato: string | null
          telefono: string | null
          tipo_copertura: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          ultima_scadenza_polizza: string | null
        }
        Insert: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          snapshot_at?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Update: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          snapshot_at?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Relationships: []
      }
      compagnie_snapshot_round2: {
        Row: {
          allegato_excel_avvisi: boolean | null
          allegato_excel_ec: boolean | null
          attiva: boolean | null
          aut_incasso_118: boolean | null
          bic: string | null
          cap: string | null
          cellulare: string | null
          citta_banca: string | null
          codice: string | null
          codice_abi: string | null
          codice_cab: string | null
          codice_fiscale: string | null
          comune: string | null
          created_at: string | null
          escluso_all4: boolean | null
          fax: string | null
          firma_digitale: string | null
          gruppo_compagnia: string | null
          gruppo_compagnia_id: string | null
          gruppo_statistico: string | null
          iban: string | null
          id: string | null
          indirizzo: string | null
          intestato_a: string | null
          iscrizione_rui_num: string | null
          iscrizione_rui_sez: string | null
          mail: string | null
          mail_avvisi: string | null
          mail_ec: string | null
          nazione: string | null
          nome: string | null
          nome_sede: string | null
          nome_segue: string | null
          note: string | null
          pagamento: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_ra: number | null
          provincia: string | null
          ra_ec_negativi: boolean | null
          snapshot_at: string | null
          stato: string | null
          telefono: string | null
          tipo_copertura: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          ultima_scadenza_polizza: string | null
        }
        Insert: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          snapshot_at?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Update: {
          allegato_excel_avvisi?: boolean | null
          allegato_excel_ec?: boolean | null
          attiva?: boolean | null
          aut_incasso_118?: boolean | null
          bic?: string | null
          cap?: string | null
          cellulare?: string | null
          citta_banca?: string | null
          codice?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          escluso_all4?: boolean | null
          fax?: string | null
          firma_digitale?: string | null
          gruppo_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string | null
          indirizzo?: string | null
          intestato_a?: string | null
          iscrizione_rui_num?: string | null
          iscrizione_rui_sez?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nazione?: string | null
          nome?: string | null
          nome_sede?: string | null
          nome_segue?: string | null
          note?: string | null
          pagamento?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          ra_ec_negativi?: boolean | null
          snapshot_at?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_copertura?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Relationships: []
      }
      conducenti_polizza: {
        Row: {
          cap: string | null
          citta: string | null
          cognome: string | null
          created_at: string | null
          data_nascita: string | null
          data_rilascio_patente: string | null
          id: string
          indirizzo: string | null
          nome: string | null
          note: string | null
          provincia: string | null
          tipo_patente: string | null
          titolo_id: string
          updated_at: string | null
        }
        Insert: {
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          data_nascita?: string | null
          data_rilascio_patente?: string | null
          id?: string
          indirizzo?: string | null
          nome?: string | null
          note?: string | null
          provincia?: string | null
          tipo_patente?: string | null
          titolo_id: string
          updated_at?: string | null
        }
        Update: {
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          data_nascita?: string | null
          data_rilascio_patente?: string | null
          id?: string
          indirizzo?: string | null
          nome?: string | null
          note?: string | null
          provincia?: string | null
          tipo_patente?: string | null
          titolo_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conducenti_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: true
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conducenti_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: true
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      consultazione_accessi: {
        Row: {
          created_at: string
          disclaimer_version: string
          email: string
          id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          disclaimer_version: string
          email: string
          id?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          disclaimer_version?: string
          email?: string
          id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      consultazione_ricerche: {
        Row: {
          created_at: string
          email: string
          id: string
          percorso: string | null
          query: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          percorso?: string | null
          query: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          percorso?: string | null
          query?: string
        }
        Relationships: []
      }
      conti_bancari: {
        Row: {
          attivo: boolean
          banca: string | null
          bic: string | null
          citta_banca: string | null
          codice_abi: string | null
          codice_cab: string | null
          compagnia_id: string | null
          created_at: string
          created_by: string | null
          etichetta: string
          iban: string
          id: string
          intestato_a: string
          is_default: boolean
          note: string | null
          piano_conti_conto_id: string | null
          rapporto_id: string | null
          tipo: string
          ufficio_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attivo?: boolean
          banca?: string | null
          bic?: string | null
          citta_banca?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          etichetta: string
          iban: string
          id?: string
          intestato_a: string
          is_default?: boolean
          note?: string | null
          piano_conti_conto_id?: string | null
          rapporto_id?: string | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attivo?: boolean
          banca?: string | null
          bic?: string | null
          citta_banca?: string | null
          codice_abi?: string | null
          codice_cab?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          etichetta?: string
          iban?: string
          id?: string
          intestato_a?: string
          is_default?: boolean
          note?: string | null
          piano_conti_conto_id?: string | null
          rapporto_id?: string | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conti_bancari_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conti_bancari_piano_conti_conto_id_fkey"
            columns: ["piano_conti_conto_id"]
            isOneToOne: false
            referencedRelation: "piano_conti_conti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conti_bancari_rapporto_id_fkey"
            columns: ["rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conti_bancari_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      conti_bancari_uffici: {
        Row: {
          conto_bancario_id: string
          created_at: string
          ufficio_id: string
        }
        Insert: {
          conto_bancario_id: string
          created_at?: string
          ufficio_id: string
        }
        Update: {
          conto_bancario_id?: string
          created_at?: string
          ufficio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conti_bancari_uffici_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conti_bancari_uffici_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      dettaglio_riparto: {
        Row: {
          addizionali: number | null
          compagnia_id: string | null
          compagnia_rapporto_id: string | null
          created_at: string | null
          data_copertura: string | null
          emissione_compagnia: string | null
          gruppo_compagnia_id: string | null
          id: string
          netto: number | null
          perc_gestione: number | null
          perc_provv_addizionali: number | null
          perc_provv_netto: number | null
          provv_addizionali: number | null
          provv_netto: number | null
          quota_percentuale: number | null
          tasse: number | null
          tipo_pagamento: string | null
          titolo_id: string
          totale: number | null
        }
        Insert: {
          addizionali?: number | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string | null
          data_copertura?: string | null
          emissione_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          id?: string
          netto?: number | null
          perc_gestione?: number | null
          perc_provv_addizionali?: number | null
          perc_provv_netto?: number | null
          provv_addizionali?: number | null
          provv_netto?: number | null
          quota_percentuale?: number | null
          tasse?: number | null
          tipo_pagamento?: string | null
          titolo_id: string
          totale?: number | null
        }
        Update: {
          addizionali?: number | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string | null
          data_copertura?: string | null
          emissione_compagnia?: string | null
          gruppo_compagnia_id?: string | null
          id?: string
          netto?: number | null
          perc_gestione?: number | null
          perc_provv_addizionali?: number | null
          perc_provv_netto?: number | null
          provv_addizionali?: number | null
          provv_netto?: number | null
          quota_percentuale?: number | null
          tasse?: number | null
          tipo_pagamento?: string | null
          titolo_id?: string
          totale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dettaglio_riparto_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dettaglio_riparto_compagnia_rapporto_id_fkey"
            columns: ["compagnia_rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dettaglio_riparto_gruppo_compagnia_id_fkey"
            columns: ["gruppo_compagnia_id"]
            isOneToOne: false
            referencedRelation: "gruppi_compagnia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dettaglio_riparto_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dettaglio_riparto_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      distinte_giornaliere: {
        Row: {
          chiuso_da: string | null
          chiuso_il: string | null
          created_at: string | null
          creato_da: string | null
          data_distinta: string
          differenza_cassa: number | null
          id: string
          note: string | null
          saldo_cassa_atteso: number | null
          stato: string
          totale_assegni: number | null
          totale_bonifici: number | null
          totale_contanti: number | null
          totale_generale: number | null
          totale_pos: number | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          chiuso_da?: string | null
          chiuso_il?: string | null
          created_at?: string | null
          creato_da?: string | null
          data_distinta: string
          differenza_cassa?: number | null
          id?: string
          note?: string | null
          saldo_cassa_atteso?: number | null
          stato?: string
          totale_assegni?: number | null
          totale_bonifici?: number | null
          totale_contanti?: number | null
          totale_generale?: number | null
          totale_pos?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chiuso_da?: string | null
          chiuso_il?: string | null
          created_at?: string | null
          creato_da?: string | null
          data_distinta?: string
          differenza_cassa?: number | null
          id?: string
          note?: string | null
          saldo_cassa_atteso?: number | null
          stato?: string
          totale_assegni?: number | null
          totale_bonifici?: number | null
          totale_contanti?: number | null
          totale_generale?: number | null
          totale_pos?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distinte_giornaliere_chiuso_da_fkey"
            columns: ["chiuso_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      distinte_giornaliere_righe: {
        Row: {
          created_at: string | null
          descrizione: string | null
          distinta_id: string
          id: string
          importo: number
          movimento_id: string | null
          riferimento: string | null
          tipo_pagamento: string
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          distinta_id: string
          id?: string
          importo?: number
          movimento_id?: string | null
          riferimento?: string | null
          tipo_pagamento: string
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          distinta_id?: string
          id?: string
          importo?: number
          movimento_id?: string | null
          riferimento?: string | null
          tipo_pagamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "distinte_giornaliere_righe_distinta_id_fkey"
            columns: ["distinta_id"]
            isOneToOne: false
            referencedRelation: "distinte_giornaliere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_righe_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti_contabili"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          active: boolean | null
          compagnia_id: string | null
          created_at: string | null
          description: string | null
          folder_type: string
          icon: string | null
          id: string
          name: string
          order_index: number | null
          parent_folder_id: string | null
        }
        Insert: {
          active?: boolean | null
          compagnia_id?: string | null
          created_at?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number | null
          parent_folder_id?: string | null
        }
        Update: {
          active?: boolean | null
          compagnia_id?: string | null
          created_at?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number | null
          parent_folder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_library: {
        Row: {
          active: boolean | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_id: string
          id: string
          tags: string[] | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_id: string
          id?: string
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_id?: string
          id?: string
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_library_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documenti: {
        Row: {
          bucket_name: string
          caricato_da: string | null
          caricato_da_cliente: boolean
          categoria: string | null
          created_at: string | null
          entita_id: string
          entita_tipo: string
          id: string
          nome_file: string
          path_storage: string
          visibile_al_cliente: boolean | null
        }
        Insert: {
          bucket_name?: string
          caricato_da?: string | null
          caricato_da_cliente?: boolean
          categoria?: string | null
          created_at?: string | null
          entita_id: string
          entita_tipo: string
          id?: string
          nome_file: string
          path_storage: string
          visibile_al_cliente?: boolean | null
        }
        Update: {
          bucket_name?: string
          caricato_da?: string | null
          caricato_da_cliente?: boolean
          categoria?: string | null
          created_at?: string | null
          entita_id?: string
          entita_tipo?: string
          id?: string
          nome_file?: string
          path_storage?: string
          visibile_al_cliente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "documenti_caricato_da_fkey"
            columns: ["caricato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documenti_utenti: {
        Row: {
          categoria: string
          created_at: string | null
          id: string
          nome_file: string
          note: string | null
          path_storage: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          id?: string
          nome_file: string
          note?: string | null
          path_storage: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          id?: string
          nome_file?: string
          note?: string | null
          path_storage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documenti_utenti_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_agenzia_archivio: {
        Row: {
          compagnia_id: string
          created_at: string
          data_estratto_conto: string | null
          documento_id: string
          id: string
          periodo_testo: string | null
          riferimento: string
          righe: Json
          testo_ricerca: string
        }
        Insert: {
          compagnia_id: string
          created_at?: string
          data_estratto_conto?: string | null
          documento_id: string
          id?: string
          periodo_testo?: string | null
          riferimento: string
          righe?: Json
          testo_ricerca?: string
        }
        Update: {
          compagnia_id?: string
          created_at?: string
          data_estratto_conto?: string | null
          documento_id?: string
          id?: string
          periodo_testo?: string | null
          riferimento?: string
          righe?: Json
          testo_ricerca?: string
        }
        Relationships: [
          {
            foreignKeyName: "ec_agenzia_archivio_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ec_agenzia_archivio_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "documenti"
            referencedColumns: ["id"]
          },
        ]
      }
      ec_progressivi: {
        Row: {
          anno_mese: string
          created_at: string
          entita_id: string
          id: string
          tipo: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          anno_mese: string
          created_at?: string
          entita_id: string
          id?: string
          tipo: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          anno_mese?: string
          created_at?: string
          entita_id?: string
          id?: string
          tipo?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      elab_annuali: {
        Row: {
          anno: number
          created_at: string | null
          eseguita_da: string | null
          id: string
          risultato_json: Json | null
          stato: string | null
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          anno: number
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          risultato_json?: Json | null
          stato?: string | null
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          anno?: number
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          risultato_json?: Json | null
          stato?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elab_annuali_eseguita_da_fkey"
            columns: ["eseguita_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elab_annuali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      elaborazioni: {
        Row: {
          campi_estratti: Json
          cliente_id: string | null
          contenuto: string | null
          created_at: string
          created_by: string | null
          documento_id: string | null
          gruppo_ramo_id: string | null
          id: string
          stato: string
          template_id: string | null
          titolo: string | null
          titolo_id: string | null
          ufficio_id: string | null
          updated_at: string
        }
        Insert: {
          campi_estratti?: Json
          cliente_id?: string | null
          contenuto?: string | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          stato?: string
          template_id?: string | null
          titolo?: string | null
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string
        }
        Update: {
          campi_estratti?: Json
          cliente_id?: string | null
          contenuto?: string | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          stato?: string
          template_id?: string | null
          titolo?: string | null
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elaborazioni_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "elaborazioni_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "elaborazioni_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      elaborazioni_campi_catalogo: {
        Row: {
          attivo: boolean
          chiave: string
          created_at: string
          descrizione_ai: string | null
          etichetta: string
          gruppo_ramo_id: string | null
          id: string
          ordine: number
          tipo: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          chiave: string
          created_at?: string
          descrizione_ai?: string | null
          etichetta: string
          gruppo_ramo_id?: string | null
          id?: string
          ordine?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          chiave?: string
          created_at?: string
          descrizione_ai?: string | null
          etichetta?: string
          gruppo_ramo_id?: string | null
          id?: string
          ordine?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elaborazioni_campi_catalogo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_campi_catalogo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
        ]
      }
      elaborazioni_periodiche: {
        Row: {
          created_at: string | null
          eseguita_da: string | null
          id: string
          periodo_a: string | null
          periodo_da: string | null
          risultato_json: Json | null
          stato: string | null
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          periodo_a?: string | null
          periodo_da?: string | null
          risultato_json?: Json | null
          stato?: string | null
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          periodo_a?: string | null
          periodo_da?: string | null
          risultato_json?: Json | null
          stato?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elaborazioni_periodiche_eseguita_da_fkey"
            columns: ["eseguita_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_periodiche_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      elaborazioni_template: {
        Row: {
          attivo: boolean
          campi: Json
          corpo: string
          created_at: string
          created_by: string | null
          descrizione: string | null
          gruppo_ramo_id: string | null
          id: string
          nome: string
          ufficio_id: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          campi?: Json
          corpo?: string
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          nome: string
          ufficio_id?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          campi?: Json
          corpo?: string
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          nome?: string
          ufficio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elaborazioni_template_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_template_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "elaborazioni_template_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      email_branding: {
        Row: {
          colore_primario: string
          created_at: string
          firma_html: string | null
          id: string
          intestazione_html: string | null
          logo_url: string | null
          mittente_default: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          colore_primario?: string
          created_at?: string
          firma_html?: string | null
          id?: string
          intestazione_html?: string | null
          logo_url?: string | null
          mittente_default?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          colore_primario?: string
          created_at?: string
          firma_html?: string | null
          id?: string
          intestazione_html?: string | null
          logo_url?: string | null
          mittente_default?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      estratti_conto: {
        Row: {
          created_at: string | null
          data_operazione: string
          descrizione: string | null
          documento_id: string | null
          hash_riga: string | null
          id: string
          importo: number
          saldo: number | null
          stato: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_operazione?: string
          descrizione?: string | null
          documento_id?: string | null
          hash_riga?: string | null
          id?: string
          importo: number
          saldo?: number | null
          stato?: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_operazione?: string
          descrizione?: string | null
          documento_id?: string | null
          hash_riga?: string | null
          id?: string
          importo?: number
          saldo?: number | null
          stato?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estratti_conto_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "banca_documenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estratti_conto_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      fattori_regolazione: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      filiali: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      flussi_compagnia: {
        Row: {
          api_endpoint: string | null
          api_response: string | null
          compagnia_id: string | null
          created_at: string
          created_by: string | null
          formato: string
          id: string
          payload_output: string | null
          periodo: string
          stato: string
          tipo_flusso: string
          ufficio_id: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string
          id?: string
          payload_output?: string | null
          periodo: string
          stato?: string
          tipo_flusso?: string
          ufficio_id?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string
          id?: string
          payload_output?: string | null
          periodo?: string
          stato?: string
          tipo_flusso?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flussi_compagnia_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flussi_compagnia_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flussi_compagnia_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori: {
        Row: {
          anagrafica_professionale_id: string | null
          attivo: boolean | null
          cap: string | null
          codice: string | null
          codice_fiscale: string | null
          created_at: string | null
          email: string | null
          id: string
          indirizzo: string | null
          localita: string | null
          nazione: string | null
          nome: string
          partita_iva: string | null
          pec: string | null
          provincia: string | null
          stato_cliente: boolean | null
          stato_fornitore: boolean | null
          stato_soggetto: boolean | null
          ufficio_id: string | null
          ultima_fattura: string | null
          updated_at: string | null
        }
        Insert: {
          anagrafica_professionale_id?: string | null
          attivo?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          localita?: string | null
          nazione?: string | null
          nome: string
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          stato_cliente?: boolean | null
          stato_fornitore?: boolean | null
          stato_soggetto?: boolean | null
          ufficio_id?: string | null
          ultima_fattura?: string | null
          updated_at?: string | null
        }
        Update: {
          anagrafica_professionale_id?: string | null
          attivo?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          localita?: string | null
          nazione?: string | null
          nome?: string
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          stato_cliente?: boolean | null
          stato_fornitore?: boolean | null
          stato_soggetto?: boolean | null
          ufficio_id?: string | null
          ultima_fattura?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornitori_anagrafica_professionale_id_fkey"
            columns: ["anagrafica_professionale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornitori_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      garanzie_chat_conversazioni: {
        Row: {
          autore_email: string | null
          compagnia: string | null
          condivisa: boolean
          condivisa_at: string | null
          created_at: string
          id: string
          in_evidenza: boolean
          in_evidenza_at: string | null
          prodotto_cga_id: string | null
          ramo: string | null
          tags: string[] | null
          tipo: string
          titolo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          autore_email?: string | null
          compagnia?: string | null
          condivisa?: boolean
          condivisa_at?: string | null
          created_at?: string
          id?: string
          in_evidenza?: boolean
          in_evidenza_at?: string | null
          prodotto_cga_id?: string | null
          ramo?: string | null
          tags?: string[] | null
          tipo?: string
          titolo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          autore_email?: string | null
          compagnia?: string | null
          condivisa?: boolean
          condivisa_at?: string | null
          created_at?: string
          id?: string
          in_evidenza?: boolean
          in_evidenza_at?: string | null
          prodotto_cga_id?: string | null
          ramo?: string | null
          tags?: string[] | null
          tipo?: string
          titolo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garanzie_chat_conversazioni_prodotto_cga_id_fkey"
            columns: ["prodotto_cga_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      garanzie_chat_messaggi: {
        Row: {
          content: string
          conversazione_id: string
          created_at: string
          fonti: Json | null
          id: string
          role: string
        }
        Insert: {
          content?: string
          conversazione_id: string
          created_at?: string
          fonti?: Json | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversazione_id?: string
          created_at?: string
          fonti?: Json | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "garanzie_chat_messaggi_conversazione_id_fkey"
            columns: ["conversazione_id"]
            isOneToOne: false
            referencedRelation: "garanzie_chat_conversazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      giroconti_cliente: {
        Row: {
          anticipo_id: string | null
          cliente_beneficiario_id: string
          cliente_pagatore_id: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          importo: number
          note: string | null
          titolo_id: string
        }
        Insert: {
          anticipo_id?: string | null
          cliente_beneficiario_id: string
          cliente_pagatore_id: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          importo: number
          note?: string | null
          titolo_id: string
        }
        Update: {
          anticipo_id?: string | null
          cliente_beneficiario_id?: string
          cliente_pagatore_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          importo?: number
          note?: string | null
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giroconti_cliente_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "cliente_anticipi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giroconti_cliente_cliente_beneficiario_id_fkey"
            columns: ["cliente_beneficiario_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giroconti_cliente_cliente_pagatore_id_fkey"
            columns: ["cliente_pagatore_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giroconti_cliente_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giroconti_cliente_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      gruppi_compagnia: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      gruppi_finanziari: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          nome: string
          tipo_soggetto: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          nome?: string
          tipo_soggetto?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          nome?: string
          tipo_soggetto?: string
        }
        Relationships: []
      }
      gruppi_ramo: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      gruppi_statistici: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      impostazioni_sistema: {
        Row: {
          chiave: string
          descrizione: string | null
          id: string
          updated_at: string
          valore_json: Json
        }
        Insert: {
          chiave: string
          descrizione?: string | null
          id?: string
          updated_at?: string
          valore_json?: Json
        }
        Update: {
          chiave?: string
          descrizione?: string | null
          id?: string
          updated_at?: string
          valore_json?: Json
        }
        Relationships: []
      }
      impostazioni_ufficio: {
        Row: {
          chiave: string
          id: string
          ufficio_id: string
          updated_at: string
          valore_json: Json
        }
        Insert: {
          chiave: string
          id?: string
          ufficio_id: string
          updated_at?: string
          valore_json?: Json
        }
        Update: {
          chiave?: string
          id?: string
          ufficio_id?: string
          updated_at?: string
          valore_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "impostazioni_ufficio_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      incroci_bancari: {
        Row: {
          created_at: string | null
          differenza: number | null
          esito: string
          estratto_id: string | null
          id: string
          matching_metodo: string | null
          matching_score: number | null
          movimento_id: string | null
          note: string | null
          verificato: boolean | null
        }
        Insert: {
          created_at?: string | null
          differenza?: number | null
          esito: string
          estratto_id?: string | null
          id?: string
          matching_metodo?: string | null
          matching_score?: number | null
          movimento_id?: string | null
          note?: string | null
          verificato?: boolean | null
        }
        Update: {
          created_at?: string | null
          differenza?: number | null
          esito?: string
          estratto_id?: string | null
          id?: string
          matching_metodo?: string | null
          matching_score?: number | null
          movimento_id?: string | null
          note?: string | null
          verificato?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "incroci_bancari_estratto_id_fkey"
            columns: ["estratto_id"]
            isOneToOne: false
            referencedRelation: "estratti_conto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incroci_bancari_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti_contabili"
            referencedColumns: ["id"]
          },
        ]
      }
      iva_registri: {
        Row: {
          created_at: string
          id: string
          imponibile: number
          iva: number
          note: string | null
          periodo: string
          totale: number
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          periodo: string
          totale?: number
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          periodo?: string
          totale?: number
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iva_registri_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_matricola_mezzi: {
        Row: {
          created_at: string
          data_esclusione: string | null
          data_immatricolazione: string | null
          data_inclusione: string | null
          descrizione: string | null
          id: string
          n_progressivo: number | null
          note: string | null
          targa: string | null
          tipologia: string | null
          titolo_id: string
          updated_at: string
          uso: string | null
          uso_id: string | null
        }
        Insert: {
          created_at?: string
          data_esclusione?: string | null
          data_immatricolazione?: string | null
          data_inclusione?: string | null
          descrizione?: string | null
          id?: string
          n_progressivo?: number | null
          note?: string | null
          targa?: string | null
          tipologia?: string | null
          titolo_id: string
          updated_at?: string
          uso?: string | null
          uso_id?: string | null
        }
        Update: {
          created_at?: string
          data_esclusione?: string | null
          data_immatricolazione?: string | null
          data_inclusione?: string | null
          descrizione?: string | null
          id?: string
          n_progressivo?: number | null
          note?: string | null
          targa?: string | null
          tipologia?: string | null
          titolo_id?: string
          updated_at?: string
          uso?: string | null
          uso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "libro_matricola_mezzi_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_matricola_mezzi_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_matricola_mezzi_uso_id_fkey"
            columns: ["uso_id"]
            isOneToOne: false
            referencedRelation: "rca_usi"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_matricola_operazioni: {
        Row: {
          created_at: string
          created_by: string | null
          data_evento: string | null
          id: string
          mezzo_id: string | null
          n_operazione: number
          note: string | null
          targa: string | null
          tipo: string
          titolo_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_evento?: string | null
          id?: string
          mezzo_id?: string | null
          n_operazione: number
          note?: string | null
          targa?: string | null
          tipo: string
          titolo_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_evento?: string | null
          id?: string
          mezzo_id?: string | null
          n_operazione?: number
          note?: string | null
          targa?: string | null
          tipo?: string
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_matricola_operazioni_mezzo_id_fkey"
            columns: ["mezzo_id"]
            isOneToOne: false
            referencedRelation: "libro_matricola_mezzi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_matricola_operazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_matricola_operazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      log_attivita: {
        Row: {
          azione: string | null
          created_at: string | null
          dettagli_json: Json | null
          entita_id: string | null
          entita_tipo: string | null
          id: string
          is_duplicate: boolean
          severity: string
          ufficio_id: string | null
          user_id: string | null
        }
        Insert: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          is_duplicate?: boolean
          severity?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Update: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          is_duplicate?: boolean
          severity?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_attivita_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_attivita_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_attivita_archivio: {
        Row: {
          archiviato_il: string | null
          azione: string | null
          created_at: string | null
          dettagli_json: Json | null
          entita_id: string | null
          entita_tipo: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          archiviato_il?: string | null
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          archiviato_il?: string | null
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lookup_attivita: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_conti_incasso: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_contratti: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_fasce_dipendenti: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          ordine: number
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          ordine?: number
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          ordine?: number
        }
        Relationships: []
      }
      lookup_fasce_fatturato: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          ordine: number
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          ordine?: number
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          ordine?: number
        }
        Relationships: []
      }
      lookup_indotti: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_risk_type: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_settori: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_tipo_documento: {
        Row: {
          attivo: boolean
          box_firma_1: string | null
          box_firma_2: string | null
          box_firma_3: string | null
          box_firma_4: string | null
          clausole_particolari: string | null
          clienti: boolean | null
          codice: string
          compagnie: boolean | null
          contrattuali: boolean | null
          created_at: string | null
          descrizione: string
          firma: string | null
          firma_avanzata: string | null
          id: string
          polizze: boolean | null
          pos_clausole: string | null
          prod: boolean | null
          smart_anchors: string | null
          trattative: boolean | null
          visibile: boolean | null
        }
        Insert: {
          attivo?: boolean
          box_firma_1?: string | null
          box_firma_2?: string | null
          box_firma_3?: string | null
          box_firma_4?: string | null
          clausole_particolari?: string | null
          clienti?: boolean | null
          codice: string
          compagnie?: boolean | null
          contrattuali?: boolean | null
          created_at?: string | null
          descrizione: string
          firma?: string | null
          firma_avanzata?: string | null
          id?: string
          polizze?: boolean | null
          pos_clausole?: string | null
          prod?: boolean | null
          smart_anchors?: string | null
          trattative?: boolean | null
          visibile?: boolean | null
        }
        Update: {
          attivo?: boolean
          box_firma_1?: string | null
          box_firma_2?: string | null
          box_firma_3?: string | null
          box_firma_4?: string | null
          clausole_particolari?: string | null
          clienti?: boolean | null
          codice?: string
          compagnie?: boolean | null
          contrattuali?: boolean | null
          created_at?: string | null
          descrizione?: string
          firma?: string | null
          firma_avanzata?: string | null
          id?: string
          polizze?: boolean | null
          pos_clausole?: string | null
          prod?: boolean | null
          smart_anchors?: string | null
          trattative?: boolean | null
          visibile?: boolean | null
        }
        Relationships: []
      }
      lookup_tipologia_veicolo: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      lookup_zone: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      matrice_provvigioni: {
        Row: {
          attiva: boolean | null
          created_at: string | null
          id: string
          percentuale_provvigione: number
          prodotto_id: string
          ruolo: string | null
          tipo_calcolo: string
          ufficio_id: string | null
          user_id: string | null
        }
        Insert: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          percentuale_provvigione: number
          prodotto_id: string
          ruolo?: string | null
          tipo_calcolo?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Update: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          percentuale_provvigione?: number
          prodotto_id?: string
          ruolo?: string | null
          tipo_calcolo?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matrice_provvigioni_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrice_provvigioni_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrice_provvigioni_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_bancari: {
        Row: {
          caricato_da: string | null
          carico_id: string | null
          cliente_id: string | null
          conto_bancario_id: string | null
          created_at: string
          data_movimento: string
          descrizione: string | null
          id: string
          importo: number
          note: string | null
          ordinante: string | null
          stato: Database["public"]["Enums"]["movimento_bancario_stato"]
          ufficio_id: string | null
          updated_at: string
        }
        Insert: {
          caricato_da?: string | null
          carico_id?: string | null
          cliente_id?: string | null
          conto_bancario_id?: string | null
          created_at?: string
          data_movimento: string
          descrizione?: string | null
          id?: string
          importo: number
          note?: string | null
          ordinante?: string | null
          stato?: Database["public"]["Enums"]["movimento_bancario_stato"]
          ufficio_id?: string | null
          updated_at?: string
        }
        Update: {
          caricato_da?: string | null
          carico_id?: string | null
          cliente_id?: string | null
          conto_bancario_id?: string | null
          created_at?: string
          data_movimento?: string
          descrizione?: string | null
          id?: string
          importo?: number
          note?: string | null
          ordinante?: string | null
          stato?: Database["public"]["Enums"]["movimento_bancario_stato"]
          ufficio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_bancari_carico_id_fkey"
            columns: ["carico_id"]
            isOneToOne: false
            referencedRelation: "movimenti_bancari_carichi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_bancari_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_bancari_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_bancari_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_bancari_carichi: {
        Row: {
          caricato_da: string | null
          conto_bancario_id: string | null
          created_at: string
          id: string
          nome_file: string
          note: string | null
          righe_duplicati: number
          righe_file: number
          righe_inserite: number
          righe_scartate: number
          righe_senza_cliente: number
        }
        Insert: {
          caricato_da?: string | null
          conto_bancario_id?: string | null
          created_at?: string
          id?: string
          nome_file: string
          note?: string | null
          righe_duplicati?: number
          righe_file?: number
          righe_inserite?: number
          righe_scartate?: number
          righe_senza_cliente?: number
        }
        Update: {
          caricato_da?: string | null
          conto_bancario_id?: string | null
          created_at?: string
          id?: string
          nome_file?: string
          note?: string | null
          righe_duplicati?: number
          righe_file?: number
          righe_inserite?: number
          righe_scartate?: number
          righe_senza_cliente?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_bancari_carichi_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_bancari_carichi_scarti: {
        Row: {
          carico_id: string
          created_at: string
          data_movimento: string | null
          descrizione: string | null
          id: string
          importo: number | null
          motivo: string
          ordinante: string | null
          raw_json: Json | null
          riga_excel: number | null
        }
        Insert: {
          carico_id: string
          created_at?: string
          data_movimento?: string | null
          descrizione?: string | null
          id?: string
          importo?: number | null
          motivo: string
          ordinante?: string | null
          raw_json?: Json | null
          riga_excel?: number | null
        }
        Update: {
          carico_id?: string
          created_at?: string
          data_movimento?: string | null
          descrizione?: string | null
          id?: string
          importo?: number | null
          motivo?: string
          ordinante?: string | null
          raw_json?: Json | null
          riga_excel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_bancari_carichi_scarti_carico_id_fkey"
            columns: ["carico_id"]
            isOneToOne: false
            referencedRelation: "movimenti_bancari_carichi"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_clienti: {
        Row: {
          ammanco: number
          anticipo: number
          cliente_id: string
          created_at: string
          id: string
          importo_assegnato: number
          movimento_id: string
          note: string | null
          ufficio_id: string | null
        }
        Insert: {
          ammanco?: number
          anticipo?: number
          cliente_id: string
          created_at?: string
          id?: string
          importo_assegnato: number
          movimento_id: string
          note?: string | null
          ufficio_id?: string | null
        }
        Update: {
          ammanco?: number
          anticipo?: number
          cliente_id?: string
          created_at?: string
          id?: string
          importo_assegnato?: number
          movimento_id?: string
          note?: string | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_clienti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_clienti_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_clienti_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_contabili: {
        Row: {
          categoria: string | null
          created_at: string | null
          created_by: string | null
          data_movimento: string
          descrizione: string | null
          id: string
          importo: number
          iva_aliquota: number | null
          iva_imponibile: number | null
          iva_importo: number | null
          riferimento_id: string | null
          riferimento_tipo: string | null
          stato: string
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_movimento?: string
          descrizione?: string | null
          id?: string
          importo: number
          iva_aliquota?: number | null
          iva_imponibile?: number | null
          iva_importo?: number | null
          riferimento_id?: string | null
          riferimento_tipo?: string | null
          stato?: string
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_movimento?: string
          descrizione?: string | null
          id?: string
          importo?: number
          iva_aliquota?: number | null
          iva_imponibile?: number | null
          iva_importo?: number | null
          riferimento_id?: string | null
          riferimento_tipo?: string | null
          stato?: string
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_contabili_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_contabili_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_polizza: {
        Row: {
          appendice: string | null
          created_at: string | null
          data_copertura: string | null
          data_effetto: string | null
          data_incasso: string | null
          data_movimento: string | null
          data_rinnovo: string | null
          data_scadenza: string | null
          descrizione: string | null
          id: string
          incassato: boolean | null
          premio: number | null
          premio_netto: number | null
          provvigioni: number | null
          provvigioni_attive: number | null
          provvigioni_passive: number | null
          riga: number | null
          sostituisce_id: string | null
          sostituito_da_id: string | null
          stato: string | null
          stato_incasso: string | null
          tacito_rinnovo: boolean
          tasse: number | null
          tipo: string | null
          tipo_documento: string | null
          tipo_rinnovo: string | null
          titolo_id: string
          ufficio_id: string | null
          updated_at: string | null
          valuta: string | null
        }
        Insert: {
          appendice?: string | null
          created_at?: string | null
          data_copertura?: string | null
          data_effetto?: string | null
          data_incasso?: string | null
          data_movimento?: string | null
          data_rinnovo?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          id?: string
          incassato?: boolean | null
          premio?: number | null
          premio_netto?: number | null
          provvigioni?: number | null
          provvigioni_attive?: number | null
          provvigioni_passive?: number | null
          riga?: number | null
          sostituisce_id?: string | null
          sostituito_da_id?: string | null
          stato?: string | null
          stato_incasso?: string | null
          tacito_rinnovo?: boolean
          tasse?: number | null
          tipo?: string | null
          tipo_documento?: string | null
          tipo_rinnovo?: string | null
          titolo_id: string
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
        }
        Update: {
          appendice?: string | null
          created_at?: string | null
          data_copertura?: string | null
          data_effetto?: string | null
          data_incasso?: string | null
          data_movimento?: string | null
          data_rinnovo?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          id?: string
          incassato?: boolean | null
          premio?: number | null
          premio_netto?: number | null
          provvigioni?: number | null
          provvigioni_attive?: number | null
          provvigioni_passive?: number | null
          riga?: number | null
          sostituisce_id?: string | null
          sostituito_da_id?: string | null
          stato?: string | null
          stato_incasso?: string | null
          tacito_rinnovo?: boolean
          tasse?: number | null
          tipo?: string | null
          tipo_documento?: string | null
          tipo_rinnovo?: string | null
          titolo_id?: string
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_polizza_sostituisce_id_fkey"
            columns: ["sostituisce_id"]
            isOneToOne: false
            referencedRelation: "movimenti_polizza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizza_sostituito_da_id_fkey"
            columns: ["sostituito_da_id"]
            isOneToOne: false
            referencedRelation: "movimenti_polizza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizza_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti_polizze: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_messa_cassa: string | null
          id: string
          importo: number
          messo_a_cassa: boolean
          movimento_cliente_id: string
          pagato_da: string | null
          tipo: Database["public"]["Enums"]["movimento_polizza_tipo"]
          titolo_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_messa_cassa?: string | null
          id?: string
          importo: number
          messo_a_cassa?: boolean
          movimento_cliente_id: string
          pagato_da?: string | null
          tipo?: Database["public"]["Enums"]["movimento_polizza_tipo"]
          titolo_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_messa_cassa?: string | null
          id?: string
          importo?: number
          messo_a_cassa?: boolean
          movimento_cliente_id?: string
          pagato_da?: string | null
          tipo?: Database["public"]["Enums"]["movimento_polizza_tipo"]
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_polizze_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizze_movimento_cliente_id_fkey"
            columns: ["movimento_cliente_id"]
            isOneToOne: false
            referencedRelation: "movimenti_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizze_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_polizze_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      nominativi_cliente: {
        Row: {
          cliente_id: string
          cognome: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          note: string | null
          ruolo: string | null
          telefono: string | null
        }
        Insert: {
          cliente_id: string
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          note?: string | null
          ruolo?: string | null
          telefono?: string | null
        }
        Update: {
          cliente_id?: string
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          note?: string | null
          ruolo?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nominativi_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      note_restituzione: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          created_by: string | null
          flag_json: Json | null
          id: string
          note: string | null
          stato: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          flag_json?: Json | null
          id?: string
          note?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          flag_json?: Json | null
          id?: string
          note?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_restituzione_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      note_restituzione_dettaglio: {
        Row: {
          created_at: string | null
          id: string
          nota_id: string
          prodotto_id: string | null
          quietanza_id: string | null
          titolo_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nota_id: string
          prodotto_id?: string | null
          quietanza_id?: string | null
          titolo_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nota_id?: string
          prodotto_id?: string | null
          quietanza_id?: string | null
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_restituzione_dettaglio_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "note_restituzione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "quietanze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["quietanza_id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      notifiche: {
        Row: {
          created_at: string
          destinatario_id: string
          entita_id: string | null
          entita_tipo: string | null
          id: string
          letto: boolean
          messaggio: string
          priorita: string
          tipo: string
          titolo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          letto?: boolean
          messaggio: string
          priorita?: string
          tipo: string
          titolo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          letto?: boolean
          messaggio?: string
          priorita?: string
          tipo?: string
          titolo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamenti_provvigioni: {
        Row: {
          created_at: string
          creato_da: string
          id: string
          metodo: string
          note: string | null
          pagato_a_user_id: string
          periodo_a: string
          periodo_da: string
          riferimento: string | null
          totale_importo: number
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          creato_da: string
          id?: string
          metodo?: string
          note?: string | null
          pagato_a_user_id: string
          periodo_a: string
          periodo_da: string
          riferimento?: string | null
          totale_importo?: number
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          creato_da?: string
          id?: string
          metodo?: string
          note?: string | null
          pagato_a_user_id?: string
          periodo_a?: string
          periodo_da?: string
          riferimento?: string | null
          totale_importo?: number
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamenti_provvigioni_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_pagato_a_user_id_fkey"
            columns: ["pagato_a_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamenti_provvigioni_righe: {
        Row: {
          created_at: string
          id: string
          importo: number
          pagamento_id: string
          provvigione_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          importo?: number
          pagamento_id: string
          provvigione_id: string
        }
        Update: {
          created_at?: string
          id?: string
          importo?: number
          pagamento_id?: string
          provvigione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamenti_provvigioni_righe_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamenti_provvigioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_righe_provvigione_id_fkey"
            columns: ["provvigione_id"]
            isOneToOne: false
            referencedRelation: "provvigioni_generate"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_log: {
        Row: {
          created_at: string
          dettagli_json: Json | null
          durata_ms: number
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dettagli_json?: Json | null
          durata_ms: number
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          dettagli_json?: Json | null
          durata_ms?: number
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      piano_conti_conti: {
        Row: {
          attivo: boolean | null
          bic: string | null
          cf_piva: string | null
          citta: string | null
          codice: string
          created_at: string | null
          data_sospensione: string | null
          descrizione: string
          flag_stato: boolean | null
          gestione_partite: boolean | null
          gestione_tesoreria: boolean | null
          gruppo_id: string
          iban: string | null
          id: string
          natura_segno: string
          natura_tipo: string
          sezione_bilancio_id: string | null
          tipo_sezionale: string | null
          updated_at: string | null
          voce_spesa: string | null
        }
        Insert: {
          attivo?: boolean | null
          bic?: string | null
          cf_piva?: string | null
          citta?: string | null
          codice: string
          created_at?: string | null
          data_sospensione?: string | null
          descrizione: string
          flag_stato?: boolean | null
          gestione_partite?: boolean | null
          gestione_tesoreria?: boolean | null
          gruppo_id: string
          iban?: string | null
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          tipo_sezionale?: string | null
          updated_at?: string | null
          voce_spesa?: string | null
        }
        Update: {
          attivo?: boolean | null
          bic?: string | null
          cf_piva?: string | null
          citta?: string | null
          codice?: string
          created_at?: string | null
          data_sospensione?: string | null
          descrizione?: string
          flag_stato?: boolean | null
          gestione_partite?: boolean | null
          gestione_tesoreria?: boolean | null
          gruppo_id?: string
          iban?: string | null
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          tipo_sezionale?: string | null
          updated_at?: string | null
          voce_spesa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piano_conti_conti_gruppo_id_fkey"
            columns: ["gruppo_id"]
            isOneToOne: false
            referencedRelation: "piano_conti_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piano_conti_conti_sezione_bilancio_id_fkey"
            columns: ["sezione_bilancio_id"]
            isOneToOne: false
            referencedRelation: "sezioni_bilancio"
            referencedColumns: ["id"]
          },
        ]
      }
      piano_conti_gruppi: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          natura_segno: string
          natura_tipo: string
          sezione_bilancio_id: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piano_conti_gruppi_sezione_bilancio_id_fkey"
            columns: ["sezione_bilancio_id"]
            isOneToOne: false
            referencedRelation: "sezioni_bilancio"
            referencedColumns: ["id"]
          },
        ]
      }
      polizza_cga: {
        Row: {
          approvato_at: string | null
          approvato_da: string | null
          assicurato_descrizione: string | null
          cig: string | null
          cliente_id: string
          contraente_cap: string | null
          contraente_cf: string | null
          contraente_comune: string | null
          contraente_email: string | null
          contraente_indirizzo: string | null
          contraente_piva: string | null
          contraente_provincia: string | null
          contraente_ragione_sociale: string | null
          created_at: string
          created_by: string | null
          cup: string | null
          data_decorrenza: string | null
          data_emissione: string | null
          data_scadenza: string | null
          documento_id: string | null
          frazionamento: string | null
          id: string
          intermediario_email: string | null
          intermediario_indirizzo: string | null
          intermediario_nome: string | null
          intermediario_telefono: string | null
          numero_polizza: string | null
          premio_imponibile_totale: number | null
          premio_imposte_totale: number | null
          premio_lordo_totale: number | null
          premio_rata_sottoscrizione_lordo: number | null
          premio_rate_successive_lordo: number | null
          prodotto_id: string
          sommario_personalizzato: string | null
          stato: string
          tacito_rinnovo: boolean | null
          titolo_id: string | null
          updated_at: string
        }
        Insert: {
          approvato_at?: string | null
          approvato_da?: string | null
          assicurato_descrizione?: string | null
          cig?: string | null
          cliente_id: string
          contraente_cap?: string | null
          contraente_cf?: string | null
          contraente_comune?: string | null
          contraente_email?: string | null
          contraente_indirizzo?: string | null
          contraente_piva?: string | null
          contraente_provincia?: string | null
          contraente_ragione_sociale?: string | null
          created_at?: string
          created_by?: string | null
          cup?: string | null
          data_decorrenza?: string | null
          data_emissione?: string | null
          data_scadenza?: string | null
          documento_id?: string | null
          frazionamento?: string | null
          id?: string
          intermediario_email?: string | null
          intermediario_indirizzo?: string | null
          intermediario_nome?: string | null
          intermediario_telefono?: string | null
          numero_polizza?: string | null
          premio_imponibile_totale?: number | null
          premio_imposte_totale?: number | null
          premio_lordo_totale?: number | null
          premio_rata_sottoscrizione_lordo?: number | null
          premio_rate_successive_lordo?: number | null
          prodotto_id: string
          sommario_personalizzato?: string | null
          stato?: string
          tacito_rinnovo?: boolean | null
          titolo_id?: string | null
          updated_at?: string
        }
        Update: {
          approvato_at?: string | null
          approvato_da?: string | null
          assicurato_descrizione?: string | null
          cig?: string | null
          cliente_id?: string
          contraente_cap?: string | null
          contraente_cf?: string | null
          contraente_comune?: string | null
          contraente_email?: string | null
          contraente_indirizzo?: string | null
          contraente_piva?: string | null
          contraente_provincia?: string | null
          contraente_ragione_sociale?: string | null
          created_at?: string
          created_by?: string | null
          cup?: string | null
          data_decorrenza?: string | null
          data_emissione?: string | null
          data_scadenza?: string | null
          documento_id?: string | null
          frazionamento?: string | null
          id?: string
          intermediario_email?: string | null
          intermediario_indirizzo?: string | null
          intermediario_nome?: string | null
          intermediario_telefono?: string | null
          numero_polizza?: string | null
          premio_imponibile_totale?: number | null
          premio_imposte_totale?: number | null
          premio_lordo_totale?: number | null
          premio_rata_sottoscrizione_lordo?: number | null
          premio_rate_successive_lordo?: number | null
          prodotto_id?: string
          sommario_personalizzato?: string | null
          stato?: string
          tacito_rinnovo?: boolean | null
          titolo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polizza_cga_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizza_cga_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizza_cga_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizza_cga_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizza_cga_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      polizza_cga_premio_garanzia: {
        Row: {
          created_at: string
          garanzia: string
          id: string
          imponibile: number | null
          imposte: number | null
          lordo: number | null
          polizza_cga_id: string
          tipo_rata: string
        }
        Insert: {
          created_at?: string
          garanzia: string
          id?: string
          imponibile?: number | null
          imposte?: number | null
          lordo?: number | null
          polizza_cga_id: string
          tipo_rata: string
        }
        Update: {
          created_at?: string
          garanzia?: string
          id?: string
          imponibile?: number | null
          imposte?: number | null
          lordo?: number | null
          polizza_cga_id?: string
          tipo_rata?: string
        }
        Relationships: [
          {
            foreignKeyName: "polizza_cga_premio_garanzia_polizza_cga_id_fkey"
            columns: ["polizza_cga_id"]
            isOneToOne: false
            referencedRelation: "polizza_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      polizza_garanzie_personali: {
        Row: {
          created_at: string
          franchigia_personalizzata: number | null
          id: string
          massimale_personalizzato: number | null
          note_personali: string | null
          polizza_cga_id: string
          prodotto_garanzia_id: string | null
          scoperto_personalizzato: number | null
        }
        Insert: {
          created_at?: string
          franchigia_personalizzata?: number | null
          id?: string
          massimale_personalizzato?: number | null
          note_personali?: string | null
          polizza_cga_id: string
          prodotto_garanzia_id?: string | null
          scoperto_personalizzato?: number | null
        }
        Update: {
          created_at?: string
          franchigia_personalizzata?: number | null
          id?: string
          massimale_personalizzato?: number | null
          note_personali?: string | null
          polizza_cga_id?: string
          prodotto_garanzia_id?: string | null
          scoperto_personalizzato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "polizza_garanzie_personali_polizza_cga_id_fkey"
            columns: ["polizza_cga_id"]
            isOneToOne: false
            referencedRelation: "polizza_cga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizza_garanzie_personali_prodotto_garanzia_id_fkey"
            columns: ["prodotto_garanzia_id"]
            isOneToOne: false
            referencedRelation: "prodotti_garanzie"
            referencedColumns: ["id"]
          },
        ]
      }
      polizze: {
        Row: {
          account_executive_anagrafica_id: string | null
          addizionali_annue: number | null
          anagrafica_commerciale_id: string | null
          anni_durata: number | null
          appendice_corrente: string | null
          cambio: number | null
          cig_rif: string | null
          cliente_anagrafica_id: string | null
          commerciale_id: string | null
          compagnia_id: string | null
          compagnia_rapporto_id: string | null
          created_at: string
          created_by: string | null
          data_annullamento: string | null
          data_riattivazione: string | null
          data_sospensione: string | null
          descrizione_polizza: string | null
          disdetta_giorni: number | null
          durata_a: string | null
          durata_da: string | null
          emissione_fee: boolean | null
          formato_elettronico: boolean | null
          frazionamento: string | null
          giorni_presentazione: number | null
          gruppo_ramo_id: string | null
          id: string
          indicizzata: boolean | null
          libro_matricola: string | null
          motivo_annullamento: string | null
          no_calcolo_tasse: boolean | null
          note: string | null
          numero_polizza: string | null
          numero_polizza_precedente: string | null
          pag_diretto_compagnia: boolean | null
          percentuale_commerciale: number | null
          percentuale_riparto: number | null
          premio_annuo_lordo: number | null
          premio_annuo_netto: number | null
          prodotto_nome: string | null
          produttore_anagrafica_id: string | null
          provvigioni_annue_firma: number | null
          provvigioni_annue_quietanza: number | null
          ramo_id: string | null
          regolazione: boolean | null
          risk_type: string | null
          search_vector: unknown
          sostituisce_polizza_id: string | null
          sostituita_da_polizza_id: string | null
          ssn_annuo: number | null
          stato: Database["public"]["Enums"]["polizza_stato"]
          tacito_rinnovo: boolean | null
          targa_telaio: string | null
          tasse_annue: number | null
          tipo_lettera_regolazione: string | null
          tipo_mandatario: string | null
          tipo_portafoglio: string | null
          tipo_scadenza: string | null
          titolo_madre_id: string | null
          ufficio_id: string | null
          updated_at: string
          valuta: string | null
          vincolo: string | null
        }
        Insert: {
          account_executive_anagrafica_id?: string | null
          addizionali_annue?: number | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice_corrente?: string | null
          cambio?: number | null
          cig_rif?: string | null
          cliente_anagrafica_id?: string | null
          commerciale_id?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string
          created_by?: string | null
          data_annullamento?: string | null
          data_riattivazione?: string | null
          data_sospensione?: string | null
          descrizione_polizza?: string | null
          disdetta_giorni?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          giorni_presentazione?: number | null
          gruppo_ramo_id?: string | null
          id?: string
          indicizzata?: boolean | null
          libro_matricola?: string | null
          motivo_annullamento?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_polizza?: string | null
          numero_polizza_precedente?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          premio_annuo_lordo?: number | null
          premio_annuo_netto?: number | null
          prodotto_nome?: string | null
          produttore_anagrafica_id?: string | null
          provvigioni_annue_firma?: number | null
          provvigioni_annue_quietanza?: number | null
          ramo_id?: string | null
          regolazione?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          sostituisce_polizza_id?: string | null
          sostituita_da_polizza_id?: string | null
          ssn_annuo?: number | null
          stato?: Database["public"]["Enums"]["polizza_stato"]
          tacito_rinnovo?: boolean | null
          targa_telaio?: string | null
          tasse_annue?: number | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_portafoglio?: string | null
          tipo_scadenza?: string | null
          titolo_madre_id?: string | null
          ufficio_id?: string | null
          updated_at?: string
          valuta?: string | null
          vincolo?: string | null
        }
        Update: {
          account_executive_anagrafica_id?: string | null
          addizionali_annue?: number | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice_corrente?: string | null
          cambio?: number | null
          cig_rif?: string | null
          cliente_anagrafica_id?: string | null
          commerciale_id?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string
          created_by?: string | null
          data_annullamento?: string | null
          data_riattivazione?: string | null
          data_sospensione?: string | null
          descrizione_polizza?: string | null
          disdetta_giorni?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          giorni_presentazione?: number | null
          gruppo_ramo_id?: string | null
          id?: string
          indicizzata?: boolean | null
          libro_matricola?: string | null
          motivo_annullamento?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_polizza?: string | null
          numero_polizza_precedente?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          premio_annuo_lordo?: number | null
          premio_annuo_netto?: number | null
          prodotto_nome?: string | null
          produttore_anagrafica_id?: string | null
          provvigioni_annue_firma?: number | null
          provvigioni_annue_quietanza?: number | null
          ramo_id?: string | null
          regolazione?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          sostituisce_polizza_id?: string | null
          sostituita_da_polizza_id?: string | null
          ssn_annuo?: number | null
          stato?: Database["public"]["Enums"]["polizza_stato"]
          tacito_rinnovo?: boolean | null
          targa_telaio?: string | null
          tasse_annue?: number | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_portafoglio?: string | null
          tipo_scadenza?: string | null
          titolo_madre_id?: string | null
          ufficio_id?: string | null
          updated_at?: string
          valuta?: string | null
          vincolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polizze_account_executive_anagrafica_id_fkey"
            columns: ["account_executive_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_compagnia_rapporto_id_fkey"
            columns: ["compagnia_rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "polizze_produttore_anagrafica_id_fkey"
            columns: ["produttore_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_sostituisce_polizza_id_fkey"
            columns: ["sostituisce_polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_sostituisce_polizza_id_fkey"
            columns: ["sostituisce_polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "polizze_sostituita_da_polizza_id_fkey"
            columns: ["sostituita_da_polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_sostituita_da_polizza_id_fkey"
            columns: ["sostituita_da_polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "polizze_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      portafoglio_incassi: {
        Row: {
          cliente_id: string | null
          created_at: string
          descrizione: string
          id: string
          importo_atteso: number
          periodicita: string
          prossima_scadenza: string
          stato: string
          ufficio_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descrizione: string
          id?: string
          importo_atteso?: number
          periodicita?: string
          prossima_scadenza: string
          stato?: string
          ufficio_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descrizione?: string
          id?: string
          importo_atteso?: number
          periodicita?: string
          prossima_scadenza?: string
          stato?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portafoglio_incassi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portafoglio_incassi_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      portafoglio_incassi_eventi: {
        Row: {
          created_at: string
          data_scadenza: string
          esito: string
          estratto_id: string | null
          id: string
          importo_atteso: number
          note: string | null
          portafoglio_id: string
        }
        Insert: {
          created_at?: string
          data_scadenza: string
          esito?: string
          estratto_id?: string | null
          id?: string
          importo_atteso?: number
          note?: string | null
          portafoglio_id: string
        }
        Update: {
          created_at?: string
          data_scadenza?: string
          esito?: string
          estratto_id?: string | null
          id?: string
          importo_atteso?: number
          note?: string | null
          portafoglio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portafoglio_incassi_eventi_estratto_id_fkey"
            columns: ["estratto_id"]
            isOneToOne: false
            referencedRelation: "estratti_conto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portafoglio_incassi_eventi_portafoglio_id_fkey"
            columns: ["portafoglio_id"]
            isOneToOne: false
            referencedRelation: "portafoglio_incassi"
            referencedColumns: ["id"]
          },
        ]
      }
      premi_garanzia_polizza: {
        Row: {
          accessori: number
          aliquota_tasse_pct: number | null
          annuo: number | null
          capitale: number | null
          codice_garanzia: string | null
          created_at: string | null
          firma: number | null
          garanzia: string
          id: string
          imposta_provinciale: number | null
          is_rca_principale: boolean
          lordo_calcolato: number | null
          ordine: number | null
          polizza_id: string | null
          provvigione_accessori_pct: number | null
          provvigione_accessori_pct_override: boolean
          provvigione_netto_pct: number | null
          provvigione_netto_pct_override: boolean
          quietanza_id: string | null
          quietanza_personalizzata: boolean
          rata: number | null
          ssn: number | null
          tasse_rettifica: number
          tasso: number | null
          tipo_premio: string
          titolo_id: string
          voce_origine_id: string | null
        }
        Insert: {
          accessori?: number
          aliquota_tasse_pct?: number | null
          annuo?: number | null
          capitale?: number | null
          codice_garanzia?: string | null
          created_at?: string | null
          firma?: number | null
          garanzia: string
          id?: string
          imposta_provinciale?: number | null
          is_rca_principale?: boolean
          lordo_calcolato?: number | null
          ordine?: number | null
          polizza_id?: string | null
          provvigione_accessori_pct?: number | null
          provvigione_accessori_pct_override?: boolean
          provvigione_netto_pct?: number | null
          provvigione_netto_pct_override?: boolean
          quietanza_id?: string | null
          quietanza_personalizzata?: boolean
          rata?: number | null
          ssn?: number | null
          tasse_rettifica?: number
          tasso?: number | null
          tipo_premio?: string
          titolo_id: string
          voce_origine_id?: string | null
        }
        Update: {
          accessori?: number
          aliquota_tasse_pct?: number | null
          annuo?: number | null
          capitale?: number | null
          codice_garanzia?: string | null
          created_at?: string | null
          firma?: number | null
          garanzia?: string
          id?: string
          imposta_provinciale?: number | null
          is_rca_principale?: boolean
          lordo_calcolato?: number | null
          ordine?: number | null
          polizza_id?: string | null
          provvigione_accessori_pct?: number | null
          provvigione_accessori_pct_override?: boolean
          provvigione_netto_pct?: number | null
          provvigione_netto_pct_override?: boolean
          quietanza_id?: string | null
          quietanza_personalizzata?: boolean
          rata?: number | null
          ssn?: number | null
          tasse_rettifica?: number
          tasso?: number | null
          tipo_premio?: string
          titolo_id?: string
          voce_origine_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premi_garanzia_polizza_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "quietanze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["quietanza_id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premi_garanzia_polizza_voce_origine_id_fkey"
            columns: ["voce_origine_id"]
            isOneToOne: false
            referencedRelation: "premi_garanzia_polizza"
            referencedColumns: ["id"]
          },
        ]
      }
      primanota_generale: {
        Row: {
          aliquota_ritenuta: number | null
          altri_importi: number | null
          causale_id: string | null
          created_at: string | null
          created_by: string | null
          data_documento: string | null
          data_pn: string | null
          data_protocollo: string | null
          descrizione: string | null
          fornitore_id: string | null
          id: string
          imponibile: number | null
          non_soggetto: number | null
          numero_documento: string | null
          numero_pn: string | null
          numero_protocollo: string | null
          ritenuta: number | null
          stato: string | null
          tipo: string | null
          totale: number | null
          ufficio_id: string | null
        }
        Insert: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          causale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          data_pn?: string | null
          data_protocollo?: string | null
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_pn?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Update: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          causale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          data_pn?: string | null
          data_protocollo?: string | null
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_pn?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "primanota_generale_causale_id_fkey"
            columns: ["causale_id"]
            isOneToOne: false
            referencedRelation: "causali_contabili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_consensi: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_consenso: string
          fonte: string | null
          id: string
          informativa_id: string | null
          stato: string
          tipo_consenso: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_consenso?: string
          fonte?: string | null
          id?: string
          informativa_id?: string | null
          stato: string
          tipo_consenso: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_consenso?: string
          fonte?: string | null
          id?: string
          informativa_id?: string | null
          stato?: string
          tipo_consenso?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_consensi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_consensi_informativa_id_fkey"
            columns: ["informativa_id"]
            isOneToOne: false
            referencedRelation: "privacy_informative"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_informative: {
        Row: {
          attiva: boolean | null
          contenuto: string | null
          created_at: string | null
          id: string
          titolo: string
          versione: string
        }
        Insert: {
          attiva?: boolean | null
          contenuto?: string | null
          created_at?: string | null
          id?: string
          titolo: string
          versione: string
        }
        Update: {
          attiva?: boolean | null
          contenuto?: string | null
          created_at?: string | null
          id?: string
          titolo?: string
          versione?: string
        }
        Relationships: []
      }
      prodotti: {
        Row: {
          attivo: boolean | null
          categoria_id: string | null
          codice_prodotto: string | null
          compagnia_id: string | null
          created_at: string | null
          id: string
          multititolo: boolean | null
          nome_prodotto: string
        }
        Insert: {
          attivo?: boolean | null
          categoria_id?: string | null
          codice_prodotto?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          id?: string
          multititolo?: boolean | null
          nome_prodotto: string
        }
        Update: {
          attivo?: boolean | null
          categoria_id?: string | null
          codice_prodotto?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          id?: string
          multititolo?: boolean | null
          nome_prodotto?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie_prodotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prodotti_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti_articoli: {
        Row: {
          created_at: string
          id: string
          numero: string | null
          ordine: number | null
          prodotto_id: string
          sezione: string | null
          testo: string
          titolo: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          numero?: string | null
          ordine?: number | null
          prodotto_id: string
          sezione?: string | null
          testo: string
          titolo?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          numero?: string | null
          ordine?: number | null
          prodotto_id?: string
          sezione?: string | null
          testo?: string
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_articoli_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti_cga: {
        Row: {
          ambito_territoriale: string | null
          clausola_broker: string | null
          codice_modello: string | null
          compagnia: string | null
          compagnia_email_servizio_clienti: string | null
          compagnia_gruppo_ivass: string | null
          compagnia_ivass_albo: string | null
          compagnia_pec: string | null
          compagnia_sede_legale: string | null
          compagnia_sede_operativa: string | null
          compagnia_telefono: string | null
          compagnia_url_area_personale: string | null
          created_at: string
          created_by: string | null
          diritto_recesso_descrizione: string | null
          edizione: string | null
          forma_copertura: string | null
          foro_competente: string | null
          id: string
          limiti_eta_assicurato_max: number | null
          limiti_eta_assicurato_min: number | null
          massimale_aggregato_annuo: number | null
          nome_prodotto: string
          note_legali: string | null
          oggetto_assicurazione: string | null
          periodo_retroattivita_mesi: number | null
          ramo: string | null
          regime_fiscale: string | null
          sommario_ai: string | null
          termine_prescrizione_mesi: number | null
          termini_pagamento_premio_giorni: number | null
          testo_completo: string | null
          updated_at: string
        }
        Insert: {
          ambito_territoriale?: string | null
          clausola_broker?: string | null
          codice_modello?: string | null
          compagnia?: string | null
          compagnia_email_servizio_clienti?: string | null
          compagnia_gruppo_ivass?: string | null
          compagnia_ivass_albo?: string | null
          compagnia_pec?: string | null
          compagnia_sede_legale?: string | null
          compagnia_sede_operativa?: string | null
          compagnia_telefono?: string | null
          compagnia_url_area_personale?: string | null
          created_at?: string
          created_by?: string | null
          diritto_recesso_descrizione?: string | null
          edizione?: string | null
          forma_copertura?: string | null
          foro_competente?: string | null
          id?: string
          limiti_eta_assicurato_max?: number | null
          limiti_eta_assicurato_min?: number | null
          massimale_aggregato_annuo?: number | null
          nome_prodotto: string
          note_legali?: string | null
          oggetto_assicurazione?: string | null
          periodo_retroattivita_mesi?: number | null
          ramo?: string | null
          regime_fiscale?: string | null
          sommario_ai?: string | null
          termine_prescrizione_mesi?: number | null
          termini_pagamento_premio_giorni?: number | null
          testo_completo?: string | null
          updated_at?: string
        }
        Update: {
          ambito_territoriale?: string | null
          clausola_broker?: string | null
          codice_modello?: string | null
          compagnia?: string | null
          compagnia_email_servizio_clienti?: string | null
          compagnia_gruppo_ivass?: string | null
          compagnia_ivass_albo?: string | null
          compagnia_pec?: string | null
          compagnia_sede_legale?: string | null
          compagnia_sede_operativa?: string | null
          compagnia_telefono?: string | null
          compagnia_url_area_personale?: string | null
          created_at?: string
          created_by?: string | null
          diritto_recesso_descrizione?: string | null
          edizione?: string | null
          forma_copertura?: string | null
          foro_competente?: string | null
          id?: string
          limiti_eta_assicurato_max?: number | null
          limiti_eta_assicurato_min?: number | null
          massimale_aggregato_annuo?: number | null
          nome_prodotto?: string
          note_legali?: string | null
          oggetto_assicurazione?: string | null
          periodo_retroattivita_mesi?: number | null
          ramo?: string | null
          regime_fiscale?: string | null
          sommario_ai?: string | null
          termine_prescrizione_mesi?: number | null
          termini_pagamento_premio_giorni?: number | null
          testo_completo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prodotti_condizioni: {
        Row: {
          created_at: string
          id: string
          prodotto_id: string
          rilevante_sinistri: boolean
          testo: string
          tipo: string
          titolo: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prodotto_id: string
          rilevante_sinistri?: boolean
          testo: string
          tipo: string
          titolo?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prodotto_id?: string
          rilevante_sinistri?: boolean
          testo?: string
          tipo?: string
          titolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_condizioni_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti_definizioni: {
        Row: {
          created_at: string
          definizione: string
          id: string
          prodotto_id: string
          termine: string
        }
        Insert: {
          created_at?: string
          definizione: string
          id?: string
          prodotto_id: string
          termine: string
        }
        Update: {
          created_at?: string
          definizione?: string
          id?: string
          prodotto_id?: string
          termine?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_definizioni_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti_garanzie: {
        Row: {
          aggregato_annuo: number | null
          ambito_territoriale: string | null
          created_at: string
          franchigia_standard: number | null
          franchigia_temporale_giorni: number | null
          garanzia: string
          id: string
          massimale_standard: number | null
          note: string | null
          prodotto_id: string
          scoperto_percentuale: number | null
          sottolimite: number | null
        }
        Insert: {
          aggregato_annuo?: number | null
          ambito_territoriale?: string | null
          created_at?: string
          franchigia_standard?: number | null
          franchigia_temporale_giorni?: number | null
          garanzia: string
          id?: string
          massimale_standard?: number | null
          note?: string | null
          prodotto_id: string
          scoperto_percentuale?: number | null
          sottolimite?: number | null
        }
        Update: {
          aggregato_annuo?: number | null
          ambito_territoriale?: string | null
          created_at?: string
          franchigia_standard?: number | null
          franchigia_temporale_giorni?: number | null
          garanzia?: string
          id?: string
          massimale_standard?: number | null
          note?: string | null
          prodotto_id?: string
          scoperto_percentuale?: number | null
          sottolimite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_garanzie_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti_riferimenti_normativi: {
        Row: {
          contesto: string | null
          created_at: string
          id: string
          prodotto_id: string
          riferimento: string
        }
        Insert: {
          contesto?: string | null
          created_at?: string
          id?: string
          prodotto_id: string
          riferimento: string
        }
        Update: {
          contesto?: string | null
          created_at?: string
          id?: string
          prodotto_id?: string
          riferimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_riferimenti_normativi_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti_cga"
            referencedColumns: ["id"]
          },
        ]
      }
      produttori_provvigioni_ramo: {
        Row: {
          anagrafica_id: string
          created_at: string
          id: string
          percentuale_consulenza: number | null
          percentuale_provvigione: number | null
          percentuale_ra: number | null
          ramo_codice: string
          updated_at: string
        }
        Insert: {
          anagrafica_id: string
          created_at?: string
          id?: string
          percentuale_consulenza?: number | null
          percentuale_provvigione?: number | null
          percentuale_ra?: number | null
          ramo_codice: string
          updated_at?: string
        }
        Update: {
          anagrafica_id?: string
          created_at?: string
          id?: string
          percentuale_consulenza?: number | null
          percentuale_provvigione?: number | null
          percentuale_ra?: number | null
          ramo_codice?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produttori_provvigioni_ramo_anagrafica_id_fkey"
            columns: ["anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produttori_provvigioni_ramo_ramo_codice_fkey"
            columns: ["ramo_codice"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["codice"]
          },
          {
            foreignKeyName: "produttori_provvigioni_ramo_ramo_codice_fkey"
            columns: ["ramo_codice"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["ramo_codice"]
          },
          {
            foreignKeyName: "produttori_provvigioni_ramo_ramo_codice_fkey"
            columns: ["ramo_codice"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["ramo_codice"]
          },
        ]
      }
      profiles: {
        Row: {
          attivo: boolean | null
          avatar_url: string | null
          cap: string | null
          citta: string | null
          codice_contabile: string | null
          codice_fiscale: string | null
          cognome: string | null
          conto_bancario_id: string | null
          created_at: string | null
          data_iscrizione_rui: string | null
          descrizione: string | null
          email: string | null
          fax: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_cc: string | null
          nome: string | null
          nome_rui: string | null
          note: string | null
          numero_rui: string | null
          percentuale_base: number | null
          percentuale_consulenza: number | null
          percentuale_ra: number | null
          permessi_json: Json | null
          provincia: string | null
          ruolo: string | null
          search_vector: unknown
          sezione_rui: string | null
          telefono: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          avatar_url?: string | null
          cap?: string | null
          citta?: string | null
          codice_contabile?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          descrizione?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          nome?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          permessi_json?: Json | null
          provincia?: string | null
          ruolo?: string | null
          search_vector?: unknown
          sezione_rui?: string | null
          telefono?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          avatar_url?: string | null
          cap?: string | null
          citta?: string | null
          codice_contabile?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          conto_bancario_id?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          descrizione?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          nome?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          permessi_json?: Json | null
          provincia?: string | null
          ruolo?: string | null
          search_vector?: unknown
          sezione_rui?: string | null
          telefono?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      profilo_sedi: {
        Row: {
          created_at: string
          primaria: boolean
          profilo_id: string
          ufficio_id: string
        }
        Insert: {
          created_at?: string
          primaria?: boolean
          profilo_id: string
          ufficio_id: string
        }
        Update: {
          created_at?: string
          primaria?: boolean
          profilo_id?: string
          ufficio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profilo_sedi_profilo_id_fkey"
            columns: ["profilo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profilo_sedi_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect: {
        Row: {
          assegnato_a: string | null
          attenzione_di: string | null
          attivita: string | null
          azienda_stat: string | null
          cap_alternativo: string | null
          cap_fiscale: string | null
          cap_residenza: string | null
          cap_sede: string | null
          cellulare: string | null
          citta_alternativa: string | null
          citta_fiscale: string | null
          citta_residenza: string | null
          citta_sede: string | null
          cliente_associato: boolean | null
          cliente_captive: boolean | null
          codice_ateco: string | null
          codice_fiscale: string | null
          codice_fiscale_azienda: string | null
          codice_ricerca: string | null
          codice_sdi: string | null
          cognome: string | null
          comune_nascita: string | null
          contratto: string | null
          convertito_cliente_id: string | null
          created_at: string | null
          data_nascita: string | null
          email: string | null
          fascia_dipendenti: string | null
          fascia_fatturato: string | null
          fax: string | null
          fonte: string | null
          forma_giuridica: string | null
          gruppo_statistico: string | null
          id: string
          indirizzo_alternativo: string | null
          indirizzo_fiscale: string | null
          indirizzo_residenza: string | null
          indirizzo_sede: string | null
          indotto: string | null
          internazionale: boolean | null
          luogo_nascita: string | null
          matricola: string | null
          nazione: string | null
          nome: string | null
          note: string | null
          partita_iva: string | null
          pec: string | null
          provincia_alternativa: string | null
          provincia_fiscale: string | null
          provincia_nascita: string | null
          provincia_residenza: string | null
          provincia_sede: string | null
          ragione_sociale: string | null
          referente_cognome: string | null
          referente_email: string | null
          referente_nome: string | null
          referente_telefono: string | null
          riferimento: string | null
          search_vector: unknown
          sesso: string | null
          settore: string | null
          stato: string
          telefono: string | null
          tipo_cliente: string
          titolo: string | null
          ufficio_id: string | null
          updated_at: string | null
          user_id: string | null
          zona: string | null
        }
        Insert: {
          assegnato_a?: string | null
          attenzione_di?: string | null
          attivita?: string | null
          azienda_stat?: string | null
          cap_alternativo?: string | null
          cap_fiscale?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          citta_alternativa?: string | null
          citta_fiscale?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          convertito_cliente_id?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fascia_dipendenti?: string | null
          fascia_fatturato?: string | null
          fax?: string | null
          fonte?: string | null
          forma_giuridica?: string | null
          gruppo_statistico?: string | null
          id?: string
          indirizzo_alternativo?: string | null
          indirizzo_fiscale?: string | null
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          provincia_alternativa?: string | null
          provincia_fiscale?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          search_vector?: unknown
          sesso?: string | null
          settore?: string | null
          stato?: string
          telefono?: string | null
          tipo_cliente?: string
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Update: {
          assegnato_a?: string | null
          attenzione_di?: string | null
          attivita?: string | null
          azienda_stat?: string | null
          cap_alternativo?: string | null
          cap_fiscale?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          citta_alternativa?: string | null
          citta_fiscale?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          convertito_cliente_id?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fascia_dipendenti?: string | null
          fascia_fatturato?: string | null
          fax?: string | null
          fonte?: string | null
          forma_giuridica?: string | null
          gruppo_statistico?: string | null
          id?: string
          indirizzo_alternativo?: string | null
          indirizzo_fiscale?: string | null
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          provincia_alternativa?: string | null
          provincia_fiscale?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          search_vector?: unknown
          sesso?: string | null
          settore?: string | null
          stato?: string
          telefono?: string | null
          tipo_cliente?: string
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_convertito_cliente_id_fkey"
            columns: ["convertito_cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      provvigioni_compagnia_ramo: {
        Row: {
          attiva: boolean | null
          categoria_id: string | null
          compagnia_id: string | null
          compagnia_rapporto_id: string | null
          created_at: string | null
          gruppo_ramo_id: string | null
          id: string
          percentuale_provvigione: number
          percentuale_provvigione_accessori: number | null
          ramo_id: string | null
        }
        Insert: {
          attiva?: boolean | null
          categoria_id?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          percentuale_provvigione?: number
          percentuale_provvigione_accessori?: number | null
          ramo_id?: string | null
        }
        Update: {
          attiva?: boolean | null
          categoria_id?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          created_at?: string | null
          gruppo_ramo_id?: string | null
          id?: string
          percentuale_provvigione?: number
          percentuale_provvigione_accessori?: number | null
          ramo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provvigioni_compagnia_ramo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie_prodotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_compagnia_ramo_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_compagnia_ramo_compagnia_rapporto_id_fkey"
            columns: ["compagnia_rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_compagnia_ramo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_compagnia_ramo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "provvigioni_compagnia_ramo_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
        ]
      }
      provvigioni_default_tipo: {
        Row: {
          attiva: boolean
          created_at: string
          gruppo_ramo_id: string | null
          id: string
          percentuale: number
          ramo_id: string | null
          tipo_rapporto: string
          updated_at: string
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          gruppo_ramo_id?: string | null
          id?: string
          percentuale?: number
          ramo_id?: string | null
          tipo_rapporto: string
          updated_at?: string
        }
        Update: {
          attiva?: boolean
          created_at?: string
          gruppo_ramo_id?: string | null
          id?: string
          percentuale?: number
          ramo_id?: string | null
          tipo_rapporto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provvigioni_default_tipo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_default_tipo_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
          {
            foreignKeyName: "provvigioni_default_tipo_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
        ]
      }
      provvigioni_generate: {
        Row: {
          anagrafica_commerciale_id: string | null
          calcolata_il: string | null
          id: string
          importo_provvigione: number | null
          pagata: boolean | null
          percentuale: number | null
          quietanza_id: string | null
          solo_statistico: boolean
          tipo_destinatario: string | null
          titolo_id: string
          user_id: string | null
        }
        Insert: {
          anagrafica_commerciale_id?: string | null
          calcolata_il?: string | null
          id?: string
          importo_provvigione?: number | null
          pagata?: boolean | null
          percentuale?: number | null
          quietanza_id?: string | null
          solo_statistico?: boolean
          tipo_destinatario?: string | null
          titolo_id: string
          user_id?: string | null
        }
        Update: {
          anagrafica_commerciale_id?: string | null
          calcolata_il?: string | null
          id?: string
          importo_provvigione?: number | null
          pagata?: boolean | null
          percentuale?: number | null
          quietanza_id?: string | null
          solo_statistico?: boolean
          tipo_destinatario?: string | null
          titolo_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provvigioni_generate_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_generate_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "quietanze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_generate_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["quietanza_id"]
          },
          {
            foreignKeyName: "provvigioni_generate_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_generate_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_generate_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quietanze: {
        Row: {
          addizionali: number | null
          appendice: string | null
          conto_incasso: string | null
          created_at: string
          data_competenza: string | null
          data_copertura: string | null
          data_incasso: string | null
          data_messa_cassa: string | null
          data_pagamento: string | null
          data_scadenza: string | null
          garanzia_a: string | null
          garanzia_da: string | null
          id: string
          importo_incassato: number | null
          limite_mora: string | null
          mora_giorni: number | null
          numero_polizza_snapshot: string | null
          numero_rata: number
          numero_rate_totali: number
          polizza_id: string
          premio_lordo: number | null
          premio_netto: number | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          search_vector: unknown
          ssn: number | null
          stato: Database["public"]["Enums"]["quietanza_stato"]
          tasse: number | null
          tipo_incasso: string | null
          titolo_id: string | null
          updated_at: string
        }
        Insert: {
          addizionali?: number | null
          appendice?: string | null
          conto_incasso?: string | null
          created_at?: string
          data_competenza?: string | null
          data_copertura?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          id?: string
          importo_incassato?: number | null
          limite_mora?: string | null
          mora_giorni?: number | null
          numero_polizza_snapshot?: string | null
          numero_rata: number
          numero_rate_totali: number
          polizza_id: string
          premio_lordo?: number | null
          premio_netto?: number | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          search_vector?: unknown
          ssn?: number | null
          stato?: Database["public"]["Enums"]["quietanza_stato"]
          tasse?: number | null
          tipo_incasso?: string | null
          titolo_id?: string | null
          updated_at?: string
        }
        Update: {
          addizionali?: number | null
          appendice?: string | null
          conto_incasso?: string | null
          created_at?: string
          data_competenza?: string | null
          data_copertura?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          id?: string
          importo_incassato?: number | null
          limite_mora?: string | null
          mora_giorni?: number | null
          numero_polizza_snapshot?: string | null
          numero_rata?: number
          numero_rate_totali?: number
          polizza_id?: string
          premio_lordo?: number | null
          premio_netto?: number | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          search_vector?: unknown
          ssn?: number | null
          stato?: Database["public"]["Enums"]["quietanza_stato"]
          tasse?: number | null
          tipo_incasso?: string | null
          titolo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quietanze_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quietanze_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "quietanze_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quietanze_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      rami: {
        Row: {
          aliquota_ssn: number | null
          aliquota_tasse_ard: number | null
          aliquota_tasse_ramo: number | null
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          diritti_agenzia: boolean
          escludi_provvigioni: boolean
          gruppo_ramo_id: string | null
          id: string
          ssn_attivo: boolean
        }
        Insert: {
          aliquota_ssn?: number | null
          aliquota_tasse_ard?: number | null
          aliquota_tasse_ramo?: number | null
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          diritti_agenzia?: boolean
          escludi_provvigioni?: boolean
          gruppo_ramo_id?: string | null
          id?: string
          ssn_attivo?: boolean
        }
        Update: {
          aliquota_ssn?: number | null
          aliquota_tasse_ard?: number | null
          aliquota_tasse_ramo?: number | null
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          diritti_agenzia?: boolean
          escludi_provvigioni?: boolean
          gruppo_ramo_id?: string | null
          id?: string
          ssn_attivo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rami_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rami_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
        ]
      }
      rca_garanzie: {
        Row: {
          aliquota_tasse: number | null
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          gruppo_ramo_id: string
          id: string
        }
        Insert: {
          aliquota_tasse?: number | null
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          gruppo_ramo_id: string
          id?: string
        }
        Update: {
          aliquota_tasse?: number | null
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          gruppo_ramo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rca_garanzie_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_garanzie_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["gruppo_ramo_id"]
          },
        ]
      }
      rca_usi: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      report_salvati: {
        Row: {
          created_at: string
          creato_da: string
          filtri_json: Json | null
          id: string
          nome: string
          tipo_report: string
        }
        Insert: {
          created_at?: string
          creato_da: string
          filtri_json?: Json | null
          id?: string
          nome: string
          tipo_report?: string
        }
        Update: {
          created_at?: string
          creato_da?: string
          filtri_json?: Json | null
          id?: string
          nome?: string
          tipo_report?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_salvati_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ricerche_bandi: {
        Row: {
          eseguita_da: string | null
          eseguita_il: string
          id: string
          regioni: string[] | null
          risultati_count: number | null
        }
        Insert: {
          eseguita_da?: string | null
          eseguita_il?: string
          id?: string
          regioni?: string[] | null
          risultati_count?: number | null
        }
        Update: {
          eseguita_da?: string | null
          eseguita_il?: string
          id?: string
          regioni?: string[] | null
          risultati_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ricerche_bandi_eseguita_da_fkey"
            columns: ["eseguita_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      richieste_modifica_cliente: {
        Row: {
          campo: string
          campo_label: string | null
          cliente_id: string
          created_at: string
          documento_url: string | null
          gestita_da: string | null
          gestita_il: string | null
          id: string
          motivazione: string | null
          note_agenzia: string | null
          richiesto_da: string
          stato: string
          updated_at: string
          valore_attuale: string | null
          valore_proposto: string
        }
        Insert: {
          campo: string
          campo_label?: string | null
          cliente_id: string
          created_at?: string
          documento_url?: string | null
          gestita_da?: string | null
          gestita_il?: string | null
          id?: string
          motivazione?: string | null
          note_agenzia?: string | null
          richiesto_da: string
          stato?: string
          updated_at?: string
          valore_attuale?: string | null
          valore_proposto: string
        }
        Update: {
          campo?: string
          campo_label?: string | null
          cliente_id?: string
          created_at?: string
          documento_url?: string | null
          gestita_da?: string | null
          gestita_il?: string | null
          id?: string
          motivazione?: string | null
          note_agenzia?: string | null
          richiesto_da?: string
          stato?: string
          updated_at?: string
          valore_attuale?: string | null
          valore_proposto?: string
        }
        Relationships: [
          {
            foreignKeyName: "richieste_modifica_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      richieste_quietanza: {
        Row: {
          compagnia_id: string | null
          compagnia_nome: string | null
          corpo_html: string | null
          created_at: string
          destinatario_email: string
          errore: string | null
          id: string
          inviato_at: string
          inviato_da: string | null
          num_titoli: number
          oggetto: string
          resend_id: string | null
          stato: string
        }
        Insert: {
          compagnia_id?: string | null
          compagnia_nome?: string | null
          corpo_html?: string | null
          created_at?: string
          destinatario_email: string
          errore?: string | null
          id?: string
          inviato_at?: string
          inviato_da?: string | null
          num_titoli?: number
          oggetto: string
          resend_id?: string | null
          stato?: string
        }
        Update: {
          compagnia_id?: string | null
          compagnia_nome?: string | null
          corpo_html?: string | null
          created_at?: string
          destinatario_email?: string
          errore?: string | null
          id?: string
          inviato_at?: string
          inviato_da?: string | null
          num_titoli?: number
          oggetto?: string
          resend_id?: string | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "richieste_quietanza_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
        ]
      }
      richieste_quietanza_righe: {
        Row: {
          cliente_nome: string | null
          created_at: string
          data_scadenza: string | null
          id: string
          numero_polizza: string | null
          premio_lordo: number | null
          ramo: string | null
          richiesta_id: string
          tacito_rinnovo: boolean | null
          titolo_id: string | null
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          data_scadenza?: string | null
          id?: string
          numero_polizza?: string | null
          premio_lordo?: number | null
          ramo?: string | null
          richiesta_id: string
          tacito_rinnovo?: boolean | null
          titolo_id?: string | null
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          data_scadenza?: string | null
          id?: string
          numero_polizza?: string | null
          premio_lordo?: number | null
          ramo?: string | null
          richiesta_id?: string
          tacito_rinnovo?: boolean | null
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "richieste_quietanza_righe_richiesta_id_fkey"
            columns: ["richiesta_id"]
            isOneToOne: false
            referencedRelation: "richieste_quietanza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "richieste_quietanza_righe_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "richieste_quietanza_righe_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      rimessa_dettaglio: {
        Row: {
          id: string
          importo: number | null
          quietanza_id: string | null
          rimessa_id: string
          titolo_id: string | null
        }
        Insert: {
          id?: string
          importo?: number | null
          quietanza_id?: string | null
          rimessa_id: string
          titolo_id?: string | null
        }
        Update: {
          id?: string
          importo?: number | null
          quietanza_id?: string | null
          rimessa_id?: string
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rimessa_dettaglio_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "quietanze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_dettaglio_quietanza_id_fkey"
            columns: ["quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["quietanza_id"]
          },
          {
            foreignKeyName: "rimessa_dettaglio_rimessa_id_fkey"
            columns: ["rimessa_id"]
            isOneToOne: false
            referencedRelation: "rimessa_premi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      rimessa_premi: {
        Row: {
          api_endpoint: string | null
          api_response: string | null
          compagnia_id: string | null
          conto_bancario_mittente_id: string | null
          created_at: string | null
          created_by: string | null
          data_creazione: string | null
          data_messa_in_pagamento: string | null
          data_pagamento_rimessa: string | null
          flusso_xml_id: string | null
          iban_utilizzato: string | null
          id: string
          importo_pagato: number | null
          n_titoli: number | null
          note: string | null
          pdf_url: string | null
          stato: string
          totale_importi: number | null
          totale_provvigioni: number | null
          ufficio_id: string | null
          updated_at: string | null
          xml_output: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          conto_bancario_mittente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_creazione?: string | null
          data_messa_in_pagamento?: string | null
          data_pagamento_rimessa?: string | null
          flusso_xml_id?: string | null
          iban_utilizzato?: string | null
          id?: string
          importo_pagato?: number | null
          n_titoli?: number | null
          note?: string | null
          pdf_url?: string | null
          stato?: string
          totale_importi?: number | null
          totale_provvigioni?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
          xml_output?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          conto_bancario_mittente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_creazione?: string | null
          data_messa_in_pagamento?: string | null
          data_pagamento_rimessa?: string | null
          flusso_xml_id?: string | null
          iban_utilizzato?: string | null
          id?: string
          importo_pagato?: number | null
          n_titoli?: number | null
          note?: string | null
          pdf_url?: string | null
          stato?: string
          totale_importi?: number | null
          totale_provvigioni?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
          xml_output?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rimessa_premi_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_conto_bancario_mittente_id_fkey"
            columns: ["conto_bancario_mittente_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_flusso_xml_id_fkey"
            columns: ["flusso_xml_id"]
            isOneToOne: false
            referencedRelation: "documenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      ruoli_template: {
        Row: {
          created_at: string | null
          descrizione: string | null
          id: string
          nome_template: string | null
          permessi_json: Json | null
          ruolo_base: string | null
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome_template?: string | null
          permessi_json?: Json | null
          ruolo_base?: string | null
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome_template?: string | null
          permessi_json?: Json | null
          ruolo_base?: string | null
        }
        Relationships: []
      }
      scadenziario: {
        Row: {
          created_at: string | null
          data_pagamento: string | null
          data_scadenza: string
          descrizione: string | null
          fornitore_id: string | null
          id: string
          importo: number | null
          primanota_id: string | null
          stato: string | null
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza: string
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          importo?: number | null
          primanota_id?: string | null
          stato?: string | null
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza?: string
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          importo?: number | null
          primanota_id?: string | null
          stato?: string | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scadenziario_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_primanota_id_fkey"
            columns: ["primanota_id"]
            isOneToOne: false
            referencedRelation: "primanota_generale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      sezioni_bilancio: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          ordine: number | null
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          ordine?: number | null
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          ordine?: number | null
        }
        Relationships: []
      }
      sinistri: {
        Row: {
          aperto_da_cliente: boolean
          aperto_da_user_id: string | null
          bozza_wizard_json: Json | null
          cap_sinistro: string | null
          citta_sinistro: string | null
          cliente_anagrafica_id: string | null
          cliente_id: string | null
          compagnia_id: string | null
          controparte: string | null
          costo_effettivo: number | null
          costo_preventivato: number | null
          created_at: string | null
          data_apertura: string | null
          data_chiusura: string | null
          data_denuncia: string | null
          data_evento: string | null
          descrizione: string | null
          dinamica: string | null
          franchigia: number | null
          id: string
          importo_liquidato: number | null
          importo_riserva: number | null
          indirizzo_sinistro: string | null
          liquidatore_id: string | null
          luogo_sinistro: string | null
          medico_legale: string | null
          note_importanti: string | null
          note_interne: string | null
          note_perito: string | null
          numero_polizza: string | null
          numero_sinistro: string | null
          numero_sinistro_compagnia: string | null
          perito_id: string | null
          polizza_id: string | null
          prodotto_sinistro: string | null
          provincia_sinistro: string | null
          ramo_sinistro: string | null
          reparto: string | null
          responsabile_id: string | null
          search_vector: unknown
          sinistro_terzi: boolean
          stato: string
          targa_veicolo: string | null
          tipo_sinistro: string | null
          tipo_sinistro_personalizzato: string | null
          titolo_id: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          aperto_da_cliente?: boolean
          aperto_da_user_id?: string | null
          bozza_wizard_json?: Json | null
          cap_sinistro?: string | null
          citta_sinistro?: string | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          compagnia_id?: string | null
          controparte?: string | null
          costo_effettivo?: number | null
          costo_preventivato?: number | null
          created_at?: string | null
          data_apertura?: string | null
          data_chiusura?: string | null
          data_denuncia?: string | null
          data_evento?: string | null
          descrizione?: string | null
          dinamica?: string | null
          franchigia?: number | null
          id?: string
          importo_liquidato?: number | null
          importo_riserva?: number | null
          indirizzo_sinistro?: string | null
          liquidatore_id?: string | null
          luogo_sinistro?: string | null
          medico_legale?: string | null
          note_importanti?: string | null
          note_interne?: string | null
          note_perito?: string | null
          numero_polizza?: string | null
          numero_sinistro?: string | null
          numero_sinistro_compagnia?: string | null
          perito_id?: string | null
          polizza_id?: string | null
          prodotto_sinistro?: string | null
          provincia_sinistro?: string | null
          ramo_sinistro?: string | null
          reparto?: string | null
          responsabile_id?: string | null
          search_vector?: unknown
          sinistro_terzi?: boolean
          stato?: string
          targa_veicolo?: string | null
          tipo_sinistro?: string | null
          tipo_sinistro_personalizzato?: string | null
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aperto_da_cliente?: boolean
          aperto_da_user_id?: string | null
          bozza_wizard_json?: Json | null
          cap_sinistro?: string | null
          citta_sinistro?: string | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          compagnia_id?: string | null
          controparte?: string | null
          costo_effettivo?: number | null
          costo_preventivato?: number | null
          created_at?: string | null
          data_apertura?: string | null
          data_chiusura?: string | null
          data_denuncia?: string | null
          data_evento?: string | null
          descrizione?: string | null
          dinamica?: string | null
          franchigia?: number | null
          id?: string
          importo_liquidato?: number | null
          importo_riserva?: number | null
          indirizzo_sinistro?: string | null
          liquidatore_id?: string | null
          luogo_sinistro?: string | null
          medico_legale?: string | null
          note_importanti?: string | null
          note_interne?: string | null
          note_perito?: string | null
          numero_polizza?: string | null
          numero_sinistro?: string | null
          numero_sinistro_compagnia?: string | null
          perito_id?: string | null
          polizza_id?: string | null
          prodotto_sinistro?: string | null
          provincia_sinistro?: string | null
          ramo_sinistro?: string | null
          reparto?: string | null
          responsabile_id?: string | null
          search_vector?: unknown
          sinistro_terzi?: boolean
          stato?: string
          targa_veicolo?: string | null
          tipo_sinistro?: string | null
          tipo_sinistro_personalizzato?: string | null
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistri_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_liquidatore_id_fkey"
            columns: ["liquidatore_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_perito_id_fkey"
            columns: ["perito_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "sinistri_responsabile_id_fkey"
            columns: ["responsabile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_checklist: {
        Row: {
          completato: boolean | null
          created_at: string | null
          descrizione: string
          id: string
          obbligatorio: boolean | null
          sinistro_id: string
        }
        Insert: {
          completato?: boolean | null
          created_at?: string | null
          descrizione: string
          id?: string
          obbligatorio?: boolean | null
          sinistro_id: string
        }
        Update: {
          completato?: boolean | null
          created_at?: string | null
          descrizione?: string
          id?: string
          obbligatorio?: boolean | null
          sinistro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_checklist_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_eventi: {
        Row: {
          created_at: string | null
          data_scadenza: string
          id: string
          note: string | null
          sinistro_id: string
          stato: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string | null
          data_scadenza: string
          id?: string
          note?: string | null
          sinistro_id: string
          stato?: string
          tipo_evento: string
        }
        Update: {
          created_at?: string | null
          data_scadenza?: string
          id?: string
          note?: string | null
          sinistro_id?: string
          stato?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_eventi_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_note_interne: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          sinistro_id: string
          testo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          sinistro_id: string
          testo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          sinistro_id?: string
          testo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_note_interne_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_note_interne_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_prescrizioni: {
        Row: {
          canale: string | null
          corpo: string | null
          created_at: string
          creato_da: string
          data_invio: string | null
          data_scadenza_risposta: string
          destinatario_label: string | null
          destinatario_tipo: string
          id: string
          note: string | null
          oggetto: string
          sinistro_id: string
          stato: string
          updated_at: string
        }
        Insert: {
          canale?: string | null
          corpo?: string | null
          created_at?: string
          creato_da: string
          data_invio?: string | null
          data_scadenza_risposta: string
          destinatario_label?: string | null
          destinatario_tipo?: string
          id?: string
          note?: string | null
          oggetto: string
          sinistro_id: string
          stato?: string
          updated_at?: string
        }
        Update: {
          canale?: string | null
          corpo?: string | null
          created_at?: string
          creato_da?: string
          data_invio?: string | null
          data_scadenza_risposta?: string
          destinatario_label?: string | null
          destinatario_tipo?: string
          id?: string
          note?: string | null
          oggetto?: string
          sinistro_id?: string
          stato?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_prescrizioni_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_reminder: {
        Row: {
          assegnato_a: string | null
          categoria: string
          cliente_id: string | null
          completato: boolean
          created_at: string
          creato_da: string | null
          data_promemoria: string | null
          data_scadenza: string
          id: string
          letto: boolean
          popup_mostrato_at: string | null
          sinistro_id: string
          stato: string
          testo: string
          titolo_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assegnato_a?: string | null
          categoria?: string
          cliente_id?: string | null
          completato?: boolean
          created_at?: string
          creato_da?: string | null
          data_promemoria?: string | null
          data_scadenza: string
          id?: string
          letto?: boolean
          popup_mostrato_at?: string | null
          sinistro_id: string
          stato?: string
          testo: string
          titolo_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assegnato_a?: string | null
          categoria?: string
          cliente_id?: string | null
          completato?: boolean
          created_at?: string
          creato_da?: string | null
          data_promemoria?: string | null
          data_scadenza?: string
          id?: string
          letto?: boolean
          popup_mostrato_at?: string | null
          sinistro_id?: string
          stato?: string
          testo?: string
          titolo_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_reminder_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_reminder_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_reminder_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_reminder_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_reminder_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_reminder_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      sottoramo_fattori_regolazione: {
        Row: {
          attivo: boolean
          fattore_id: string
          id: string
          ramo_id: string
        }
        Insert: {
          attivo?: boolean
          fattore_id: string
          id?: string
          ramo_id: string
        }
        Update: {
          attivo?: boolean
          fattore_id?: string
          id?: string
          ramo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sottoramo_fattori_regolazione_fattore_id_fkey"
            columns: ["fattore_id"]
            isOneToOne: false
            referencedRelation: "fattori_regolazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sottoramo_fattori_regolazione_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_sinistri_sedi: {
        Row: {
          created_at: string
          id: string
          primaria: boolean
          profilo_id: string
          ufficio_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          primaria?: boolean
          profilo_id: string
          ufficio_id: string
        }
        Update: {
          created_at?: string
          id?: string
          primaria?: boolean
          profilo_id?: string
          ufficio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_sinistri_sedi_profilo_id_fkey"
            columns: ["profilo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_sinistri_sedi_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      spedizioni_cartacee: {
        Row: {
          corriere: string | null
          created_at: string | null
          created_by: string | null
          data_spedizione: string
          id: string
          nota_id: string | null
          stato: string
          tipo_spedizione: string
          tracking_code: string | null
          ufficio_id: string | null
        }
        Insert: {
          corriere?: string | null
          created_at?: string | null
          created_by?: string | null
          data_spedizione?: string
          id?: string
          nota_id?: string | null
          stato?: string
          tipo_spedizione?: string
          tracking_code?: string | null
          ufficio_id?: string | null
        }
        Update: {
          corriere?: string | null
          created_at?: string | null
          created_by?: string | null
          data_spedizione?: string
          id?: string
          nota_id?: string | null
          stato?: string
          tipo_spedizione?: string
          tracking_code?: string | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spedizioni_cartacee_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spedizioni_cartacee_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "note_restituzione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spedizioni_cartacee_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      storico_gare: {
        Row: {
          anno_riferimento: number
          broker_incumbent: string | null
          categoria_ente: string | null
          cliente_id: string | null
          contatto_riferimento: string | null
          contatto_telefono: string | null
          created_at: string
          created_by: string | null
          data_consegna: string | null
          data_fine_mandato: string | null
          data_inizio_mandato: string | null
          ente_nome: string
          esito: string | null
          flag_accesso_atti: boolean | null
          flag_cauzione: boolean | null
          flag_offerta_tecnica: boolean | null
          flag_referenze_bancarie: boolean | null
          id: string
          note: string | null
          opzione_rinnovo: string | null
          opzione_rinnovo_anni: number | null
          pagine_offerta_tecnica: string | null
          provincia: string | null
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          tipologia: string | null
          trattativa_id: string | null
          updated_at: string
        }
        Insert: {
          anno_riferimento: number
          broker_incumbent?: string | null
          categoria_ente?: string | null
          cliente_id?: string | null
          contatto_riferimento?: string | null
          contatto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          data_consegna?: string | null
          data_fine_mandato?: string | null
          data_inizio_mandato?: string | null
          ente_nome: string
          esito?: string | null
          flag_accesso_atti?: boolean | null
          flag_cauzione?: boolean | null
          flag_offerta_tecnica?: boolean | null
          flag_referenze_bancarie?: boolean | null
          id?: string
          note?: string | null
          opzione_rinnovo?: string | null
          opzione_rinnovo_anni?: number | null
          pagine_offerta_tecnica?: string | null
          provincia?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          tipologia?: string | null
          trattativa_id?: string | null
          updated_at?: string
        }
        Update: {
          anno_riferimento?: number
          broker_incumbent?: string | null
          categoria_ente?: string | null
          cliente_id?: string | null
          contatto_riferimento?: string | null
          contatto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          data_consegna?: string | null
          data_fine_mandato?: string | null
          data_inizio_mandato?: string | null
          ente_nome?: string
          esito?: string | null
          flag_accesso_atti?: boolean | null
          flag_cauzione?: boolean | null
          flag_offerta_tecnica?: boolean | null
          flag_referenze_bancarie?: boolean | null
          id?: string
          note?: string | null
          opzione_rinnovo?: string | null
          opzione_rinnovo_anni?: number | null
          pagine_offerta_tecnica?: string | null
          provincia?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          tipologia?: string | null
          trattativa_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storico_gare_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_gare_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_gare_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
        ]
      }
      template_categorie: {
        Row: {
          created_at: string | null
          descrizione: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      template_email: {
        Row: {
          attivo: boolean | null
          categoria_id: string
          corpo: string
          created_at: string | null
          id: string
          nome: string
          oggetto: string
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          categoria_id: string
          corpo?: string
          created_at?: string | null
          id?: string
          nome: string
          oggetto?: string
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          categoria_id?: string
          corpo?: string
          created_at?: string | null
          id?: string
          nome?: string
          oggetto?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_email_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "template_categorie"
            referencedColumns: ["id"]
          },
        ]
      }
      tipi_mandatario: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      tipi_rinnovo: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      titoli: {
        Row: {
          addizionali: number | null
          addizionali_quietanza: number | null
          ae_anagrafica_id: string | null
          ae_nome: string | null
          anagrafica_commerciale_id: string | null
          anni_durata: number | null
          appendice: string | null
          appendice_modifica_polizza_madre_id: string | null
          banca_pagamento: string | null
          brokeraggio_firma: number | null
          brokeraggio_quietanza: number | null
          cambio: number | null
          causale_estinzione: string | null
          causale_sostituzione: string | null
          causale_storno: string | null
          cig_rif: string | null
          cig_temporaneo: boolean
          cliente_anagrafica_id: string | null
          cliente_id: string | null
          coassicurazione: boolean | null
          codice_rapporto: string | null
          commerciale_id: string | null
          comp_assicurativa: string | null
          comp_contabile: string | null
          compagnia_id: string | null
          compagnia_rapporto_id: string | null
          conferimento_gestito: boolean | null
          conto_incasso: string | null
          created_at: string | null
          data_competenza: string | null
          data_conferimento_gestito: string | null
          data_copertura: string | null
          data_decorrenza_rinnovo: string | null
          data_estinzione: string | null
          data_incasso: string | null
          data_messa_cassa: string | null
          data_pagamento: string | null
          data_riattivazione: string | null
          data_scadenza: string | null
          data_sospensione: string | null
          data_sostituzione: string | null
          data_storno: string | null
          descrizione_polizza: string | null
          disdetta_giorni: number | null
          durata_a: string | null
          durata_da: string | null
          emissione_fee: boolean | null
          emittenda: boolean
          filiale: string | null
          fondi_ricevuti: boolean | null
          formato_elettronico: boolean | null
          frazionamento: string | null
          garanzia_a: string | null
          garanzia_da: string | null
          giorni_presentazione: number | null
          id: string
          id_legacy: number | null
          importo_incassato: number | null
          indicizzata: boolean | null
          is_appendice_modifica: boolean
          is_oneri_riattivazione: boolean
          is_oneri_sospensione: boolean
          is_proroga: boolean
          is_regolazione: boolean
          libro_matricola: string | null
          limite_mora: string | null
          limite_riattivazione: string | null
          mora_giorni: number | null
          motivo_estinzione: string | null
          motivo_sospensione: string | null
          motivo_sostituzione: string | null
          motivo_storno: string | null
          no_calcolo_tasse: boolean | null
          note: string | null
          numero_titolo: string | null
          pag_diretto_compagnia: boolean | null
          percentuale_ae: number
          percentuale_brokeraggio: number | null
          percentuale_commerciale: number | null
          percentuale_riparto: number | null
          periodicita: string | null
          polizza_id: string | null
          polizza_rateo: boolean
          polizza_temporanea: boolean
          premio_lordo: number | null
          premio_netto: number | null
          premio_netto_quietanza: number | null
          prodotto_id: string | null
          prodotto_nome: string | null
          produttore_id: string | null
          produttore_nome: string | null
          proroga_polizza_madre_id: string | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          quietanze_sospensione_snapshot: Json | null
          ramo_id: string | null
          rate: number | null
          regolazione: boolean | null
          regolazione_data_presunta: string | null
          regolazione_date_presunte: string[] | null
          regolazione_fattore: string | null
          regolazione_note: string | null
          regolazione_quietanza_id: string | null
          riforma_alla_scadenza: boolean
          riga: number | null
          rimborso: boolean | null
          risk_type: string | null
          search_vector: unknown
          sostituisce_appendice: string | null
          sostituisce_polizza: string | null
          sostituisce_riga: number | null
          specialist: string | null
          split_personalizzato: boolean
          ssn_firma: number
          ssn_quietanza: number
          stato: string
          storno_appendice: string | null
          storno_polizza: string | null
          storno_riga: number | null
          tacito_rinnovo: boolean
          targa_telaio: string | null
          tasse: number | null
          tasse_quietanza: number | null
          tipo_incasso: string | null
          tipo_lettera_regolazione: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          tipo_portafoglio: string | null
          tipo_rinnovo: string | null
          tipo_scadenza: string | null
          titolo_storno_id: string | null
          ufficio_id: string | null
          updated_at: string | null
          valuta: string | null
          vincolo: string | null
          vincolo_attivo: boolean
        }
        Insert: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          ae_anagrafica_id?: string | null
          ae_nome?: string | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice?: string | null
          appendice_modifica_polizza_madre_id?: string | null
          banca_pagamento?: string | null
          brokeraggio_firma?: number | null
          brokeraggio_quietanza?: number | null
          cambio?: number | null
          causale_estinzione?: string | null
          causale_sostituzione?: string | null
          causale_storno?: string | null
          cig_rif?: string | null
          cig_temporaneo?: boolean
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          coassicurazione?: boolean | null
          codice_rapporto?: string | null
          commerciale_id?: string | null
          comp_assicurativa?: string | null
          comp_contabile?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          conferimento_gestito?: boolean | null
          conto_incasso?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_conferimento_gestito?: string | null
          data_copertura?: string | null
          data_decorrenza_rinnovo?: string | null
          data_estinzione?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_riattivazione?: string | null
          data_scadenza?: string | null
          data_sospensione?: string | null
          data_sostituzione?: string | null
          data_storno?: string | null
          descrizione_polizza?: string | null
          disdetta_giorni?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          emittenda?: boolean
          filiale?: string | null
          fondi_ricevuti?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          id?: string
          id_legacy?: number | null
          importo_incassato?: number | null
          indicizzata?: boolean | null
          is_appendice_modifica?: boolean
          is_oneri_riattivazione?: boolean
          is_oneri_sospensione?: boolean
          is_proroga?: boolean
          is_regolazione?: boolean
          libro_matricola?: string | null
          limite_mora?: string | null
          limite_riattivazione?: string | null
          mora_giorni?: number | null
          motivo_estinzione?: string | null
          motivo_sospensione?: string | null
          motivo_sostituzione?: string | null
          motivo_storno?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_ae?: number
          percentuale_brokeraggio?: number | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          periodicita?: string | null
          polizza_id?: string | null
          polizza_rateo?: boolean
          polizza_temporanea?: boolean
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          prodotto_nome?: string | null
          produttore_id?: string | null
          produttore_nome?: string | null
          proroga_polizza_madre_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          quietanze_sospensione_snapshot?: Json | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          regolazione_data_presunta?: string | null
          regolazione_date_presunte?: string[] | null
          regolazione_fattore?: string | null
          regolazione_note?: string | null
          regolazione_quietanza_id?: string | null
          riforma_alla_scadenza?: boolean
          riga?: number | null
          rimborso?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          split_personalizzato?: boolean
          ssn_firma?: number
          ssn_quietanza?: number
          stato?: string
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          tacito_rinnovo?: boolean
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_incasso?: string | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          titolo_storno_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
          vincolo_attivo?: boolean
        }
        Update: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          ae_anagrafica_id?: string | null
          ae_nome?: string | null
          anagrafica_commerciale_id?: string | null
          anni_durata?: number | null
          appendice?: string | null
          appendice_modifica_polizza_madre_id?: string | null
          banca_pagamento?: string | null
          brokeraggio_firma?: number | null
          brokeraggio_quietanza?: number | null
          cambio?: number | null
          causale_estinzione?: string | null
          causale_sostituzione?: string | null
          causale_storno?: string | null
          cig_rif?: string | null
          cig_temporaneo?: boolean
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          coassicurazione?: boolean | null
          codice_rapporto?: string | null
          commerciale_id?: string | null
          comp_assicurativa?: string | null
          comp_contabile?: string | null
          compagnia_id?: string | null
          compagnia_rapporto_id?: string | null
          conferimento_gestito?: boolean | null
          conto_incasso?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_conferimento_gestito?: string | null
          data_copertura?: string | null
          data_decorrenza_rinnovo?: string | null
          data_estinzione?: string | null
          data_incasso?: string | null
          data_messa_cassa?: string | null
          data_pagamento?: string | null
          data_riattivazione?: string | null
          data_scadenza?: string | null
          data_sospensione?: string | null
          data_sostituzione?: string | null
          data_storno?: string | null
          descrizione_polizza?: string | null
          disdetta_giorni?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          emittenda?: boolean
          filiale?: string | null
          fondi_ricevuti?: boolean | null
          formato_elettronico?: boolean | null
          frazionamento?: string | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          id?: string
          id_legacy?: number | null
          importo_incassato?: number | null
          indicizzata?: boolean | null
          is_appendice_modifica?: boolean
          is_oneri_riattivazione?: boolean
          is_oneri_sospensione?: boolean
          is_proroga?: boolean
          is_regolazione?: boolean
          libro_matricola?: string | null
          limite_mora?: string | null
          limite_riattivazione?: string | null
          mora_giorni?: number | null
          motivo_estinzione?: string | null
          motivo_sospensione?: string | null
          motivo_sostituzione?: string | null
          motivo_storno?: string | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          percentuale_ae?: number
          percentuale_brokeraggio?: number | null
          percentuale_commerciale?: number | null
          percentuale_riparto?: number | null
          periodicita?: string | null
          polizza_id?: string | null
          polizza_rateo?: boolean
          polizza_temporanea?: boolean
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          prodotto_nome?: string | null
          produttore_id?: string | null
          produttore_nome?: string | null
          proroga_polizza_madre_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          quietanze_sospensione_snapshot?: Json | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          regolazione_data_presunta?: string | null
          regolazione_date_presunte?: string[] | null
          regolazione_fattore?: string | null
          regolazione_note?: string | null
          regolazione_quietanza_id?: string | null
          riforma_alla_scadenza?: boolean
          riga?: number | null
          rimborso?: boolean | null
          risk_type?: string | null
          search_vector?: unknown
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          split_personalizzato?: boolean
          ssn_firma?: number
          ssn_quietanza?: number
          stato?: string
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          tacito_rinnovo?: boolean
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_incasso?: string | null
          tipo_lettera_regolazione?: string | null
          tipo_mandatario?: string | null
          tipo_pagamento?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          titolo_storno_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
          vincolo_attivo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "titoli_ae_anagrafica_id_fkey"
            columns: ["ae_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_appendice_modifica_polizza_madre_id_fkey"
            columns: ["appendice_modifica_polizza_madre_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_appendice_modifica_polizza_madre_id_fkey"
            columns: ["appendice_modifica_polizza_madre_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_commerciale_id_fkey"
            columns: ["commerciale_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compagnia_rapporto_id_fkey"
            columns: ["compagnia_rapporto_id"]
            isOneToOne: false
            referencedRelation: "compagnia_rapporti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "titoli_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_produttore_id_fkey"
            columns: ["produttore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_proroga_polizza_madre_id_fkey"
            columns: ["proroga_polizza_madre_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_proroga_polizza_madre_id_fkey"
            columns: ["proroga_polizza_madre_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_quietanza_id_fkey"
            columns: ["regolazione_quietanza_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_quietanza_id_fkey"
            columns: ["regolazione_quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_titolo_storno_id_fkey"
            columns: ["titolo_storno_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_titolo_storno_id_fkey"
            columns: ["titolo_storno_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_compensazioni: {
        Row: {
          causale_codice: string
          causale_descrizione: string
          causale_id: string
          created_at: string
          creato_da: string | null
          id: string
          importo: number
          note: string | null
          segno: string
          titolo_id: string
          updated_at: string
        }
        Insert: {
          causale_codice: string
          causale_descrizione: string
          causale_id: string
          created_at?: string
          creato_da?: string | null
          id?: string
          importo: number
          note?: string | null
          segno: string
          titolo_id: string
          updated_at?: string
        }
        Update: {
          causale_codice?: string
          causale_descrizione?: string
          causale_id?: string
          created_at?: string
          creato_da?: string | null
          id?: string
          importo?: number
          note?: string | null
          segno?: string
          titolo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "titoli_compensazioni_causale_id_fkey"
            columns: ["causale_id"]
            isOneToOne: false
            referencedRelation: "causali_contabili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compensazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compensazioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_eventi_snapshot: {
        Row: {
          created_by: string | null
          evento_at: string
          id: string
          payload_jsonb: Json
          tipo_evento: string
          titolo_id: string
        }
        Insert: {
          created_by?: string | null
          evento_at?: string
          id?: string
          payload_jsonb: Json
          tipo_evento: string
          titolo_id: string
        }
        Update: {
          created_by?: string | null
          evento_at?: string
          id?: string
          payload_jsonb?: Json
          tipo_evento?: string
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "titoli_eventi_snapshot_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_eventi_snapshot_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_garanzia_legacy_backup: {
        Row: {
          data_scadenza: string | null
          eseguito_at: string
          eseguito_da: string | null
          garanzia_a_new: string | null
          garanzia_a_old: string | null
          id: string
          motivo: string
          titolo_id: string
        }
        Insert: {
          data_scadenza?: string | null
          eseguito_at?: string
          eseguito_da?: string | null
          garanzia_a_new?: string | null
          garanzia_a_old?: string | null
          id?: string
          motivo: string
          titolo_id: string
        }
        Update: {
          data_scadenza?: string | null
          eseguito_at?: string
          eseguito_da?: string | null
          garanzia_a_new?: string | null
          garanzia_a_old?: string | null
          id?: string
          motivo?: string
          titolo_id?: string
        }
        Relationships: []
      }
      titoli_modalita_incasso: {
        Row: {
          anagrafica_commerciale_id: string | null
          annullata_da: string | null
          annullata_il: string | null
          applicata_da: string | null
          applicata_il: string
          created_at: string
          id: string
          importo_dovuto_lordo: number | null
          importo_provvigione_lorda: number | null
          importo_ra: number | null
          importo_trattenuto_netto: number | null
          importo_versato_consul: number | null
          modalita: string
          note: string | null
          stato: string
          titolo_id: string
          updated_at: string
        }
        Insert: {
          anagrafica_commerciale_id?: string | null
          annullata_da?: string | null
          annullata_il?: string | null
          applicata_da?: string | null
          applicata_il?: string
          created_at?: string
          id?: string
          importo_dovuto_lordo?: number | null
          importo_provvigione_lorda?: number | null
          importo_ra?: number | null
          importo_trattenuto_netto?: number | null
          importo_versato_consul?: number | null
          modalita?: string
          note?: string | null
          stato?: string
          titolo_id: string
          updated_at?: string
        }
        Update: {
          anagrafica_commerciale_id?: string | null
          annullata_da?: string | null
          annullata_il?: string | null
          applicata_da?: string | null
          applicata_il?: string
          created_at?: string
          id?: string
          importo_dovuto_lordo?: number | null
          importo_provvigione_lorda?: number | null
          importo_ra?: number | null
          importo_trattenuto_netto?: number | null
          importo_versato_consul?: number | null
          modalita?: string
          note?: string | null
          stato?: string
          titolo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "titoli_modalita_incasso_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_modalita_incasso_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_modalita_incasso_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_numeri_storici: {
        Row: {
          cambiato_da_user_id: string | null
          cambiato_il: string
          causale: string
          created_at: string
          id: string
          motivo: string | null
          numero_nuovo: string
          numero_precedente: string
          riferimento_id: string | null
          titolo_id: string
        }
        Insert: {
          cambiato_da_user_id?: string | null
          cambiato_il?: string
          causale: string
          created_at?: string
          id?: string
          motivo?: string | null
          numero_nuovo: string
          numero_precedente: string
          riferimento_id?: string | null
          titolo_id: string
        }
        Update: {
          cambiato_da_user_id?: string | null
          cambiato_il?: string
          causale?: string
          created_at?: string
          id?: string
          motivo?: string | null
          numero_nuovo?: string
          numero_precedente?: string
          riferimento_id?: string | null
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "titoli_numeri_storici_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_numeri_storici_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_proroghe: {
        Row: {
          created_at: string
          created_by: string | null
          data_proroga: string
          id: string
          note: string | null
          periodo_a: string | null
          periodo_da: string | null
          premio_lordo: number
          titolo_madre_id: string
          titolo_proroga_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_proroga: string
          id?: string
          note?: string | null
          periodo_a?: string | null
          periodo_da?: string | null
          premio_lordo?: number
          titolo_madre_id: string
          titolo_proroga_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_proroga?: string
          id?: string
          note?: string | null
          periodo_a?: string | null
          periodo_da?: string | null
          premio_lordo?: number
          titolo_madre_id?: string
          titolo_proroga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_proroghe_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_proroghe_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_proroghe_titolo_proroga_id_fkey"
            columns: ["titolo_proroga_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_proroghe_titolo_proroga_id_fkey"
            columns: ["titolo_proroga_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_regolazione_fattori: {
        Row: {
          anno: number
          created_at: string | null
          data_presunta: string | null
          fattore_id: string
          id: string
          importo_esposto: number
          note: string | null
          ramo_id: string
          titolo_id: string
          updated_at: string | null
        }
        Insert: {
          anno: number
          created_at?: string | null
          data_presunta?: string | null
          fattore_id: string
          id?: string
          importo_esposto?: number
          note?: string | null
          ramo_id: string
          titolo_id: string
          updated_at?: string | null
        }
        Update: {
          anno?: number
          created_at?: string | null
          data_presunta?: string | null
          fattore_id?: string
          id?: string
          importo_esposto?: number
          note?: string | null
          ramo_id?: string
          titolo_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_regolazione_fattori_fattore_id_fkey"
            columns: ["fattore_id"]
            isOneToOne: false
            referencedRelation: "fattori_regolazione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_fattori_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_fattori_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_fattori_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_regolazioni: {
        Row: {
          conguaglio_premio: number
          created_at: string
          created_by: string | null
          data_regolazione: string
          documento_id: string | null
          id: string
          imponibile_consuntivo: number | null
          note: string | null
          periodo_a: string | null
          periodo_da: string | null
          quietanza_riferimento_id: string | null
          titolo_madre_id: string
          titolo_regolazione_id: string | null
        }
        Insert: {
          conguaglio_premio?: number
          created_at?: string
          created_by?: string | null
          data_regolazione: string
          documento_id?: string | null
          id?: string
          imponibile_consuntivo?: number | null
          note?: string | null
          periodo_a?: string | null
          periodo_da?: string | null
          quietanza_riferimento_id?: string | null
          titolo_madre_id: string
          titolo_regolazione_id?: string | null
        }
        Update: {
          conguaglio_premio?: number
          created_at?: string
          created_by?: string | null
          data_regolazione?: string
          documento_id?: string | null
          id?: string
          imponibile_consuntivo?: number | null
          note?: string | null
          periodo_a?: string | null
          periodo_da?: string | null
          quietanza_riferimento_id?: string | null
          titolo_madre_id?: string
          titolo_regolazione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_regolazioni_quietanza_riferimento_id_fkey"
            columns: ["quietanza_riferimento_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazioni_quietanza_riferimento_id_fkey"
            columns: ["quietanza_riferimento_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazioni_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazioni_titolo_madre_id_fkey"
            columns: ["titolo_madre_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazioni_titolo_regolazione_id_fkey"
            columns: ["titolo_regolazione_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazioni_titolo_regolazione_id_fkey"
            columns: ["titolo_regolazione_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_sostituzioni: {
        Row: {
          causale: string | null
          conguaglio: number | null
          created_at: string
          created_by: string | null
          data_sostituzione: string
          id: string
          motivo: string | null
          parametri_nuovi: Json
          parametri_precedenti: Json
          polizza_id: string | null
          polizza_sostituta_id: string | null
          titolo_conguaglio_id: string | null
          titolo_id: string
        }
        Insert: {
          causale?: string | null
          conguaglio?: number | null
          created_at?: string
          created_by?: string | null
          data_sostituzione: string
          id?: string
          motivo?: string | null
          parametri_nuovi?: Json
          parametri_precedenti?: Json
          polizza_id?: string | null
          polizza_sostituta_id?: string | null
          titolo_conguaglio_id?: string | null
          titolo_id: string
        }
        Update: {
          causale?: string | null
          conguaglio?: number | null
          created_at?: string
          created_by?: string | null
          data_sostituzione?: string
          id?: string
          motivo?: string | null
          parametri_nuovi?: Json
          parametri_precedenti?: Json
          polizza_id?: string | null
          polizza_sostituta_id?: string | null
          titolo_conguaglio_id?: string | null
          titolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "titoli_sostituzioni_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_polizza_sostituta_id_fkey"
            columns: ["polizza_sostituta_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_polizza_sostituta_id_fkey"
            columns: ["polizza_sostituta_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_titolo_conguaglio_id_fkey"
            columns: ["titolo_conguaglio_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_titolo_conguaglio_id_fkey"
            columns: ["titolo_conguaglio_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_sostituzioni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_split_commerciali: {
        Row: {
          anagrafica_commerciale_id: string
          commerciale_user_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          ordine: number
          percentuale: number
          titolo_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anagrafica_commerciale_id: string
          commerciale_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          ordine?: number
          percentuale: number
          titolo_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anagrafica_commerciale_id?: string
          commerciale_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          ordine?: number
          percentuale?: number
          titolo_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_split_commerciali_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_split_commerciali_commerciale_user_id_fkey"
            columns: ["commerciale_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_split_commerciali_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_split_commerciali_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      titoli_storni: {
        Row: {
          causale: string | null
          created_at: string
          created_by: string | null
          data_storno: string
          documento_id: string | null
          era_messa_cassa: boolean | null
          id: string
          importo_rimborsato: number | null
          motivo: string | null
          polizza_id: string | null
          titolo_id: string
          titolo_storno_id: string | null
        }
        Insert: {
          causale?: string | null
          created_at?: string
          created_by?: string | null
          data_storno: string
          documento_id?: string | null
          era_messa_cassa?: boolean | null
          id?: string
          importo_rimborsato?: number | null
          motivo?: string | null
          polizza_id?: string | null
          titolo_id: string
          titolo_storno_id?: string | null
        }
        Update: {
          causale?: string | null
          created_at?: string
          created_by?: string | null
          data_storno?: string
          documento_id?: string | null
          era_messa_cassa?: boolean | null
          id?: string
          importo_rimborsato?: number | null
          motivo?: string | null
          polizza_id?: string | null
          titolo_id?: string
          titolo_storno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_storni_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "polizze"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_storni_polizza_id_fkey"
            columns: ["polizza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_quietanze"
            referencedColumns: ["polizza_id"]
          },
          {
            foreignKeyName: "titoli_storni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_storni_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_storni_titolo_storno_id_fkey"
            columns: ["titolo_storno_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_storni_titolo_storno_id_fkey"
            columns: ["titolo_storno_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      trattativa_documenti: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          nome_file: string
          note: string | null
          tipo_documento: string | null
          trattativa_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          nome_file: string
          note?: string | null
          tipo_documento?: string | null
          trattativa_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          nome_file?: string
          note?: string | null
          tipo_documento?: string | null
          trattativa_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trattativa_documenti_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattativa_documenti_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trattativa_eventi: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_evento: string | null
          descrizione: string
          dettagli_json: Json | null
          id: string
          tipo_evento: string
          trattativa_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_evento?: string | null
          descrizione: string
          dettagli_json?: Json | null
          id?: string
          tipo_evento?: string
          trattativa_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_evento?: string | null
          descrizione?: string
          dettagli_json?: Json | null
          id?: string
          tipo_evento?: string
          trattativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trattativa_eventi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattativa_eventi_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
        ]
      }
      trattativa_scadenze: {
        Row: {
          completata: boolean | null
          created_at: string | null
          created_by: string | null
          data_scadenza: string
          id: string
          note: string | null
          titolo: string
          trattativa_id: string
        }
        Insert: {
          completata?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data_scadenza: string
          id?: string
          note?: string | null
          titolo: string
          trattativa_id: string
        }
        Update: {
          completata?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data_scadenza?: string
          id?: string
          note?: string | null
          titolo?: string
          trattativa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trattativa_scadenze_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattativa_scadenze_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
        ]
      }
      trattative: {
        Row: {
          archiviata: boolean | null
          assegnato_a: string | null
          cliente_id: string | null
          compagnia: string | null
          compagnia_id: string | null
          created_at: string | null
          created_by: string | null
          data_apertura: string | null
          data_chiusura: string | null
          data_scadenza: string | null
          fonte: string | null
          id: string
          motivo_chiusura: string | null
          note: string | null
          premio_effettivo: number | null
          premio_previsto: number | null
          priorita: string | null
          prodotto: string | null
          prospect_id: string | null
          ramo_id: string | null
          sottoprodotto: string | null
          stato: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          archiviata?: boolean | null
          assegnato_a?: string | null
          cliente_id?: string | null
          compagnia?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_apertura?: string | null
          data_chiusura?: string | null
          data_scadenza?: string | null
          fonte?: string | null
          id?: string
          motivo_chiusura?: string | null
          note?: string | null
          premio_effettivo?: number | null
          premio_previsto?: number | null
          priorita?: string | null
          prodotto?: string | null
          prospect_id?: string | null
          ramo_id?: string | null
          sottoprodotto?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archiviata?: boolean | null
          assegnato_a?: string | null
          cliente_id?: string | null
          compagnia?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_apertura?: string | null
          data_chiusura?: string | null
          data_scadenza?: string | null
          fonte?: string | null
          id?: string
          motivo_chiusura?: string | null
          note?: string | null
          premio_effettivo?: number | null
          premio_previsto?: number | null
          priorita?: string | null
          prodotto?: string | null
          prospect_id?: string | null
          ramo_id?: string | null
          sottoprodotto?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trattative_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      uffici: {
        Row: {
          attivo: boolean | null
          banca: string | null
          cap: string | null
          citta: string | null
          codice_ufficio: string | null
          conto_bancario_id: string | null
          conto_incasso_id: string | null
          created_at: string | null
          email: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestato_a: string | null
          nome_ufficio: string
          provincia: string | null
          telefono: string | null
        }
        Insert: {
          attivo?: boolean | null
          banca?: string | null
          cap?: string | null
          citta?: string | null
          codice_ufficio?: string | null
          conto_bancario_id?: string | null
          conto_incasso_id?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          nome_ufficio: string
          provincia?: string | null
          telefono?: string | null
        }
        Update: {
          attivo?: boolean | null
          banca?: string | null
          cap?: string | null
          citta?: string | null
          codice_ufficio?: string | null
          conto_bancario_id?: string | null
          conto_incasso_id?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          nome_ufficio?: string
          provincia?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uffici_conto_bancario_id_fkey"
            columns: ["conto_bancario_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uffici_conto_incasso_id_fkey"
            columns: ["conto_incasso_id"]
            isOneToOne: false
            referencedRelation: "conti_bancari"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_rate_limit: {
        Row: {
          conteggio: number
          id: string
          ora_riferimento: string
          user_id: string
        }
        Insert: {
          conteggio?: number
          id?: string
          ora_riferimento?: string
          user_id: string
        }
        Update: {
          conteggio?: number
          id?: string
          ora_riferimento?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veicoli_marche: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          nome: string
          popolare: boolean
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome: string
          popolare?: boolean
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome?: string
          popolare?: boolean
        }
        Relationships: []
      }
      veicoli_modelli: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          marca_id: string
          nome: string
          popolare: boolean
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          marca_id: string
          nome: string
          popolare?: boolean
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          marca_id?: string
          nome?: string
          popolare?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_modelli_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "veicoli_marche"
            referencedColumns: ["id"]
          },
        ]
      }
      veicoli_polizza: {
        Row: {
          anno_acquisto: number | null
          carico_scarico: boolean | null
          cc: number | null
          classe_bm: string | null
          competizione: boolean | null
          created_at: string | null
          cv: number | null
          data_immatricolazione: string | null
          franchigia: number | null
          id: string
          kw: number | null
          marca: string | null
          massimale_1: number | null
          massimale_2: number | null
          massimale_3: number | null
          modello: string | null
          peius: boolean | null
          peso_motrice: number | null
          peso_rimorchio: number | null
          peso_totale: number | null
          posti: number | null
          provincia_circolazione: string | null
          rimorchio: boolean | null
          settore: string | null
          targa: string | null
          telaio: string | null
          temporanea: boolean | null
          tipo_alimentazione: string | null
          tipo_veicolo: string | null
          tipologia_guida: string | null
          titolo_id: string
          updated_at: string | null
          uso: string | null
          veicolo_descrizione: string | null
          versione: string | null
        }
        Insert: {
          anno_acquisto?: number | null
          carico_scarico?: boolean | null
          cc?: number | null
          classe_bm?: string | null
          competizione?: boolean | null
          created_at?: string | null
          cv?: number | null
          data_immatricolazione?: string | null
          franchigia?: number | null
          id?: string
          kw?: number | null
          marca?: string | null
          massimale_1?: number | null
          massimale_2?: number | null
          massimale_3?: number | null
          modello?: string | null
          peius?: boolean | null
          peso_motrice?: number | null
          peso_rimorchio?: number | null
          peso_totale?: number | null
          posti?: number | null
          provincia_circolazione?: string | null
          rimorchio?: boolean | null
          settore?: string | null
          targa?: string | null
          telaio?: string | null
          temporanea?: boolean | null
          tipo_alimentazione?: string | null
          tipo_veicolo?: string | null
          tipologia_guida?: string | null
          titolo_id: string
          updated_at?: string | null
          uso?: string | null
          veicolo_descrizione?: string | null
          versione?: string | null
        }
        Update: {
          anno_acquisto?: number | null
          carico_scarico?: boolean | null
          cc?: number | null
          classe_bm?: string | null
          competizione?: boolean | null
          created_at?: string | null
          cv?: number | null
          data_immatricolazione?: string | null
          franchigia?: number | null
          id?: string
          kw?: number | null
          marca?: string | null
          massimale_1?: number | null
          massimale_2?: number | null
          massimale_3?: number | null
          modello?: string | null
          peius?: boolean | null
          peso_motrice?: number | null
          peso_rimorchio?: number | null
          peso_totale?: number | null
          posti?: number | null
          provincia_circolazione?: string | null
          rimorchio?: boolean | null
          settore?: string | null
          targa?: string | null
          telaio?: string | null
          temporanea?: boolean | null
          tipo_alimentazione?: string | null
          tipo_veicolo?: string | null
          tipologia_guida?: string | null
          titolo_id?: string
          updated_at?: string | null
          uso?: string | null
          veicolo_descrizione?: string | null
          versione?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veicoli_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: true
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veicoli_polizza_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: true
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veicoli_polizza_uso_fkey"
            columns: ["uso"]
            isOneToOne: false
            referencedRelation: "rca_usi"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cfo_kpi_mensili: {
        Row: {
          entrate: number | null
          ko_banca: number | null
          mese: string | null
          premi_incassati: number | null
          provvigioni_generate: number | null
          provvigioni_pagate: number | null
          saldo: number | null
          sinistri_aperti: number | null
          ufficio_id: string | null
          uscite: number | null
        }
        Relationships: []
      }
      v_portafoglio_quietanze: {
        Row: {
          addizionali: number | null
          ae_anagrafica_id: string | null
          ae_nome: string | null
          anagrafica_commerciale_id: string | null
          appendice_corrente: string | null
          appendice_modifica_polizza_madre_id: string | null
          appendice_tipo: string | null
          cig_rif: string | null
          cliente_anagrafica_id: string | null
          cliente_codice: string | null
          cliente_nome_display: string | null
          compagnia_id: string | null
          compagnia_nome: string | null
          conferimento_gestito: boolean | null
          data_competenza: string | null
          data_copertura: string | null
          data_decorrenza_rinnovo: string | null
          data_incasso: string | null
          data_messa_cassa: string | null
          data_pagamento: string | null
          data_riattivazione: string | null
          data_scadenza: string | null
          data_sospensione: string | null
          descrizione_polizza: string | null
          durata_a: string | null
          durata_da: string | null
          fondi_ricevuti: boolean | null
          frazionamento: string | null
          garanzia_a: string | null
          garanzia_da: string | null
          id: string | null
          importo_incassato: number | null
          is_appendice_modifica: boolean | null
          is_proroga: boolean | null
          is_regolazione: boolean | null
          limite_riattivazione: string | null
          numero_polizza_snapshot: string | null
          numero_rata: number | null
          numero_rate_totali: number | null
          numero_titolo: string | null
          polizza_id: string | null
          premio_lordo: number | null
          premio_netto: number | null
          produttore_id: string | null
          produttore_nome: string | null
          produttori_display: string | null
          proroga_polizza_madre_id: string | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          quietanza_id: string | null
          ramo_codice: string | null
          ramo_id: string | null
          ramo_nome: string | null
          rate: number | null
          regolazione: boolean | null
          regolazione_quietanza_id: string | null
          sostituisce_polizza: string | null
          specialist: string | null
          ssn: number | null
          stato: string | null
          stato_polizza: Database["public"]["Enums"]["polizza_stato"] | null
          stato_quietanza: Database["public"]["Enums"]["quietanza_stato"] | null
          tacito_rinnovo: boolean | null
          targa_telaio: string | null
          tasse: number | null
          tipo_portafoglio: string | null
          titolo_derivato_numero: string | null
          titolo_legacy_id: string | null
          ufficio_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polizze_account_executive_anagrafica_id_fkey"
            columns: ["ae_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_produttore_anagrafica_id_fkey"
            columns: ["produttore_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polizze_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quietanze_titolo_id_fkey"
            columns: ["titolo_legacy_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quietanze_titolo_id_fkey"
            columns: ["titolo_legacy_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      v_portafoglio_titoli: {
        Row: {
          addizionali: number | null
          addizionali_quietanza: number | null
          ae_nome: string | null
          anagrafica_commerciale_id: string | null
          anni_durata: number | null
          appendice: string | null
          banca_pagamento: string | null
          cambio: number | null
          cig_rif: string | null
          cliente_anagrafica_id: string | null
          cliente_codice: string | null
          cliente_codice_fiscale: string | null
          cliente_cognome: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_nome_display: string | null
          cliente_partita_iva: string | null
          cliente_ragione_sociale: string | null
          cliente_tipo: string | null
          commerciale_id: string | null
          comp_assicurativa: string | null
          comp_contabile: string | null
          compagnia_codice: string | null
          compagnia_id: string | null
          compagnia_nome: string | null
          conferimento_gestito: boolean | null
          conto_incasso: string | null
          created_at: string | null
          data_competenza: string | null
          data_conferimento_gestito: string | null
          data_decorrenza_rinnovo: string | null
          data_incasso: string | null
          data_messa_cassa: string | null
          data_pagamento: string | null
          data_riattivazione: string | null
          data_scadenza: string | null
          data_sospensione: string | null
          descrizione_polizza: string | null
          disdetta_giorni: number | null
          durata_a: string | null
          durata_da: string | null
          emissione_fee: boolean | null
          filiale: string | null
          fine_periodo_effettivo: string | null
          fondi_ricevuti: boolean | null
          formato_elettronico: boolean | null
          garanzia_a: string | null
          garanzia_da: string | null
          giorni_presentazione: number | null
          gruppo_ramo: string | null
          gruppo_ramo_descrizione: string | null
          gruppo_ramo_id: string | null
          id: string | null
          id_legacy: number | null
          importo_incassato: number | null
          indicizzata: boolean | null
          is_regolazione: boolean | null
          libro_matricola: string | null
          limite_mora: string | null
          limite_riattivazione: string | null
          mese_carico: string | null
          mora_giorni: number | null
          motivo_sospensione: string | null
          no_calcolo_tasse: boolean | null
          nome_ufficio: string | null
          note: string | null
          numero_titolo: string | null
          pag_diretto_compagnia: boolean | null
          percentuale_commerciale: number | null
          percentuale_riparto: number | null
          periodicita: string | null
          premi_modificabili: boolean | null
          premio_lordo: number | null
          premio_netto: number | null
          premio_netto_quietanza: number | null
          prodotto_id: string | null
          prodotto_nome: string | null
          produttore_id: string | null
          produttore_nome: string | null
          prossima_garanzia_a: string | null
          prossima_garanzia_da: string | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          ramo_codice: string | null
          ramo_descrizione: string | null
          ramo_id: string | null
          ramo_nome: string | null
          rate: number | null
          regolazione: boolean | null
          regolazione_quietanza_id: string | null
          riga: number | null
          rimborso: boolean | null
          risk_type: string | null
          search_vector: unknown
          sostituisce_appendice: string | null
          sostituisce_polizza: string | null
          sostituisce_riga: number | null
          specialist: string | null
          stato: string | null
          storno_appendice: string | null
          storno_polizza: string | null
          storno_riga: number | null
          tacito_rinnovo: boolean | null
          targa_telaio: string | null
          tasse: number | null
          tasse_quietanza: number | null
          tipo_incasso: string | null
          tipo_lettera_regolazione: string | null
          tipo_mandatario: string | null
          tipo_pagamento: string | null
          tipo_portafoglio: string | null
          tipo_rinnovo: string | null
          tipo_scadenza: string | null
          ufficio_id: string | null
          ufficio_nome: string | null
          updated_at: string | null
          valuta: string | null
          vincolo: string | null
          vincolo_attivo: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_anagrafica_commerciale_id_fkey"
            columns: ["anagrafica_commerciale_id"]
            isOneToOne: false
            referencedRelation: "anagrafiche_professionali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_commerciale_id_fkey"
            columns: ["commerciale_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_produttore_id_fkey"
            columns: ["produttore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_quietanza_id_fkey"
            columns: ["regolazione_quietanza_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_regolazione_quietanza_id_fkey"
            columns: ["regolazione_quietanza_id"]
            isOneToOne: false
            referencedRelation: "v_portafoglio_titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      v_storico_gare: {
        Row: {
          anno_riferimento: number | null
          broker_incumbent: string | null
          categoria_ente: string | null
          cliente_display: string | null
          cliente_id: string | null
          cliente_ragione_sociale: string | null
          contatto_riferimento: string | null
          contatto_telefono: string | null
          created_at: string | null
          created_by: string | null
          data_consegna: string | null
          data_fine_mandato: string | null
          data_inizio_mandato: string | null
          ente_nome: string | null
          esito: string | null
          flag_accesso_atti: boolean | null
          flag_cauzione: boolean | null
          flag_offerta_tecnica: boolean | null
          flag_referenze_bancarie: boolean | null
          id: string | null
          note: string | null
          opzione_rinnovo: string | null
          opzione_rinnovo_anni: number | null
          pagine_offerta_tecnica: string | null
          provincia: string | null
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          stato_mandato: string | null
          tipologia: string | null
          trattativa_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_gare_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_gare_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_gare_trattativa_id_fkey"
            columns: ["trattativa_id"]
            isOneToOne: false
            referencedRelation: "trattative"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _elimina_titoli_finanziari: { Args: { p_ids: string[] }; Returns: Json }
      _scollega_riferimenti_titoli: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      _titoli_chain_ids: { Args: { p_titolo_id: string }; Returns: string[] }
      admin_set_sede_profile: {
        Args: {
          p_cognome: string
          p_email: string
          p_nome: string
          p_permessi: Json
          p_ufficio_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      aggiorna_prescrizioni_scadute: { Args: never; Returns: number }
      ai_describe_table: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
        }[]
      }
      ai_exec_select: { Args: { query_text: string }; Returns: Json }
      ai_list_enum_values: {
        Args: { p_column: string; p_table: string }
        Returns: {
          occorrenze: number
          valore: string
        }[]
      }
      ai_user_briefing: { Args: never; Returns: Json }
      annulla_bonifico_collegato: {
        Args: { p_movimento_id: string }
        Returns: Json
      }
      annulla_polizza_cascade: { Args: { p_titolo_id: string }; Returns: Json }
      annulla_quietanza_incasso: {
        Args: { p_titolo_id: string }
        Returns: Json
      }
      archivia_notifiche_vecchie: { Args: never; Returns: Json }
      calc_lordo_riga_premio_garanzia: {
        Args: {
          p_accessori: number
          p_aliquota_tasse_pct: number
          p_diritti_agenzia?: boolean
          p_firma: number
          p_rata: number
          p_ssn: number
          p_tasse_rettifica: number
          p_tipo_premio: string
        }
        Returns: number
      }
      cerca_ec_agenzia_storico: {
        Args: {
          p_cliente?: string
          p_compagnia_id?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_polizza?: string
          p_q?: string
          p_riferimento?: string
        }
        Returns: Json
      }
      cfo_distribuzione_clienti_fascia: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_distribuzione_stati: { Args: { _ufficio_id?: string }; Returns: Json }
      cfo_drill_sinistri: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _ramo?: string
          _stato?: string
          _ufficio_id?: string
        }
        Returns: {
          cliente: string
          compagnia: string
          data_apertura: string
          data_evento: string
          id: string
          importo_liquidato: number
          importo_riserva: number
          numero_sinistro: string
          ramo: string
          sede: string
          stato: string
        }[]
      }
      cfo_drill_titoli: {
        Args: {
          _cliente_id?: string
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _mese?: string
          _produttore_nome?: string
          _ramo?: string
          _stato?: string
          _ufficio_id?: string
        }
        Returns: {
          cliente: string
          cliente_id: string
          compagnia: string
          data_incasso: string
          id: string
          importo_incassato: number
          numero_titolo: string
          premio_lordo: number
          produttore: string
          provvigioni: number
          ramo: string
          sede: string
          stato: string
        }[]
      }
      cfo_entrate_uscite_mensili: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_eta_sinistri_aperti: { Args: never; Returns: Json }
      cfo_kpi:
        | {
            Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
            Returns: Json
          }
        | {
            Args: {
              _compagnia_id?: string
              _data_a?: string
              _data_da?: string
              _produttore_nome?: string
              _ufficio_id?: string
            }
            Returns: Json
          }
      cfo_loss_ratio_ramo: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_matrice_produttore_ramo: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_matrice_sede_compagnia: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_premi_per_compagnia:
        | { Args: { _data_a?: string; _data_da?: string }; Returns: Json }
        | {
            Args: {
              _compagnia_id?: string
              _data_a?: string
              _data_da?: string
              _produttore_nome?: string
              _ufficio_id?: string
            }
            Returns: Json
          }
      cfo_premi_per_produttore: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      cfo_premi_per_ramo: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _produttore_nome?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      cfo_premio_medio_compagnia: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_premio_medio_ramo: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      cfo_provvigioni_mensili: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_provvigioni_non_pagate: { Args: never; Returns: Json }
      cfo_redditivita_ufficio: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_report_titoli:
        | {
            Args: {
              _compagnia_id?: string
              _data_a?: string
              _data_da?: string
              _produttore_id?: string
              _ufficio_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _compagnia_id?: string
              _data_a?: string
              _data_da?: string
              _produttore_nome?: string
              _ufficio_id?: string
            }
            Returns: Json
          }
      cfo_sinistri_per_compagnia: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_top_clienti: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _limit?: number
          _ufficio_id?: string
        }
        Returns: Json
      }
      cfo_trend_mensile: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _produttore_nome?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      cfo_yoy_mensile: {
        Args: { _compagnia_id?: string; _ufficio_id?: string }
        Returns: Json
      }
      check_consenso_marketing: {
        Args: { _cliente_id: string }
        Returns: boolean
      }
      clear_data_copertura_polizza_madre: {
        Args: { p_titolo_id: string }
        Returns: undefined
      }
      clone_premi_rateo_su_quietanze: {
        Args: { p_madre_id: string }
        Returns: undefined
      }
      copy_titoli_split_commerciali: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      count_polizze_per_cliente: {
        Args: never
        Returns: {
          cliente_id: string
          count: number
        }[]
      }
      crea_appendice_incasso: {
        Args: {
          p_addizionali: number
          p_allegati: Json
          p_created_by: string
          p_data_effetto: string
          p_data_scadenza: string
          p_file_path: string
          p_garanzie: Json
          p_nome_file: string
          p_note: string
          p_numero_appendice: string
          p_oggetto: string
          p_percentuale_provvigione: number
          p_premio_lordo: number
          p_premio_netto: number
          p_provvigioni: number
          p_quietanza_id: string
          p_ssn: number
          p_tasse: number
          p_tipo: string
          p_titolo_id: string
        }
        Returns: Json
      }
      crea_titolo_da_modifica: {
        Args: { p_appendice_id: string }
        Returns: string
      }
      crea_titolo_da_proroga: {
        Args: { p_appendice_id: string }
        Returns: string
      }
      crea_titolo_da_regolazione: {
        Args: { p_appendice_id: string }
        Returns: string
      }
      current_ufficio_id: { Args: never; Returns: string }
      elimina_polizza_cascade: { Args: { p_titolo_id: string }; Returns: Json }
      elimina_quietanza_cascade: {
        Args: { p_titolo_id: string }
        Returns: Json
      }
      ensure_default_rapporto: {
        Args: { _compagnia_id: string }
        Returns: string
      }
      find_clienti_duplicati: {
        Args: never
        Returns: {
          attivo: boolean
          cliente_id: string
          cluster_key: string
          codice_fiscale: string
          confidenza: string
          created_at: string
          match_type: string
          merged_into: string
          nome_completo: string
          num_documenti: number
          num_polizze: number
          num_sinistri: number
          partita_iva: string
          tipo_cliente: string
        }[]
      }
      fn_backfill_madre_incassata_crea_rata1: {
        Args: { p_madre_id: string }
        Returns: string
      }
      fn_collega_quietanza_appendice: {
        Args: { p_titolo_id: string }
        Returns: string
      }
      fn_polizza_genera_quietanze: {
        Args: { _polizza_id: string }
        Returns: number
      }
      fn_rate_per_anno: { Args: { frazionamento: string }; Returns: number }
      fn_rigenera_provvigioni_generate: {
        Args: { p_titolo_id: string }
        Returns: number
      }
      fn_risolvi_polizza_da_titolo_madre: {
        Args: { p_madre_id: string }
        Returns: string
      }
      format_cig_temporaneo: { Args: { p_n: number }; Returns: string }
      format_numero_emittenda: { Args: { p_n: number }; Returns: string }
      garanzie_chat_assert_owner_consultazione: {
        Args: { p_conv_id: string; p_email: string }
        Returns: undefined
      }
      garanzie_chat_create_consultazione: {
        Args: {
          p_compagnia?: string
          p_email: string
          p_prodotto_cga_id?: string
          p_ramo?: string
          p_tipo: string
          p_titolo: string
        }
        Returns: string
      }
      garanzie_chat_delete_consultazione: {
        Args: { p_conversazione_id: string; p_email: string }
        Returns: undefined
      }
      garanzie_chat_insert_msg_consultazione: {
        Args: {
          p_content: string
          p_conversazione_id: string
          p_email: string
          p_fonti?: Json
          p_role: string
        }
        Returns: string
      }
      garanzie_chat_list_messages_consultazione: {
        Args: { p_conversazione_id: string; p_email: string }
        Returns: {
          content: string
          conversazione_id: string
          created_at: string
          fonti: Json | null
          id: string
          role: string
        }[]
        SetofOptions: {
          from: "*"
          to: "garanzie_chat_messaggi"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      garanzie_chat_list_mie_consultazione: {
        Args: { p_email: string; p_tipo: string }
        Returns: {
          autore_email: string | null
          compagnia: string | null
          condivisa: boolean
          condivisa_at: string | null
          created_at: string
          id: string
          prodotto_cga_id: string | null
          ramo: string | null
          tags: string[] | null
          tipo: string
          titolo: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "garanzie_chat_conversazioni"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      garanzie_chat_share_consultazione: {
        Args: { p_conversazione_id: string; p_email: string }
        Returns: undefined
      }
      garanzie_chat_touch_consultazione: {
        Args: { p_conversazione_id: string; p_email: string; p_titolo?: string }
        Returns: undefined
      }
      generate_codice_cliente: { Args: never; Returns: string }
      get_canali_cliente_with_meta: {
        Args: { _limit?: number; _offset?: number; _user_id: string }
        Returns: {
          ambito: string
          created_at: string
          entita_id: string
          entita_tipo: string
          id: string
          last_message_at: string
          last_message_preview: string
          nome: string
          unread_count: number
          visibile_cliente: boolean
        }[]
      }
      get_canali_staff_with_meta: {
        Args: {
          _ambito: string
          _limit?: number
          _offset?: number
          _user_id: string
        }
        Returns: {
          ambito: string
          created_at: string
          entita_id: string
          entita_tipo: string
          id: string
          last_message_at: string
          last_message_preview: string
          nome: string
          tipo: string
          unread_count: number
          visibile_cliente: boolean
        }[]
      }
      get_chat_unread_count: { Args: { _user_id: string }; Returns: number }
      get_iban_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          banca: string
          bic: string
          fonte: string
          iban: string
          intestato_a: string
        }[]
      }
      get_my_cliente_ids: { Args: never; Returns: string[] }
      get_my_ufficio_id: { Args: never; Returns: string }
      get_my_ufficio_ids: { Args: never; Returns: string[] }
      get_rapporti_counts_per_compagnia: {
        Args: never
        Returns: {
          attivi: number
          compagnia_id: string
          tot: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      is_channel_member: {
        Args: { _canale_id: string; _user_id: string }
        Returns: boolean
      }
      is_consultazione_email_allowed: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_documentale_staff: { Args: never; Returns: boolean }
      is_global_viewer: { Args: never; Returns: boolean }
      log_consultazione_accesso: {
        Args: {
          p_disclaimer_version: string
          p_email: string
          p_user_agent?: string
        }
        Returns: Json
      }
      log_consultazione_ricerca: {
        Args: { p_email: string; p_percorso?: string; p_query: string }
        Returns: Json
      }
      mark_canale_as_read: { Args: { _canale_id: string }; Returns: undefined }
      merge_cliente_atomico: {
        Args: { _legacy_id: string; _master_id: string }
        Returns: Json
      }
      next_cig_temporaneo: { Args: never; Returns: string }
      next_numero_emittenda: { Args: never; Returns: string }
      prossimo_riferimento_ec: {
        Args: {
          p_codice: string
          p_entita_id: string
          p_incrementa?: boolean
          p_mese?: string
          p_tipo: string
        }
        Returns: Json
      }
      refresh_cfo_kpi: { Args: never; Returns: undefined }
      refresh_cfo_kpi_mensili: { Args: never; Returns: undefined }
      report_banca_ko: { Args: { _ufficio_id?: string }; Returns: Json }
      report_contabilita: {
        Args: {
          _categoria?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      report_provvigioni_produttore: {
        Args: {
          _data_a?: string
          _data_da?: string
          _solo_non_pagate?: boolean
          _user_id?: string
        }
        Returns: Json
      }
      report_sinistri: {
        Args: {
          _data_a?: string
          _data_da?: string
          _stato?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      report_titoli_incassati: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      resync_split_commerciali_from_madre: {
        Args: { p_child_id: string }
        Returns: undefined
      }
      rettifica_modalita_incasso_titolo: {
        Args: { p_modalita: string; p_note?: string; p_titolo_id: string }
        Returns: Json
      }
      rettifica_provvigioni_quietanza: {
        Args: {
          p_applica_successive?: boolean
          p_data_rettifica?: string
          p_note: string
          p_nuovo_importo: number
          p_titolo_id: string
        }
        Returns: Json
      }
      risolvi_provvigione_compagnia: {
        Args: { _ramo_id: string; _rapporto_id: string }
        Returns: {
          percentuale: number
          source: string
        }[]
      }
      run_data_quality_checks: { Args: never; Returns: Json }
      salva_premi_garanzia_titolo: {
        Args: {
          p_rows: Json
          p_tipo_premio: string
          p_titolo_id: string
          p_titolo_updates: Json
        }
        Returns: undefined
      }
      save_conti_bancari_uffici: {
        Args: { p_conto_id: string; p_ufficio_ids: string[] }
        Returns: undefined
      }
      search_clienti_ranked: {
        Args: { p_limit?: number; p_offset?: number; p_search: string }
        Returns: Json
      }
      segna_ec_produttore_pagato: {
        Args: {
          p_anagrafica_id: string
          p_documento_id?: string
          p_note?: string
          p_periodo_a: string
          p_periodo_da: string
        }
        Returns: Json
      }
      segna_eventi_sinistri_scaduti: { Args: never; Returns: Json }
      sync_quietanza_da_firma: {
        Args: { p_titolo_id: string }
        Returns: undefined
      }
      sync_riparto_coassicurazione_titolo: {
        Args: { p_titolo_id: string }
        Returns: undefined
      }
      sync_split_commerciali_to_children: {
        Args: { p_madre_id: string }
        Returns: undefined
      }
      verifica_cliente_duplicato: {
        Args: {
          _codice_fiscale?: string
          _codice_fiscale_azienda?: string
          _cognome?: string
          _exclude_id?: string
          _nome?: string
          _partita_iva?: string
          _ragione_sociale?: string
          _tipo_cliente?: string
        }
        Returns: {
          cliente_id: string
          codice_cliente: string
          denominazione: string
          match_type: string
        }[]
      }
      verifica_numero_polizza_duplicato: {
        Args: {
          _compagnia_id?: string
          _exclude_titolo_id?: string
          _numero_titolo: string
        }
        Returns: {
          duplicato: boolean
          numero_titolo: string
          titolo_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "ufficio"
        | "produttore"
        | "contabilita"
        | "cfo"
        | "cliente"
        | "backoffice"
        | "corrispondente"
      movimento_bancario_stato:
        | "importato"
        | "matchato"
        | "assegnato"
        | "ricongiunti"
        | "incassato"
      movimento_polizza_tipo: "polizza" | "anticipo" | "ammanco"
      polizza_stato:
        | "attiva"
        | "sospesa"
        | "annullata"
        | "scaduta"
        | "sostituita"
      quietanza_stato:
        | "da_incassare"
        | "incassato"
        | "sospesa"
        | "annullata"
        | "stornata"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "ufficio",
        "produttore",
        "contabilita",
        "cfo",
        "cliente",
        "backoffice",
        "corrispondente",
      ],
      movimento_bancario_stato: [
        "importato",
        "matchato",
        "assegnato",
        "ricongiunti",
        "incassato",
      ],
      movimento_polizza_tipo: ["polizza", "anticipo", "ammanco"],
      polizza_stato: [
        "attiva",
        "sospesa",
        "annullata",
        "scaduta",
        "sostituita",
      ],
      quietanza_stato: [
        "da_incassare",
        "incassato",
        "sospesa",
        "annullata",
        "stornata",
      ],
    },
  },
} as const
