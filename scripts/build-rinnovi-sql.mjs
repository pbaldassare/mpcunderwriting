import fs from "fs";
import path from "path";

const keys = JSON.parse(
  fs.readFileSync(path.resolve("scripts/output/rinnovi-keys.json"), "utf8"),
);
const esc = (arr) =>
  arr.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",");

const queries = {
  clienti: `SELECT id, codice_cliente, codice_ricerca, codice_fiscale, partita_iva, ragione_sociale, nome, cognome, ufficio_id FROM clienti WHERE codice_cliente IN (${esc(keys.codici)}) OR codice_ricerca IN (${esc(keys.codici)}) OR codice_fiscale IN (${esc(keys.cfs)}) OR partita_iva IN (${esc(keys.cfs)})`,
  titoli: `SELECT id, numero_titolo, sostituisce_polizza, cliente_id, compagnia_id, compagnia_rapporto_id, ramo_id, stato, garanzia_da, garanzia_a, premio_lordo, ufficio_id, appendice, riga, prodotto_nome, ae_anagrafica_id, anagrafica_commerciale_id FROM titoli WHERE numero_titolo IN (${esc(keys.polizze)})`,
  compagnie: `SELECT c.id, c.nome, c.codice, c.tipo, c.partita_iva, cr.id AS rapporto_id, cr.codice_rapporto, cr.sede_denominazione, cr.is_principale FROM compagnie c LEFT JOIN compagnia_rapporti cr ON cr.compagnia_id = c.id`,
  rami: `SELECT r.id, r.descrizione AS sottoramo, r.codice AS sottoramo_codice, gr.descrizione AS gruppo_ramo, gr.codice AS gruppo_ramo_codice FROM rami r JOIN gruppi_ramo gr ON r.gruppo_ramo_id = gr.id`,
  meta: `SELECT 'ufficio' AS kind, id::text AS id, codice_ufficio AS codice, nome_ufficio AS label FROM uffici WHERE codice_ufficio = 'SDO' UNION ALL SELECT 'profile', id::text, email, concat(nome,' ',cognome) FROM profiles WHERE email = 'mmidena@consulbrokers.it' UNION ALL SELECT 'anagrafica', id::text, email, concat(nome,' ',cognome) FROM anagrafiche_professionali WHERE email = 'mmidena@consulbrokers.it' OR (upper(nome) = 'MARIA' AND upper(cognome) = 'MIDENA')`,
};

const out = path.resolve("scripts/output/rinnovi-sql.json");
fs.writeFileSync(out, JSON.stringify(queries, null, 2));
console.log("Wrote", out);
for (const [k, v] of Object.entries(queries)) console.log(k, v.length);
