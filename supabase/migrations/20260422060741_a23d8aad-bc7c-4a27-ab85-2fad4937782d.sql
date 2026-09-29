-- Pulizia campo specialist: il valore uuid 'cf2372e6-…' (CAROLINA AMATO, ruolo cliente)
-- viene risolto in nome leggibile per coerenza con gli altri valori del campo
UPDATE titoli
SET specialist = 'AMATO CAROLINA'
WHERE specialist = 'cf2372e6-0b79-4a51-a3d6-9eb5e4e8db18';