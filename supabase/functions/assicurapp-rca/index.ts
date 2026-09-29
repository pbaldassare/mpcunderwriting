import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AssicurappProduct = {
  code: string;
  name: string;
  type: string;
  attachments?: unknown[];
  properties?: unknown;
  product_config?: {
    insurance_companies?: unknown[];
    brokerage_fee?: Record<string, unknown>;
    attachments?: unknown[];
  };
};

type AssicurappOffer = {
  id?: string | number;
  company_slug?: string;
  label?: string;
  prices?: Record<string, unknown>;
  status?: string;
  notes?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readSetting(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "token" in (value as Record<string, unknown>)) {
    return String((value as { token?: unknown }).token || "").trim();
  }
  return "";
}

async function getConfig(supabase: ReturnType<typeof createClient>) {
  const envToken = (Deno.env.get("ASSICURAPP_API_TOKEN") || "").trim();
  const envBase = (Deno.env.get("ASSICURAPP_BASE_URL") || "").trim();
  const envUser = (Deno.env.get("ASSICURAPP_USER_UID") || "").trim();
  let token = envToken;
  let baseUrl = envBase || "https://assicurapp-api.lucadaniele.it";
  let userUid = envUser || "f759e35e9411472cb51231a1ff97d12a";
  const { data } = await supabase
    .from("impostazioni_sistema")
    .select("chiave, valore_json")
    .in("chiave", ["assicurapp_api_token", "assicurapp_base_url", "assicurapp_user_uid"]);
  for (const row of data || []) {
    const raw = readSetting(row.valore_json);
    if (row.chiave === "assicurapp_api_token" && !token && raw) token = raw;
    if (row.chiave === "assicurapp_base_url" && !envBase && raw) baseUrl = raw;
    if (row.chiave === "assicurapp_user_uid" && !envUser && raw) userUid = raw;
  }
  if (!token) throw new Error("ASSICURAPP_API_TOKEN non configurato");
  return { baseUrl: baseUrl.replace(/\/$/, ""), token, userUid };
}

async function assicurAppFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string; baseUrl?: string } = {},
): Promise<T> {
  const baseUrl = options.baseUrl || (Deno.env.get("ASSICURAPP_BASE_URL") || "https://assicurapp-api.lucadaniele.it").replace(/\/$/, "");
  const token = options.token || Deno.env.get("ASSICURAPP_API_TOKEN");
  if (!token) throw new Error("ASSICURAPP_API_TOKEN non configurato");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data: T & { status?: string; message?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Risposta Assicurapp non valida (${response.status}): ${text.slice(0, 180)}`);
  }
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || `Errore Assicurapp ${response.status}`);
  }
  return data;
}

function genderFromCf(cf?: string, fallback?: string): string {
  const g = String(fallback || "").trim().toUpperCase();
  if (g === "M" || g === "F") return g;
  const raw = String(cf || "").toUpperCase();
  if (raw.length < 11) return "";
  const day = parseInt(raw.substring(9, 11), 10);
  if (Number.isNaN(day)) return "";
  return day > 40 ? "F" : "M";
}

function selectedCvtsFromGaranzie(garanzie: string[] | null | undefined): string[] {
  const g = new Set(garanzie || []);
  const cvts: string[] = [];
  if (g.has("infortuni_conducente")) cvts.push("IF");
  if (g.has("furto_incendio") || g.has("eventi_naturali") || g.has("atti_vandalici")) cvts.push("IFE");
  if (g.has("collisione")) cvts.push("IFE C");
  if (g.has("kasko")) cvts.push("IFE K");
  return cvts;
}

function hasPending(offerte: AssicurappOffer[]): boolean {
  return offerte.some((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "pending" || s === "in_progress" || s === "running" || s === "processing";
  });
}

function hasCompleted(offerte: AssicurappOffer[]): boolean {
  return offerte.some((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "completed" || s === "success" || s === "ok";
  });
}

function deriveStato(offerte: AssicurappOffer[], quoteUid: string | null): string {
  if (!quoteUid) return "pronto";
  if (hasPending(offerte)) return "in_quotazione";
  if (hasCompleted(offerte)) return "quotato";
  return "in_quotazione";
}

function buildProductConfigString(product: AssicurappProduct): string {
  const config = product.product_config || {};
  return JSON.stringify({
    code: product.code,
    name: product.name,
    type: product.type,
    attachments: product.attachments || config.attachments || [],
    brokerage_fee: config.brokerage_fee || {
      max: { value: 0, enabled: false },
      min: { value: 0, enabled: false },
      emission_rights_val: 0,
    },
    insurance_companies: config.insurance_companies || [],
    properties: product.properties ?? null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ ok: false, error: "Non autenticato" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("ruolo, attivo")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile || profile.attivo === false || ["cliente", "prospect"].includes(String(profile.ruolo))) {
      return json({ ok: false, error: "Permesso negato" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const azione = body?.azione === "poll" ? "poll" : "quota";
    const preventivoId = String(body?.preventivo_id || "");
    if (!preventivoId) return json({ ok: false, error: "preventivo_id obbligatorio" }, 400);

    const { data: row, error: loadErr } = await supabase
      .from("rca_preventivi")
      .select("*")
      .eq("id", preventivoId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!row) return json({ ok: false, error: "Preventivo non trovato" }, 404);

    let quoteUid = row.quote_uid as string | null;
    const cfg = await getConfig(supabase);

    if (azione === "quota" && !quoteUid) {
      const productsRes = await assicurAppFetch<{ status: string; products: AssicurappProduct[] }>(
        "/api/products/list?checkConfig=true",
        { token: cfg.token, baseUrl: cfg.baseUrl },
      );
      const quoteKind = String((row.quote_snapshot as { quote_kind?: string } | null)?.quote_kind || "");
      const productCode =
        quoteKind === "cvt"
          ? "cvt_standalone"
          : row.prodotto_code === "rca_autocarri"
            ? "rca_autocarri"
            : "rca_auto";
      const product = (productsRes.products || []).find((p) => p.code === productCode);
      if (!product) {
        throw new Error(`Prodotto ${productCode} non configurato per questa agenzia`);
      }

      const client = (row.client_snapshot || {}) as Record<string, any>;
      const vehicle = (row.vehicle_snapshot || {}) as Record<string, any>;
      const quote = (row.quote_snapshot || {}) as Record<string, any>;
      const garanzie = Array.isArray(row.garanzie_richieste) ? row.garanzie_richieste : [];
      const savedCvts = Array.isArray(row.selected_cvts) ? row.selected_cvts.filter(Boolean) : [];
      const cvts = savedCvts.length > 0 ? savedCvts : selectedCvtsFromGaranzie(garanzie);
      const userUid = cfg.userUid;
      const plate = String(row.targa || vehicle.plate || "").toUpperCase().replace(/[\s-]/g, "");

      const clientData = {
        name: client.name || "",
        surname: client.surname || "",
        cf: String(client.cf || "").toUpperCase(),
        gender: genderFromCf(client.cf, client.gender),
        phone: String(client.phone || "").replace(/\s+/g, ""),
        email: client.email || "",
        address: client.address || {
          full_address: "",
          partials: { address: "", house_num: "", city: "", province: "", ZIP_code: "" },
        },
      };
      const vehicleData = {
        plate,
        value: Number(vehicle.value) || 0,
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        sat: !!vehicle.sat,
        registration_date: vehicle.registration_date || "",
        cc: 0,
        body_type: vehicle.body_type || "",
      };
      const quoteData = {
        driving_type: row.driving_type || "Esperta",
        license_years: 0,
        insurance_type: row.insurance_type || "continuita_assicurativa",
        is_renewal: false,
        fractionation: Number(row.fractionation) === 2 ? 2 : 1,
        bersani: {
          bersani_plate: String(row.bersani_plate || quote.bersani?.bersani_plate || "").toUpperCase(),
          bersani_cf: String(row.bersani_cf || quote.bersani?.bersani_cf || "").toUpperCase(),
        },
        guarantees: garanzie,
        selected_CVTs: cvts,
        selected_products: { quote: {}, CVT: {}, additional_guarantees: [] },
        quote_total: {
          orig_total: 0,
          total: 0,
          leverage: 0,
          emission_fees: 0,
          agency_fees: 0,
          agent_emission_fees: 0,
          provider_fees: 0,
        },
        insurance: {
          cu: quote.insurance?.cu || "",
          atr: quote.insurance?.atr || {},
          current_insurance_provider: quote.insurance?.current_insurance_provider || "",
          insurance_expire: quote.insurance?.insurance_expire || "",
        },
        note: row.note || quote.note || "",
        documents_status: "pending",
      };

      const saved = await assicurAppFetch<{ status: string; quoteUID?: string }>(
        "/api/quotes/save",
        {
          token: cfg.token,
          baseUrl: cfg.baseUrl,
          method: "POST",
          body: {
            action: "add",
            quoteUID: "",
            user_uid: userUid,
            plate,
            client_name: `${clientData.name} ${clientData.surname}`.trim() || client.display_name || plate,
            client_cf: clientData.cf,
            client_data: JSON.stringify(clientData),
            vehicle_data: JSON.stringify(vehicleData),
            quote_data: JSON.stringify(quoteData),
            product_config: buildProductConfigString(product),
          },
        },
      );
      quoteUid = saved.quoteUID || null;
      if (!quoteUid) throw new Error("quoteUID mancante nella risposta Assicurapp");
    }

    if (!quoteUid) return json({ ok: false, error: "Preventivo senza quoteUID" }, 400);

    const offersRes = await assicurAppFetch<{ status: string; quotes?: AssicurappOffer[] }>(
      `/api/quotes/quote_offers?quoteUID=${encodeURIComponent(quoteUid)}`,
      { token: cfg.token, baseUrl: cfg.baseUrl },
    );
    const offerte = offersRes.quotes || [];
    const stato = row.stato === "salvato" ? "salvato" : deriveStato(offerte, quoteUid);
    const cvts = Array.isArray(row.selected_cvts) && row.selected_cvts.length
      ? row.selected_cvts
      : selectedCvtsFromGaranzie(row.garanzie_richieste);

    const quoteSnapshot = {
      ...((row.quote_snapshot || {}) as Record<string, unknown>),
      assicurapp_user_uid: cfg.userUid,
    };
    const { data: updated, error: updErr } = await supabase
      .from("rca_preventivi")
      .update({
        quote_uid: quoteUid,
        stato,
        selected_cvts: cvts,
        offerte_snapshot: offerte,
        quote_snapshot: quoteSnapshot,
      })
      .eq("id", preventivoId)
      .select("*")
      .single();
    if (updErr) throw updErr;

    return json({
      ok: true,
      preventivo: updated,
      quote_uid: quoteUid,
      offerte,
      pending: hasPending(offerte),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore Assicurapp";
    console.error("[assicurapp-rca]", message);
    return json({ ok: false, error: message }, 500);
  }
});
