ALTER TABLE public.sinistri REPLICA IDENTITY FULL;
ALTER TABLE public.sinistro_eventi REPLICA IDENTITY FULL;
ALTER TABLE public.sinistro_checklist REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sinistri') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sinistri';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sinistro_eventi') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sinistro_eventi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sinistro_checklist') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sinistro_checklist';
  END IF;
END $$;