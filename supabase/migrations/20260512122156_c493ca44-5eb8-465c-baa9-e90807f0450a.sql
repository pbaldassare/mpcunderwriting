-- Anti-duplicato sui rapporti agenzia ↔ compagnia assicurativa
-- (codice_rapporto può essere NULL: in tal caso il vincolo non scatta, gestiamo a UI)
CREATE UNIQUE INDEX IF NOT EXISTS compagnia_rapporti_unique_codice
  ON public.compagnia_rapporti (compagnia_id, gruppo_compagnia_id, codice_rapporto)
  WHERE codice_rapporto IS NOT NULL;