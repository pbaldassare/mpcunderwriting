import { resolveClienteIndirizzo, resolveClienteNome, type ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";
import { genderFromCf } from "@/lib/rca/assicurapp";
import {
  danniPacchettoFromGaranzie,
  resolveSelectedCvts,
  type CvtPacchettoValue,
  type RcaQuoteKind,
} from "@/lib/rca/cvt";
import type { TipoClientelaRca } from "@/lib/rca/clientela";
import {
  mapGaranziePolizzaToAssicurapp,
  type CodiceGaranziaAssicurapp,
  type VoceGaranziaPolizza,
} from "@/lib/rca/garanzie";

export const INSURANCE_TYPES = [
  { value: "continuita_assicurativa", label: "Continuità assicurativa" },
  { value: "bersani_stesso_proprietario", label: "Bersani stesso proprietario" },
  { value: "bersani_familiare", label: "Bersani familiare" },
  { value: "recupero_atr", label: "Recupero ATR" },
  { value: "cu14", label: "Prima assicurazione (CU 14)" },
] as const;

export type InsuranceTypeRca = (typeof INSURANCE_TYPES)[number]["value"];

export type RcaPreventivoStato = "bozza" | "pronto" | "in_quotazione" | "quotato" | "salvato";

export type RcaPreventivoRow = {
  id: string;
  quote_uid: string | null;
  cliente_id: string | null;
  titolo_id: string | null;
  veicolo_id: string | null;
  targa: string;
  prodotto_code: "rca_auto" | "rca_autocarri";
  stato: RcaPreventivoStato;
  insurance_type: string;
  driving_type: string;
  fractionation: number;
  garanzie_richieste: string[];
  selected_cvts: string[];
  bersani_plate: string | null;
  bersani_cf: string | null;
  client_snapshot: Record<string, unknown>;
  vehicle_snapshot: Record<string, unknown>;
  quote_snapshot: Record<string, unknown>;
  offerte_snapshot: unknown[];
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RcaPreventivoForm = {
  targa: string;
  clienteId: string | null;
  titoloId: string | null;
  veicoloId: string | null;
  prodottoCode: "rca_auto" | "rca_autocarri";
  name: string;
  surname: string;
  cf: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  houseNum: string;
  city: string;
  province: string;
  zip: string;
  brand: string;
  model: string;
  value: string;
  sat: boolean;
  insuranceType: InsuranceTypeRca;
  drivingType: "Esperta" | "Libera";
  fractionation: 1 | 2;
  bersaniPlate: string;
  bersaniCf: string;
  currentProvider: string;
  insuranceExpire: string;
  garanzie: CodiceGaranziaAssicurapp[];
  quoteKind: RcaQuoteKind;
  cvtPacchetto: CvtPacchettoValue;
  note: string;
};

export function prodottoFromTipo(tipo: TipoClientelaRca | null | undefined): "rca_auto" | "rca_autocarri" {
  return tipo === "autocarro" ? "rca_autocarri" : "rca_auto";
}

export function prodottoLabel(code: string, quoteKind?: string | null): string {
  if (quoteKind === "cvt" || code === "cvt_standalone") return "CVT standalone";
  if (code === "rca_autocarri") return "RCA Autocarri";
  return "RCA Auto";
}

export function splitIndirizzoCivico(indirizzo: string): { address: string; house_num: string } {
  const raw = (indirizzo || "").trim();
  if (!raw) return { address: "", house_num: "" };
  const m = raw.match(/^(.*?)[\s,]+(\d+\w*(?:\s*\/\s*\w+)?|SNC)$/i);
  if (!m) return { address: raw.toUpperCase(), house_num: "" };
  return { address: m[1].trim().toUpperCase(), house_num: m[2].trim().toUpperCase() };
}

export function isoToGgMmAaaa(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function missingPreventivoFields(form: RcaPreventivoForm): string[] {
  const missing: string[] = [];
  if (!form.targa.trim()) missing.push("Targa");
  if (!form.surname.trim() && !form.name.trim()) missing.push("Nome cliente");
  if (!form.cf.trim()) missing.push("Codice fiscale / P.IVA");
  if (!form.phone.trim()) missing.push("Cellulare");
  if (!form.email.trim()) missing.push("Email");
  if (!form.address.trim()) missing.push("Via");
  if (!form.houseNum.trim()) missing.push("Civico");
  if (!form.city.trim()) missing.push("Comune");
  if (!form.province.trim()) missing.push("Provincia");
  if (!form.zip.trim()) missing.push("CAP");
  if (form.insuranceType !== "continuita_assicurativa" && form.insuranceType !== "cu14") {
    if (!form.bersaniPlate.trim()) missing.push("Targa agevolante");
  }
  if (form.insuranceType === "bersani_familiare" && !form.bersaniCf.trim()) {
    missing.push("CF familiare");
  }
  if (form.quoteKind === "cvt" && !form.cvtPacchetto) missing.push("Pacchetto CVT");
  if ((form.quoteKind === "cvt" || form.cvtPacchetto) && !(Number(form.value) > 0)) {
    missing.push("Valore veicolo");
  }
  return missing;
}

export function buildFullAddress(form: Pick<RcaPreventivoForm, "address" | "houseNum" | "zip" | "city" | "province">): string {
  const via = form.address.trim();
  const civ = form.houseNum.trim();
  const cap = form.zip.trim();
  const city = form.city.trim();
  const pr = form.province.trim().toUpperCase();
  if (!via) return "";
  return `${via} ${civ}, ${cap} ${city} ${pr}`.replace(/\s+/g, " ").trim();
}

export function clienteDisplayFromForm(form: RcaPreventivoForm): string {
  const rs = `${form.name} ${form.surname}`.trim();
  return rs || "—";
}

export function emptyPreventivoForm(): RcaPreventivoForm {
  return {
    targa: "",
    clienteId: null,
    titoloId: null,
    veicoloId: null,
    prodottoCode: "rca_auto",
    name: "",
    surname: "",
    cf: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    houseNum: "",
    city: "",
    province: "",
    zip: "",
    brand: "",
    model: "",
    value: "",
    sat: false,
    insuranceType: "continuita_assicurativa",
    drivingType: "Esperta",
    fractionation: 1,
    bersaniPlate: "",
    bersaniCf: "",
    currentProvider: "",
    insuranceExpire: "",
    garanzie: [],
    quoteKind: "rca",
    cvtPacchetto: "",
    note: "",
  };
}

export function formFromClienteCBnet(
  cliente: ClienteEcAnagrafica & {
    id?: string;
    cellulare?: string | null;
    telefono?: string | null;
    email?: string | null;
    pec?: string | null;
    codice_fiscale?: string | null;
    partita_iva?: string | null;
    sesso?: string | null;
  },
  base: RcaPreventivoForm,
): RcaPreventivoForm {
  const addr = resolveClienteIndirizzo(cliente);
  const split = splitIndirizzoCivico(addr.indirizzo);
  const azienda = (cliente.tipo_cliente || "").toLowerCase() === "azienda"
    || (cliente.tipo_cliente || "").toLowerCase() === "ente"
    || !!cliente.ragione_sociale;
  return {
    ...base,
    clienteId: cliente.id || base.clienteId,
    name: azienda ? "" : (cliente.nome || "").toUpperCase(),
    surname: azienda
      ? (cliente.ragione_sociale || "").toUpperCase()
      : (cliente.cognome || "").toUpperCase(),
    cf: (cliente.codice_fiscale || cliente.partita_iva || "").toUpperCase(),
    gender: azienda ? "" : genderFromCf(cliente.codice_fiscale, cliente.sesso),
    phone: (cliente.cellulare || cliente.telefono || "").replace(/\s+/g, ""),
    email: (cliente.email || cliente.pec || "").trim(),
    address: split.address,
    houseNum: split.house_num,
    city: (addr.citta || "").trim(),
    province: (addr.provincia || "").trim().toUpperCase(),
    zip: (addr.cap || "").trim(),
  };
}

export function applyVeicoloEGaranzie(opts: {
  form: RcaPreventivoForm;
  targa?: string | null;
  tipo?: TipoClientelaRca | null;
  marca?: string | null;
  modello?: string | null;
  titoloId?: string | null;
  veicoloId?: string | null;
  compagnia?: string | null;
  scadenzaIso?: string | null;
  garanzie?: VoceGaranziaPolizza[];
}): RcaPreventivoForm {
  return {
    ...opts.form,
    targa: (opts.targa || opts.form.targa || "").toUpperCase(),
    prodottoCode: prodottoFromTipo(opts.tipo),
    titoloId: opts.titoloId ?? opts.form.titoloId,
    veicoloId: opts.veicoloId ?? opts.form.veicoloId,
    brand: (opts.marca || opts.form.brand || "").toUpperCase(),
    model: (opts.modello || opts.form.model || "").toUpperCase(),
    currentProvider: opts.compagnia || opts.form.currentProvider,
    insuranceExpire: isoToGgMmAaaa(opts.scadenzaIso) || opts.form.insuranceExpire,
    garanzie: opts.garanzie ? mapGaranziePolizzaToAssicurapp(opts.garanzie) : opts.form.garanzie,
    cvtPacchetto: opts.garanzie
      ? danniPacchettoFromGaranzie(mapGaranziePolizzaToAssicurapp(opts.garanzie))
      : opts.form.cvtPacchetto,
  };
}

export function snapshotsFromForm(form: RcaPreventivoForm) {
  const client_snapshot = {
    name: form.name.trim().toUpperCase(),
    surname: form.surname.trim().toUpperCase(),
    cf: form.cf.trim().toUpperCase(),
    gender: form.gender,
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: {
      partials: {
        address: form.address.trim().toUpperCase(),
        house_num: form.houseNum.trim().toUpperCase(),
        city: form.city.trim(),
        province: form.province.trim().toUpperCase(),
        ZIP_code: form.zip.trim(),
      },
      full_address: buildFullAddress(form),
    },
    display_name: clienteDisplayFromForm(form),
  };
  const vehicle_snapshot = {
    plate: form.targa.trim().toUpperCase(),
    brand: form.brand.trim().toUpperCase(),
    model: form.model.trim().toUpperCase(),
    value: Number(form.value) || 0,
    sat: form.sat,
    body_type: "",
  };
  const quote_snapshot = {
    insurance_type: form.insuranceType,
    bersani: { bersani_plate: form.bersaniPlate.toUpperCase(), bersani_cf: form.bersaniCf.toUpperCase() },
    driving_type: form.drivingType,
    fractionation: form.fractionation,
    guarantees: form.garanzie,
    selected_CVTs: resolveSelectedCvts({
      quoteKind: form.quoteKind,
      garanzie: form.garanzie,
      cvtPacchetto: form.cvtPacchetto,
    }),
    quote_kind: form.quoteKind,
    cvt_pacchetto: form.cvtPacchetto,
    insurance: {
      current_insurance_provider: form.currentProvider,
      insurance_expire: form.insuranceExpire,
    },
    note: form.note,
  };
  return { client_snapshot, vehicle_snapshot, quote_snapshot };
}

export function formFromPreventivoRow(row: RcaPreventivoRow): RcaPreventivoForm {
  const c = (row.client_snapshot || {}) as Record<string, any>;
  const v = (row.vehicle_snapshot || {}) as Record<string, any>;
  const q = (row.quote_snapshot || {}) as Record<string, any>;
  const partials = c.address?.partials || {};
  return {
    targa: row.targa,
    clienteId: row.cliente_id,
    titoloId: row.titolo_id,
    veicoloId: row.veicolo_id,
    prodottoCode: row.prodotto_code,
    name: c.name || "",
    surname: c.surname || "",
    cf: c.cf || "",
    gender: c.gender || "",
    phone: c.phone || "",
    email: c.email || "",
    address: partials.address || "",
    houseNum: partials.house_num || "",
    city: partials.city || "",
    province: partials.province || "",
    zip: partials.ZIP_code || "",
    brand: v.brand || "",
    model: v.model || "",
    value: v.value != null ? String(v.value) : "",
    sat: !!v.sat,
    insuranceType: (row.insurance_type as InsuranceTypeRca) || "continuita_assicurativa",
    drivingType: row.driving_type === "Libera" ? "Libera" : "Esperta",
    fractionation: row.fractionation === 2 ? 2 : 1,
    bersaniPlate: row.bersani_plate || q.bersani?.bersani_plate || "",
    bersaniCf: row.bersani_cf || q.bersani?.bersani_cf || "",
    currentProvider: q.insurance?.current_insurance_provider || "",
    insuranceExpire: q.insurance?.insurance_expire || "",
    garanzie: (row.garanzie_richieste || []) as CodiceGaranziaAssicurapp[],
    quoteKind: q.quote_kind === "cvt" ? "cvt" : "rca",
    cvtPacchetto: (q.cvt_pacchetto as CvtPacchettoValue) || danniPacchettoFromGaranzie(row.garanzie_richieste),
    note: row.note || "",
  };
}

export function statoPreventivoLabel(stato: string): string {
  const map: Record<string, string> = {
    bozza: "Bozza",
    pronto: "Pronto per quotazione",
    in_quotazione: "In quotazione",
    quotato: "Quotato",
    salvato: "Salvato",
  };
  return map[stato] || stato;
}

export { resolveClienteNome };
