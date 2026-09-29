-- Add unique constraint on compagnie.codice for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS compagnie_codice_unique ON public.compagnie (codice);

-- Add unique constraint on categorie_prodotto.nome for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS categorie_prodotto_nome_unique ON public.categorie_prodotto (nome);