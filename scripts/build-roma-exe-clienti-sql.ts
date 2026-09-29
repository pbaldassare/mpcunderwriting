/**
 * Genera SQL di import anagrafiche EXE Roma.
 * Uso: bun scripts/build-roma-exe-clienti-sql.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolveRomaExeCliente, type CatalogoClienteCBnet, type RomaExeClienteRiga } from "../src/lib/romaExeClienti.ts";

type ExeClient = { exe_codice: string; righe: RomaExeClienteRiga[] };

const exe = JSON.parse(readFileSync("/tmp/roma-exe-clienti.json", "utf8")) as ExeClient[];
const catalogoRaw = JSON.parse(readFileSync("/tmp/cbnet-clienti-tax.json", "utf8")) as Array<
  CatalogoClienteCBnet & { cf?: string | null; piva?: string | null; cf_az?: string | null }
>;
const catalogo: CatalogoClienteCBnet[] = catalogoRaw.map((c) => ({
  id: c.id,
  ufficio_id: c.ufficio_id,
  codice_fiscale: c.codice_fiscale ?? c.cf ?? null,
  partita_iva: c.partita_iva ?? c.piva ?? null,
  codice_fiscale_azienda: c.codice_fiscale_azienda ?? c.cf_az ?? null,
}));
const RM2 = "c83a748c-653f-4cbd-b075-b399eccdd1b1";
const SKIP = new Set<string>(
  (() => {
    try {
      return JSON.parse(readFileSync("/tmp/roma-exe-already.json", "utf8")) as string[];
    } catch {
      return [];
    }
  })(),
);
const GF_IDS = {
  linea_persona: "a3d9b7c4-dacc-43bc-ba25-7829475a0697",
  aziende_private: "9f712168-3abc-4b09-b7f2-81e819848bd0",
  enti_territoriali: "0e090595-0f3e-475c-b70b-583ec70fb0b0",
};
const SPECIALIST = "3d7d17cc-caeb-47b7-8b2c-51ead91bb983";

const resolved = exe
  .filter((c) => !SKIP.has(String(c.exe_codice)))
  .map((c) => resolveRomaExeCliente(c.exe_codice, c.righe, catalogo, { ufficioId: RM2 }));

const stats = resolved.reduce(
  (acc, r) => {
    acc[r.esito] = (acc[r.esito] || 0) + 1;
    acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlIdent(id: string): string {
  return `'${id}'::uuid`;
}

const GF = {
  linea_persona: `'${GF_IDS.linea_persona}'::uuid`,
  aziende_private: `'${GF_IDS.aziende_private}'::uuid`,
  enti_territoriali: `'${GF_IDS.enti_territoriali}'::uuid`,
};

const header = `-- Roma EXE clienti remaining ${resolved.length} ${JSON.stringify(stats)}\n`;

const existing = resolved.filter((r) => r.esito === "esistente" && r.clienteId);
const created = resolved.filter((r) => r.esito === "da_creare");

const mapExisting = existing
  .map(
    (r) =>
      `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.clienteId!)}, 'esistente', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const createdWithId = created.map((r) => ({ ...r, newId: randomUUID() }));

const clienteRows = createdWithId.map((r) => {
  const isPriv = r.tipoCliente === "privato";
  return `(${sqlIdent(r.newId)}, ${sqlStr(r.tipoCliente)}, ${sqlStr(r.codiceCliente)}, ${sqlStr(r.ragioneSociale)},
    ${sqlStr(r.nome)}, ${sqlStr(r.cognome)}, ${sqlStr(r.titolo)},
    ${sqlStr(isPriv ? r.codiceFiscale : null)}, ${sqlStr(isPriv ? null : r.partitaIva)}, ${sqlStr(isPriv ? null : r.codiceFiscaleAzienda)},
    ${sqlStr(r.formaGiuridica)}, ${GF[r.gruppoKey]},
    '${RM2}'::uuid,
    'romaexe@consulbrokers.it',
    ${sqlStr(r.pec)}, ${sqlStr(r.telefono)}, ${sqlStr(r.cellulare)}, ${sqlStr(r.fax)},
    ${sqlStr(isPriv ? r.indirizzo : null)}, ${sqlStr(isPriv ? r.cap : null)}, ${sqlStr(isPriv ? r.citta : null)}, ${sqlStr(isPriv ? r.provincia : null)},
    ${sqlStr(isPriv ? null : r.indirizzo)}, ${sqlStr(isPriv ? null : r.cap)}, ${sqlStr(isPriv ? null : r.citta)}, ${sqlStr(isPriv ? null : r.provincia)},
    ${sqlStr(r.indirizzoAlternativo)}, ${sqlStr(r.capAlternativo)}, ${sqlStr(r.cittaAlternativa)}, ${sqlStr(r.provinciaAlternativa)},
    ${sqlStr(r.note)}, 'IT', true, 'attivo')`;
});

const mapCreated = createdWithId
  .map(
    (r) =>
      `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const specialistIds = createdWithId.map((r) => sqlIdent(r.newId)).join(",\n  ");

const CHUNK = 12;
const chunks: string[] = [];
for (let i = 0; i < createdWithId.length; i += CHUNK) {
  const slice = createdWithId.slice(i, i + CHUNK);
  const rows = clienteRows.slice(i, i + CHUNK);
  const maps = slice
    .map(
      (r) =>
        `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`,
    )
    .join(",\n");
  const specs = slice.map((r) => `(${sqlIdent(r.newId)})`).join(",\n  ");
  chunks.push(`INSERT INTO public.clienti (
  id, tipo_cliente, codice_cliente, ragione_sociale,
  nome, cognome, titolo,
  codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, gruppo_finanziario_id,
  ufficio_id, email, pec, telefono, cellulare, fax,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede,
  indirizzo_alternativo, cap_alternativo, citta_alternativa, provincia_alternativa,
  note, nazione, attivo, stato_cliente
)
VALUES
${rows.join(",\n")};

INSERT INTO public.roma_exe_clienti_map (exe_codice, exe_ragione_sociale, cliente_id, esito, motivo)
VALUES
${maps}
ON CONFLICT (exe_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;

INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, profilo_id)
SELECT x.id, 'Backoffice', '${SPECIALIST}'::uuid
FROM (VALUES
  ${specs}
) AS x(id)
ON CONFLICT (cliente_id, ruolo) DO UPDATE
SET profilo_id = EXCLUDED.profilo_id;
`);
}

const prelude = `${header}
${
  existing.length
    ? `INSERT INTO public.roma_exe_clienti_map (exe_codice, exe_ragione_sociale, cliente_id, esito, motivo)
VALUES
${mapExisting}
ON CONFLICT (exe_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`
    : "-- nessun cliente EXE già presente in CBnet per CF/P.IVA"
}
`;

writeFileSync("/tmp/roma-exe-clienti-import.sql", prelude + "\n" + chunks.join("\n"));
writeFileSync("/tmp/roma-exe-clienti-prelude.sql", prelude);
for (let i = 0; i < chunks.length; i++) {
  writeFileSync(`/tmp/roma-exe-clienti-chunk-${String(i + 1).padStart(2, "0")}.sql`, header + "\n" + chunks[i]);
}
writeFileSync(
  "/tmp/roma-exe-clienti-resolved.json",
  JSON.stringify(
    {
      stats,
      existing: existing.map((r) => ({ exe: r.exeCodice, id: r.clienteId, nome: r.ragioneSociale })),
      created: created.length,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ total: resolved.length, stats, existing: existing.length, created: created.length }, null, 2));
