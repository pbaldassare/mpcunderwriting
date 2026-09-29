import fs from "fs";
import path from "path";

const keys = JSON.parse(
  fs.readFileSync(path.resolve("scripts/output/rinnovi-keys.json"), "utf8"),
);
const esc = (arr) =>
  arr.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",");

const q = `SELECT id, codice_cliente, codice_ricerca, codice_fiscale, partita_iva, ragione_sociale, nome, cognome, ufficio_id FROM clienti WHERE codice_ricerca IN (${esc(keys.codici)}) OR codice_cliente IN (${esc(keys.codici)})`;
fs.writeFileSync(path.resolve("scripts/output/clienti-query.sql"), q);
console.log("Wrote clienti-query.sql", q.length);
