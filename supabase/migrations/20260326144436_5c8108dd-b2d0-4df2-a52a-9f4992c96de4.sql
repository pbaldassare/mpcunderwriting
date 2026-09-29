ALTER TABLE titoli ADD COLUMN commerciale_id uuid REFERENCES profiles(id);
ALTER TABLE titoli ADD COLUMN percentuale_commerciale numeric DEFAULT 100;