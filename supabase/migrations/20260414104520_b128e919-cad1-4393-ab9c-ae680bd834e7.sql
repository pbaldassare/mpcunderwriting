INSERT INTO public.titoli (
  numero_titolo, compagnia_id, cliente_anagrafica_id, ramo_id,
  id_legacy, data_scadenza, durata_da, durata_a,
  garanzia_da, garanzia_a, data_competenza, comp_assicurativa,
  premio_netto, addizionali, tasse, premio_lordo,
  provvigioni_firma, provvigioni_quietanza, stato,
  ae_nome, specialist, periodicita, mora_giorni, disdetta_mesi,
  tipo_rinnovo, descrizione_polizza, tipo_portafoglio, gruppo_ramo,
  targa_telaio, conto_incasso, no_calcolo_tasse, anni_durata,
  produttore_nome, rate
) VALUES (
  '204366651',
  '4d21f189-81b7-4548-b641-63e31942a4b3',
  'a17c3f40-43c5-4e75-ab64-27ae6cf59a74',
  '8bb44856-4eea-4d86-92dd-6407fa5a0e74',
  142490, '2026-04-09', '2025-04-09', '2026-04-09',
  '2025-04-09', '2026-04-09', '2025-04-16', '2025-04-09',
  1107.84, 0, 232.22, 1340.06,
  117.12, 46.85, 'attivo',
  'SEDE NAPOLI', 'GUARRACINO GAETANO', 'annuale', 15, 2,
  'R', 'AUDI A1 GIALLA TAG. FT914NM', 'NUOVA EMISSIONE', 'R.C.A.',
  'FT914NM', 'CASSA NAPOLI', true, 1,
  'INTERFIDI SRL', 1
);