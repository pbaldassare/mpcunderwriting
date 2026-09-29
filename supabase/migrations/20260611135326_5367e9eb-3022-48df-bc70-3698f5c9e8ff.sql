CREATE UNIQUE INDEX IF NOT EXISTS uq_movimenti_bancari_dedup
  ON public.movimenti_bancari (data_movimento, importo, ordinante, md5(descrizione));