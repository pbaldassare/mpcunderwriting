-- Coassicurazione: flag su titoli + colonne aggiuntive su dettaglio_riparto
ALTER TABLE public.titoli
  ADD COLUMN IF NOT EXISTS coassicurazione boolean DEFAULT false;

COMMENT ON COLUMN public.titoli.coassicurazione IS
  'True se il premio è ripartito tra più compagnie/agenzie (dettaglio_riparto con quote < 100% ciascuna).';

ALTER TABLE public.dettaglio_riparto
  ADD COLUMN IF NOT EXISTS gruppo_compagnia_id uuid REFERENCES public.gruppi_compagnia(id);

ALTER TABLE public.dettaglio_riparto
  ADD COLUMN IF NOT EXISTS compagnia_rapporto_id uuid REFERENCES public.compagnia_rapporti(id);

COMMENT ON COLUMN public.dettaglio_riparto.gruppo_compagnia_id IS
  'Gruppo compagnia assicurativa (madre) per la quota di coassicurazione.';

COMMENT ON COLUMN public.dettaglio_riparto.compagnia_rapporto_id IS
  'Rapporto agenzia-compagnia per broker/plurimandatarie nella quota di coassicurazione.';
