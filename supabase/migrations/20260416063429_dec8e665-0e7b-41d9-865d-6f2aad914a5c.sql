ALTER TABLE rimessa_premi
  ADD COLUMN IF NOT EXISTS importo_pagato numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note text;