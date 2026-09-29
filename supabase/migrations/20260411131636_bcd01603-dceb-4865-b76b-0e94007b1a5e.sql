
-- Tipo
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'privato';

-- Dati privato
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS codice_fiscale text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS data_nascita text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS luogo_nascita text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS indirizzo_residenza text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cap_residenza text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS citta_residenza text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS provincia_residenza text;

-- Dati azienda/ente
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS ragione_sociale text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS partita_iva text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS codice_fiscale_azienda text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS codice_sdi text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS forma_giuridica text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS indirizzo_sede text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cap_sede text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS citta_sede text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS provincia_sede text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS referente_nome text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS referente_cognome text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS referente_telefono text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS referente_email text;

-- Contatti aggiuntivi
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS pec text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cellulare text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS fax text;

-- Indirizzi alternativi
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS indirizzo_alternativo text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cap_alternativo text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS citta_alternativa text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS provincia_alternativa text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS indirizzo_fiscale text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cap_fiscale text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS citta_fiscale text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS provincia_fiscale text;

-- Dati gestionali
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS codice_ricerca text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS titolo text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS sesso text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS comune_nascita text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS provincia_nascita text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS nazione text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS attenzione_di text;

-- Dati statistici
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS zona text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS indotto text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS attivita text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS settore text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS contratto text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS gruppo_statistico text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS fascia_fatturato text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS fascia_dipendenti text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS azienda_stat text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS matricola text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS riferimento text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS codice_ateco text;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cliente_associato boolean DEFAULT false;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS cliente_captive boolean DEFAULT false;
ALTER TABLE public.prospect ADD COLUMN IF NOT EXISTS internazionale boolean DEFAULT false;
