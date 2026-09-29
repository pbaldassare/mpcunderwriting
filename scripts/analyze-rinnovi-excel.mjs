/**
 * Fase 1+2 — Analisi Excel Rinnovi vs CBnet (nessuna scrittura DB).
 *
 * Prerequisito: scripts/output/rinnovi-db-lookup.json (generato via MCP SQL)
 *
 * Uso:
 *   node scripts/analyze-rinnovi-excel.mjs
 *   node scripts/analyze-rinnovi-excel.mjs "C:\\path\\Rinnovi_xxx.xlsx"
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const EXCEL_PATH =
  process.argv[2] ||
  "C:\\Users\\Utente\\Downloads\\Rinnovi_20260714114025.xlsx";

const OUTPUT_DIR = path.resolve(process.cwd(), "scripts", "output");
const LOOKUP_PATH = path.join(OUTPUT_DIR, "rinnovi-db-lookup.json");
const REPORT_JSON = path.join(OUTPUT_DIR, "analyze-rinnovi-report.json");
const DATE_TAG = new Date().toISOString().slice(0, 10);
const REPORT_XLSX = path.join(OUTPUT_DIR, `Analisi-Rinnovi-${DATE_TAG}.xlsx`);

const SDO_UFFICIO_ID = "327e92f7-64f0-48b9-9e48-73611d8cb406";
const MIDENA_PROFILE_ID = "e73e2ff6-1280-4ef1-9bef-61a36175225c";

const COMPAGNIA_ALIASES = {
  "generali italia s.p.a.": "generali",
  "generali italia spa": "generali",
  "generali div. cattolica": "cattolica",
  "allianz assicurazioni": "allianz",
  "unipol assicurazioni s.p.a.": "unipol",
  "reale mutua assicurazioni": "reale mutua",
  "societa' reale mutua assicurazioni": "reale mutua",
  "italiana assicurazioni": "italiana",
  "axa assicurazioni": "axa",
  "zurich insurance company ltd": "zurich",
  "hdi assicurazioni spa": "hdi",
  "helvetia assicurazioni": "helvetia",
  "cattolica assicurazioni": "cattolica",
  "arag assicurazioni": "arag",
  "chubb insurance": "chubb",
  "europ assistance italia spa": "europ assistance",
  "amissima assicurazioni": "amissima",
  "das": "das",
  "d.a.s": "das",
  "d.a.s.": "das",
};

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normPolizza(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

function excelSerialToIso(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 20000 || n > 70000) return null;
  const utc = Date.UTC(1899, 11, 30) + n * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function tokenSet(s) {
  return new Set(norm(s).split(" ").filter((t) => t.length > 2));
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function loadLookup() {
  if (!fs.existsSync(LOOKUP_PATH)) {
    throw new Error(
      `Lookup DB mancante: ${LOOKUP_PATH}\nEseguire prima le query MCP e salvare rinnovi-db-lookup.json`,
    );
  }
  return JSON.parse(fs.readFileSync(LOOKUP_PATH, "utf8"));
}

function buildIndexes(lookup) {
  const clientiByCodice = new Map();
  const clientiByCf = new Map();
  const clientiByPiva = new Map();
  for (const c of lookup.clienti || []) {
    if (c.codice_ricerca) clientiByCodice.set(norm(c.codice_ricerca), c);
    if (c.codice_cliente) clientiByCodice.set(norm(c.codice_cliente), c);
    if (c.codice_fiscale) clientiByCf.set(norm(c.codice_fiscale), c);
    if (c.partita_iva) clientiByPiva.set(norm(c.partita_iva), c);
  }

  const compagnie = lookup.compagnie || [];
  const compagnieById = new Map();
  const compagnieList = [];
  const rapportiByCompagnia = new Map();
  for (const row of compagnie) {
    if (!compagnieById.has(row.id)) {
      compagnieById.set(row.id, row);
      compagnieList.push(row);
    }
    if (row.rapporto_id) {
      const arr = rapportiByCompagnia.get(row.id) || [];
      arr.push(row);
      rapportiByCompagnia.set(row.id, arr);
    }
  }

  const ramiByKey = new Map();
  for (const r of lookup.rami || []) {
    const key = `${norm(r.gruppo_ramo)}|${norm(r.sottoramo)}`;
    ramiByKey.set(key, r);
    ramiByKey.set(norm(r.sottoramo), r);
  }

  const titoliByNumero = new Map();
  for (const t of lookup.titoli || []) {
    const n = normPolizza(t.numero_titolo);
    if (!n) continue;
    const arr = titoliByNumero.get(n) || [];
    arr.push(t);
    titoliByNumero.set(n, arr);
  }

  const meta = {};
  for (const m of lookup.meta || []) meta[m.kind] = m;

  return {
    clientiByCodice,
    clientiByCf,
    clientiByPiva,
    compagnieList,
    compagnieById,
    rapportiByCompagnia,
    ramiByKey,
    titoliByNumero,
    meta,
  };
}

function resolveCliente(row, idx) {
  const codice = String(row.Codice || "").trim();
  const cf = String(row.CodFiscale || "").trim().toUpperCase();
  const issues = [];

  let cliente = null;
  let matchBy = null;

  if (codice) {
    cliente = idx.clientiByCodice.get(norm(codice));
    if (cliente) matchBy = "codice";
  }
  if (!cliente && cf && cf !== "**ERRORE**" && cf !== "XXXXXXXXXXXXXXXX") {
    cliente = idx.clientiByCf.get(norm(cf)) || idx.clientiByPiva.get(norm(cf));
    if (cliente) matchBy = "cf/piva";
  }

  if (!codice) issues.push("Codice cliente mancante");
  else if (!cliente) issues.push(`Cliente non trovato in CBnet (codice ${codice})`);

  if (cf === "**ERRORE**" || cf === "XXXXXXXXXXXXXXXX") {
    issues.push("Codice fiscale placeholder/errato nel file");
  }

  return { cliente, matchBy, issues };
}

function resolveCompagnia(compagniaExcel, idx) {
  const raw = String(compagniaExcel || "").trim();
  if (!raw) return { compagnia: null, rapporto: null, score: 0, issues: ["Compagnia/agenzia mancante"] };

  const aliasKey = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const aliasNorm = COMPAGNIA_ALIASES[aliasKey];

  let best = null;
  let bestScore = 0;

  for (const c of idx.compagnieList) {
    const nome = c.nome || "";
    let score = jaccard(raw, nome);
    if (norm(raw).includes(norm(c.codice))) score += 0.2;
    if (aliasNorm && norm(nome).includes(norm(aliasNorm))) score += 0.25;
    if (norm(raw).includes("ITALIANA") && norm(nome).includes("ITALIANA")) score += 0.1;
    if (norm(raw).includes("NADALON") && norm(nome).includes("NADALON")) score += 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best || bestScore < 0.25) {
    return {
      compagnia: null,
      rapporto: null,
      score: bestScore,
      issues: [`Agenzia non collegata: "${raw}" (best score ${bestScore.toFixed(2)})`],
    };
  }

  const rapporti = idx.rapportiByCompagnia.get(best.id) || [];
  const rapporto =
    rapporti.find((r) => r.is_principale) || rapporti[0] || null;

  const issues = [];
  if (bestScore < 0.45) {
    issues.push(`Match agenzia incerto (score ${bestScore.toFixed(2)}): "${raw}" → "${best.nome}"`);
  }

  return { compagnia: best, rapporto, score: bestScore, issues };
}

function resolveRamo(gruppo, sottoramo, idx) {
  const issues = [];
  const g = String(gruppo || "").trim();
  const s = String(sottoramo || "").trim();
  if (!g && !s) {
    issues.push("Gruppo/Ramo mancanti");
    return { ramo: null, issues };
  }

  let ramo =
    idx.ramiByKey.get(`${norm(g)}|${norm(s)}`) ||
    idx.ramiByKey.get(norm(s)) ||
    null;

  if (!ramo) {
    let best = null;
    let bestScore = 0;
    for (const [key, r] of idx.ramiByKey.entries()) {
      if (key.includes("|")) continue;
      const score = jaccard(s || g, r.sottoramo) + jaccard(g, r.gruppo_ramo) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    if (best && bestScore >= 0.35) ramo = best;
  }

  if (!ramo) issues.push(`Ramo non trovato: ${g} / ${s}`);
  return { ramo, issues };
}

function findTitoliChain(polizza, idx) {
  const all = idx.titoliByNumero.get(polizza) || [];
  const madre = all.find((t) => !t.sostituisce_polizza) || null;
  const quietanze = all.filter((t) => !!t.sostituisce_polizza);
  return { all, madre, quietanze };
}

/** Incasso e premio vanno solo sulla quietanza (madre = strutturale, premio 0). */
function inferIncassoQuietanza(row) {
  const st = String(row.St ?? "").trim().toUpperCase();
  const lordoRaw = String(row.Lordo ?? "").trim();
  const premioLordo = Number.isFinite(Number(row.Lordo)) ? Number(row.Lordo) : null;

  // Nel file legacy St=X compare su 261/333 righe; interpretato come incassato.
  const incassato = st === "X";
  const avvisi = [];
  if (!st) avvisi.push("St vuoto — stato incasso da verificare (quietanza attiva)");
  if (premioLordo == null && lordoRaw === "") avvisi.push("Premio lordo mancante sulla quietanza");

  return {
    incassato,
    premioLordo: premioLordo ?? 0,
    importoIncassato: incassato && premioLordo != null ? premioLordo : null,
    statoQuietanza: incassato ? "incassato" : "attivo",
    avvisi,
  };
}

/**
 * Ogni riga Excel (non appendice) genera una coppia madre + quietanza:
 * - madre: sostituisce_polizza null, premio 0, nessun incasso
 * - quietanza: sostituisce_polizza = numero polizza, premio/incasso dal file
 */
function planImportPair(row, idx) {
  const polizza = normPolizza(row.Polizza);
  const rg = Number(row.Rg || 0);
  const appendice = String(row.Appendice || "").trim();
  const tipoRinnovo = String(row["Tipo Rinnovo"] || "").trim().toUpperCase();
  const issues = [];

  if (rg > 0 || appendice) {
    return {
      tipoRiga: "appendice",
      importKind: "appendice",
      piano: null,
      titoliDaCreare: 0,
      issues: [
        `Appendice/riga ${rg}${appendice ? ` (${appendice})` : ""} — da valutare manualmente`,
      ],
    };
  }

  if (!polizza) issues.push("Numero polizza mancante");

  const { all, madre, quietanze } = findTitoliChain(polizza, idx);
  if (all.length > 2) {
    issues.push(`Catena CBnet con ${all.length} titoli sullo stesso numero — verifica manuale`);
  }
  if (quietanze.length > 1) {
    issues.push(`Più quietanze CBnet (${quietanze.length}) — abbinamento per garanzia da verificare`);
  }

  const incasso = inferIncassoQuietanza(row);
  const garanziaDa = excelSerialToIso(row["Scad Polizza"]);
  const garanziaA = excelSerialToIso(row.Scadenza);

  const madrePiano = {
    ruolo: "madre",
    numero_titolo: polizza,
    sostituisce_polizza: null,
    premio_lordo: 0,
    incasso: false,
    importo_incassato: null,
    data_messa_cassa: null,
    garanzia_da: garanziaDa,
    garanzia_a: garanziaA,
    azione: madre ? "gia_presente" : "crea_nuovo",
    existingId: madre?.id || null,
  };

  const quietanzaEsistente = quietanze[0] || null;
  const quietanzaPiano = {
    ruolo: "quietanza",
    numero_titolo: polizza,
    sostituisce_polizza: polizza,
    premio_lordo: incasso.premioLordo,
    incasso: incasso.incassato,
    importo_incassato: incasso.importoIncassato,
    data_messa_cassa: incasso.incassato ? garanziaA : null,
    stato: incasso.statoQuietanza,
    garanzia_da: garanziaDa,
    garanzia_a: garanziaA,
    azione: quietanzaEsistente ? "gia_presente" : "crea_nuovo",
    existingId: quietanzaEsistente?.id || null,
  };

  const titoliDaCreare =
    (madrePiano.azione === "crea_nuovo" ? 1 : 0) +
    (quietanzaPiano.azione === "crea_nuovo" ? 1 : 0);

  let importKind = "coppia_madre_quietanza";
  if (tipoRinnovo === "R") importKind = "rinnovo_madre_quietanza";
  else if (tipoRinnovo) importKind = `tipo_${tipoRinnovo}_madre_quietanza`;

  return {
    tipoRiga: tipoRinnovo || "standard",
    importKind,
    piano: { madre: madrePiano, quietanza: quietanzaPiano },
    titoliDaCreare,
    incasso,
    issues,
    avvisiIncasso: incasso.avvisi,
  };
}

function validateRow(row) {
  const issues = [];
  const avvisi = [];
  if (!String(row.St ?? "").trim()) avvisi.push("Stato (St) mancante — incasso incerto");
  if (!String(row.Nome ?? "").trim()) issues.push("Nome cliente mancante");
  if (!Number.isFinite(Number(row.Lordo)) && String(row.Lordo ?? "").trim() === "") {
    issues.push("Premio lordo mancante");
  }
  if (String(row.Filiale || "").trim() && String(row.Filiale).trim() !== "SD") {
    issues.push(`Filiale non SD: ${row.Filiale}`);
  }
  const ae = String(row["Account Executive"] || row["A/E"] || "").trim().toUpperCase();
  if (ae && !ae.includes("MIDENA")) {
    issues.push(`Account Executive diverso da Midena: ${ae}`);
  }
  return { issues, avvisi };
}

function analyze() {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`File Excel non trovato: ${EXCEL_PATH}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const lookup = loadLookup();
  const idx = buildIndexes(lookup);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const polizzaSeen = new Map();
  const analyzed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const polizzaKey = normPolizza(row.Polizza);

    const allIssues = [];
    const warnings = [];

    if (polizzaKey) {
      const prev = polizzaSeen.get(polizzaKey);
      if (prev) {
        allIssues.push(`Polizza duplicata nel file (righe ${prev} e ${rowNum})`);
      } else polizzaSeen.set(polizzaKey, rowNum);
    }

    const validation = validateRow(row);
    allIssues.push(...validation.issues);
    warnings.push(...validation.avvisi);

    const { cliente, matchBy, issues: clienteIssues } = resolveCliente(row, idx);
    allIssues.push(...clienteIssues);

    const { compagnia, rapporto, score: compScore, issues: compIssues } = resolveCompagnia(
      row.Compagnia,
      idx,
    );
    allIssues.push(...compIssues);
    if (compScore >= 0.45 && compScore < 0.65) warnings.push(`Match agenzia medio (${compScore.toFixed(2)})`);

    const { ramo, issues: ramoIssues } = resolveRamo(row.Gruppo, row.Ramo, idx);
    allIssues.push(...ramoIssues);

    const pair = planImportPair(row, idx);
    allIssues.push(...pair.issues);
    if (pair.avvisiIncasso?.length) warnings.push(...pair.avvisiIncasso);

    const ufficioOk =
      !cliente || cliente.ufficio_id === SDO_UFFICIO_ID;
    if (cliente && !ufficioOk) {
      warnings.push(`Cliente su ufficio diverso da SDO (${cliente.ufficio_id})`);
    }

    const isAppendice = pair.importKind === "appendice";
    const haTitoliDaCreare = pair.titoliDaCreare > 0;

    const ready =
      allIssues.length === 0 &&
      cliente &&
      compagnia &&
      ramo &&
      !isAppendice &&
      haTitoliDaCreare;

    const piano = pair.piano;
    analyzed.push({
      riga: rowNum,
      st: row.St,
      codice: row.Codice,
      codFiscale: row.CodFiscale,
      nome: row.Nome,
      polizza: row.Polizza,
      rg: row.Rg,
      appendice: row.Appendice,
      gruppo: row.Gruppo,
      ramo: row.Ramo,
      compagniaExcel: row.Compagnia,
      lordo: row.Lordo,
      scadenza: excelSerialToIso(row.Scadenza),
      scadPolizza: excelSerialToIso(row["Scad Polizza"]),
      tipoRinnovo: row["Tipo Rinnovo"],
      filiale: row.Filiale,
      specialist: row.Specialist,
      accountExecutive: row["Account Executive"] || row["A/E"],
      clienteId: cliente?.id || null,
      clienteMatch: matchBy,
      clienteUfficioId: cliente?.ufficio_id || null,
      compagniaId: compagnia?.id || null,
      compagniaNome: compagnia?.nome || null,
      compagniaScore: compScore,
      rapportoId: rapporto?.rapporto_id || null,
      ramoId: ramo?.id || null,
      ramoNome: ramo ? `${ramo.gruppo_ramo} / ${ramo.sottoramo}` : null,
      importKind: pair.importKind,
      tipoRiga: pair.tipoRiga,
      titoliDaCreare: pair.titoliDaCreare,
      madreAzione: piano?.madre?.azione || null,
      quietanzaAzione: piano?.quietanza?.azione || null,
      madreEsistenteId: piano?.madre?.existingId || null,
      quietanzaEsistenteId: piano?.quietanza?.existingId || null,
      quietanzaIncasso: piano?.quietanza?.incasso ?? null,
      quietanzaStato: piano?.quietanza?.stato || null,
      quietanzaImportoIncassato: piano?.quietanza?.importo_incassato ?? null,
      prontoImport: ready,
      giaCompletaInCbnet:
        !isAppendice && piano && pair.titoliDaCreare === 0,
      problemi: allIssues,
      avvisi: warnings,
      piano,
    });
  }

  const titoliPiano = [];
  for (const r of analyzed) {
    if (!r.piano) continue;
    for (const ruolo of ["madre", "quietanza"]) {
      const p = r.piano[ruolo];
      titoliPiano.push({
        rigaExcel: r.riga,
        polizza: r.polizza,
        ruolo: p.ruolo,
        azione: p.azione,
        numero_titolo: p.numero_titolo,
        sostituisce_polizza: p.sostituisce_polizza,
        premio_lordo: p.premio_lordo,
        incasso: p.incasso,
        importo_incassato: p.importo_incassato,
        stato: p.stato || null,
        garanzia_da: p.garanzia_da,
        garanzia_a: p.garanzia_a,
        existingId: p.existingId,
        prontaRiga: r.prontoImport,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    modello: "madre_quietanza — incasso solo su quietanza (src/lib/quietanze.ts)",
    excelPath: EXCEL_PATH,
    lookupPath: LOOKUP_PATH,
    meta: idx.meta,
    righeTotali: rows.length,
    polizzeUniche: polizzaSeen.size,
    clientiUniciFile: new Set(rows.map((r) => String(r.Codice || "").trim()).filter(Boolean)).size,
    agenzieUnicheFile: new Set(rows.map((r) => String(r.Compagnia || "").trim()).filter(Boolean)).size,
    coppiePronteImport: analyzed.filter((r) => r.prontoImport).length,
    titoliPianoTotali: titoliPiano.length,
    titoliDaCreare: titoliPiano.filter((t) => t.azione === "crea_nuovo").length,
    madriDaCreare: titoliPiano.filter((t) => t.ruolo === "madre" && t.azione === "crea_nuovo").length,
    quietanzeDaCreare: titoliPiano.filter((t) => t.ruolo === "quietanza" && t.azione === "crea_nuovo").length,
    quietanzeConIncasso: titoliPiano.filter((t) => t.ruolo === "quietanza" && t.incasso).length,
    coppieGiaCompleteInCbnet: analyzed.filter((r) => r.giaCompletaInCbnet).length,
    conProblemi: analyzed.filter((r) => r.problemi.length > 0).length,
    appendici: analyzed.filter((r) => r.importKind === "appendice").length,
    clientiNonTrovati: analyzed.filter((r) => r.problemi.some((p) => p.includes("Cliente non trovato"))).length,
    agenzieNonCollegate: analyzed.filter((r) => r.problemi.some((p) => p.startsWith("Agenzia non collegata"))).length,
    ramiNonTrovati: analyzed.filter((r) => r.problemi.some((p) => p.startsWith("Ramo non trovato"))).length,
    codiceMancante: analyzed.filter((r) => r.problemi.some((p) => p === "Codice cliente mancante")).length,
    stMancante: analyzed.filter((r) => r.avvisi.some((p) => p.includes("Stato (St) mancante"))).length,
    ufficioSdo: SDO_UFFICIO_ID,
    midenaProfileId: MIDENA_PROFILE_ID,
    dbCounts: {
      clientiLookup: (lookup.clienti || []).length,
      compagnieLookup: new Set((lookup.compagnie || []).map((c) => c.id)).size,
      ramiLookup: (lookup.rami || []).length,
      titoliLookup: (lookup.titoli || []).length,
    },
  };

  const report = { summary, rows: analyzed, titoliPiano };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const okRows = analyzed.filter((r) => r.prontoImport);
  const problemRows = analyzed.filter((r) => r.problemi.length > 0);
  const nonCollegate = analyzed.filter((r) =>
    r.problemi.some((p) => p.startsWith("Agenzia non collegata") || p.includes("Cliente non trovato")),
  );

  const toSheet = (items) =>
    items.map((r) => ({
      Riga: r.riga,
      St: r.st,
      Codice: r.codice,
      Nome: r.nome,
      Polizza: r.polizza,
      CompagniaExcel: r.compagniaExcel,
      CompagniaCBnet: r.compagniaNome,
      ClienteId: r.clienteId,
      CompagniaId: r.compagniaId,
      RamoId: r.ramoId,
      ImportKind: r.importKind,
      Madre: r.madreAzione,
      Quietanza: r.quietanzaAzione,
      TitoliDaCreare: r.titoliDaCreare,
      IncassoQuietanza: r.quietanzaIncasso ? "Sì" : "No",
      Pronto: r.prontoImport ? "Sì" : "No",
      Problemi: r.problemi.join(" | "),
      Avvisi: r.avvisi.join(" | "),
    }));

  const pianoSheet = titoliPiano.map((t) => ({
    RigaExcel: t.rigaExcel,
    Polizza: t.polizza,
    Ruolo: t.ruolo,
    Azione: t.azione,
    NumeroTitolo: t.numero_titolo,
    SostituiscePolizza: t.sostituisce_polizza ?? "",
    PremioLordo: t.premio_lordo,
    Incasso: t.incasso ? "Sì" : "No",
    ImportoIncassato: t.importo_incassato ?? "",
    Stato: t.stato ?? "",
    GaranziaDa: t.garanzia_da ?? "",
    GaranziaA: t.garanzia_a ?? "",
    ProntaRiga: t.prontaRiga ? "Sì" : "No",
  }));

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    outWb,
    XLSX.utils.json_to_sheet([
      { Metrica: "Modello", Valore: summary.modello },
      { Metrica: "Righe totali", Valore: summary.righeTotali },
      { Metrica: "Polizze uniche", Valore: summary.polizzeUniche },
      { Metrica: "Coppie pronte import", Valore: summary.coppiePronteImport },
      { Metrica: "Titoli in piano (madre+quiet)", Valore: summary.titoliPianoTotali },
      { Metrica: "Titoli da creare", Valore: summary.titoliDaCreare },
      { Metrica: "Madri da creare", Valore: summary.madriDaCreare },
      { Metrica: "Quietanze da creare", Valore: summary.quietanzeDaCreare },
      { Metrica: "Quietanze con incasso", Valore: summary.quietanzeConIncasso },
      { Metrica: "Coppie già complete CBnet", Valore: summary.coppieGiaCompleteInCbnet },
      { Metrica: "Con problemi", Valore: summary.conProblemi },
      { Metrica: "Appendici", Valore: summary.appendici },
      { Metrica: "Clienti non trovati", Valore: summary.clientiNonTrovati },
      { Metrica: "Agenzie non collegate", Valore: summary.agenzieNonCollegate },
      { Metrica: "Rami non trovati", Valore: summary.ramiNonTrovati },
      { Metrica: "Codice mancante", Valore: summary.codiceMancante },
      { Metrica: "St mancante (avviso)", Valore: summary.stMancante },
    ]),
    "Riepilogo",
  );
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(pianoSheet), "Piano titoli");
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(toSheet(okRows)), "Pronte");
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(toSheet(problemRows)), "Problemi");
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(toSheet(nonCollegate)), "Non collegate");
  XLSX.writeFile(outWb, REPORT_XLSX);

  console.log("Report JSON:", REPORT_JSON);
  console.log("Report Excel:", REPORT_XLSX);
  console.log(JSON.stringify(summary, null, 2));
  return report;
}

analyze();
