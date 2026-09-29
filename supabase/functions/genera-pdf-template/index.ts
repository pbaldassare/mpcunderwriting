import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocType = "preventivo" | "quietanza" | "riepilogo_polizza" | "sir" | "sospesi";

interface Body {
  tipo: DocType;
  cliente_id?: string;
  titolo_id?: string;
  sinistro_id?: string;
  dati_sir?: any;
  dati?: any[];
  filtri?: any;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return { r: 14 / 255, g: 116 / 255, b: 144 / 255 };
  return { r: parseInt(m[0], 16) / 255, g: parseInt(m[1], 16) / 255, b: parseInt(m[2], 16) / 255 };
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2 }).format(n) + " €";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT");
}

const TITLES: Record<DocType, string> = {
  preventivo: "PREVENTIVO ASSICURATIVO",
  quietanza: "QUIETANZA DI PAGAMENTO",
  riepilogo_polizza: "RIEPILOGO POLIZZA",
  sir: "REPORT SANITARIO SIR",
  sospesi: "REPORT POLIZZE SOSPESE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { tipo, cliente_id, titolo_id } = body;
    if (!tipo || !["preventivo", "quietanza", "riepilogo_polizza", "sir", "sospesi"].includes(tipo)) {
      return new Response(JSON.stringify({ error: "tipo non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Cliente (serve anche ufficio_id per il branding sede)
    let cliente: any = null;
    if (cliente_id) {
      const { data } = await admin
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, email, indirizzo_residenza, indirizzo_sede, citta_residenza, citta_sede, cap_residenza, cap_sede, tipo_cliente, ufficio_id")
        .eq("id", cliente_id)
        .maybeSingle();
      cliente = data;
    }

    // Titolo + relations
    let titolo: any = null;
    if (titolo_id) {
      const { data } = await admin
        .from("titoli")
        .select("id, numero_titolo, data_decorrenza, data_scadenza, premio_lordo, premio_netto, ufficio_id, cliente_anagrafica_id, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio, indirizzo, email, telefono)")
        .eq("id", titolo_id)
        .maybeSingle();
      titolo = data;
      if (titolo && !cliente && titolo.cliente_anagrafica_id) {
        const { data: c } = await admin
          .from("clienti")
          .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, email, indirizzo_residenza, indirizzo_sede, citta_residenza, citta_sede, tipo_cliente, ufficio_id")
          .eq("id", titolo.cliente_anagrafica_id)
          .maybeSingle();
        cliente = c;
      }
    }

    const brandingUfficio = titolo?.ufficio_id || cliente?.ufficio_id || null;
    let branding: { logo_url: string | null; colore_primario: string | null } | null = null;
    if (brandingUfficio) {
      const { data } = await admin
        .from("email_branding")
        .select("logo_url, colore_primario")
        .eq("ufficio_id", brandingUfficio)
        .maybeSingle();
      branding = data;
    }
    if (!branding) {
      const { data } = await admin
        .from("email_branding")
        .select("logo_url, colore_primario")
        .is("ufficio_id", null)
        .maybeSingle();
      branding = data;
    }
    if (!branding) {
      const { data } = await admin
        .from("email_branding")
        .select("logo_url, colore_primario")
        .limit(1)
        .maybeSingle();
      branding = data;
    }

    const color = hexToRgb(branding?.colore_primario || "#0e7490");

    let sinistro: any = null;
    if (body.sinistro_id) {
      const { data: s } = await admin
        .from("sinistri")
        .select("id, numero_sinistro, data_evento, luogo_sinistro, clienti(id, nome, cognome, ragione_sociale)")
        .eq("id", body.sinistro_id)
        .maybeSingle();
      sinistro = s;
    }

    // Build PDF
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    // Header band
    page.drawRectangle({
      x: 0,
      y: height - 90,
      width,
      height: 90,
      color: rgb(color.r, color.g, color.b),
    });

    // Logo (try fetch)
    let logoDrawn = false;
    if (branding?.logo_url) {
      try {
        const resp = await fetch(branding.logo_url);
        if (resp.ok) {
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const ct = resp.headers.get("content-type") || "";
          let img;
          if (ct.includes("png") || branding.logo_url.toLowerCase().endsWith(".png")) {
            img = await pdf.embedPng(bytes);
          } else {
            img = await pdf.embedJpg(bytes);
          }
          const scale = Math.min(60 / img.height, 180 / img.width);
          page.drawImage(img, {
            x: 30,
            y: height - 75,
            width: img.width * scale,
            height: img.height * scale,
          });
          logoDrawn = true;
        }
      } catch (e) {
        console.warn("Logo fetch failed", e);
      }
    }
    if (!logoDrawn) {
      page.drawText("ConsulNet", {
        x: 30,
        y: height - 55,
        size: 22,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }

    page.drawText(TITLES[tipo], {
      x: width - 30 - fontBold.widthOfTextAtSize(TITLES[tipo], 14),
      y: height - 55,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    let y = height - 130;
    const left = 40;
    const labelColor = rgb(0.4, 0.4, 0.45);
    const textColor = rgb(0.1, 0.1, 0.15);

    function row(label: string, value: string, gap = 22) {
      page.drawText(label, { x: left, y, size: 9, font, color: labelColor });
      page.drawText(value || "—", { x: left + 130, y, size: 11, font: fontBold, color: textColor });
      y -= gap;
    }

    function section(title: string) {
      y -= 6;
      page.drawText(title.toUpperCase(), { x: left, y, size: 10, font: fontBold, color: rgb(color.r, color.g, color.b) });
      y -= 6;
      page.drawLine({
        start: { x: left, y },
        end: { x: width - 40, y },
        thickness: 0.8,
        color: rgb(color.r, color.g, color.b),
      });
      y -= 16;
    }

    // Date / numero documento
    const docNum = `${tipo.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
    section("Documento");
    row("Numero", docNum);
    row("Data emissione", new Date().toLocaleDateString("it-IT"));

    // Cliente
    if (cliente) {
      section("Intestatario");
      const isAzienda = cliente.tipo_cliente === "azienda" || cliente.tipo_cliente === "ente";
      row(isAzienda ? "Ragione Sociale" : "Nominativo",
        isAzienda ? (cliente.ragione_sociale || "") : `${cliente.cognome || ""} ${cliente.nome || ""}`.trim());
      row(isAzienda ? "Partita IVA" : "Codice Fiscale", cliente.partita_iva || cliente.codice_fiscale || "");
      const indirizzo = cliente.indirizzo_sede || cliente.indirizzo_residenza || "";
      const citta = cliente.citta_sede || cliente.citta_residenza || "";
      row("Indirizzo", indirizzo);
      row("Città", citta);
      if (cliente.email) row("Email", cliente.email);
    }

    // Polizza
    if (titolo) {
      section("Riferimenti polizza");
      row("Numero polizza", titolo.numero_titolo || "");
      row("Compagnia", titolo.prodotti?.compagnie?.nome || "");
      row("Prodotto", titolo.prodotti?.nome_prodotto || "");
      row("Decorrenza", fmtDate(titolo.data_decorrenza));
      row("Scadenza", fmtDate(titolo.data_scadenza));
      row("Premio lordo", fmtMoney(titolo.premio_lordo));
    }

    if (tipo === "sir") {
      section("1. Dati Infortunato");
      const ds = body.dati_sir || {};
      row("Nominativo", `${ds.cognome || ""} ${ds.nome || ""}`.trim());
      row("Codice Fiscale", ds.codice_fiscale || "");
      row("Data Nascita", fmtDate(ds.data_nascita));
      row("Luogo Nascita", ds.luogo_nascita || "");
      row("Professione", ds.professione || "");
      row("Indirizzo", ds.indirizzo || "");

      section("2. Dettagli Evento");
      row("Data Accadimento", fmtDate(ds.data_evento));
      row("Luogo Accadimento", ds.luogo_evento || "");
      row("Testimoni", ds.testimoni || "Nessuno");
      
      y -= 10;
      page.drawText("Dinamica dell'evento:", { x: left, y, size: 9, font, color: labelColor });
      y -= 12;
      page.drawText(ds.dinamica || "—", { x: left, y, size: 10, font: fontBold, color: textColor });
      y -= 20;

      section("3. Valutazione Medica");
      row("Medico Curante", ds.medico_curante || "");
      row("Struttura Sanitaria", ds.struttura_sanitaria || "");
      row("Diagnosi Clinica", ds.diagnosi || "");
      row("Giorni Prognosi", String(ds.prognosi_giorni || 0));
      row("Fine Prognosi", fmtDate(ds.data_fine_prognosi));

      section("4. Invalidità / Decesso");
      row("Inv. Temporanea", ds.invalidita_temporanea ? `Sì (${ds.invalidita_temporanea_giorni || 0} gg)` : "No");
      row("Inv. Permanente", ds.invalidita_permanente ? `Sì (${ds.invalidita_permanente_pct || 0} %)` : "No");
    } else if (tipo === "sospesi") {
      section("Filtri Applicati");
      const flt = body.filtri || {};
      for (const [k, v] of Object.entries(flt)) {
        row(k, String(v));
      }

      y -= 10;
      section("Polizze Sospese");
      
      const datiSospesi = body.dati || [];
      if (datiSospesi.length === 0) {
        page.drawText("Nessuna polizza sospesa", { x: left, y, size: 10, font, color: textColor });
        y -= 20;
      } else {
        for (const d of datiSospesi) {
          if (y < 100) {
            page = pdf.addPage([595, 842]);
            y = 780;
            page.drawText("REPORT POLIZZE SOSPESE (Continua)", { x: left, y, size: 8, font: fontBold, color: rgb(color.r, color.g, color.b) });
            y -= 15;
          }
          page.drawText(`Polizza: ${d.numero_polizza || "—"} | Cliente: ${d.cliente || "—"}`, { x: left, y, size: 9, font: fontBold, color: textColor });
          y -= 12;
          page.drawText(`Compagnia: ${d.compagnia || "—"} | Ramo: ${d.ramo || "—"} | Premio: ${fmtMoney(d.premio_lordo)}`, { x: left, y, size: 8, font, color: labelColor });
          y -= 12;
          page.drawText(`Sospesa il: ${d.data_sospensione || "—"} (${d.giorni_sospeso || "0 gg"}) | Responsabile: ${d.responsabile || "—"}`, { x: left, y, size: 8, font, color: labelColor });
          y -= 18;
        }
      }
    } else {
      // Body specifico per tipo
      section(tipo === "preventivo" ? "Offerta" : tipo === "quietanza" ? "Conferma di pagamento" : "Riepilogo");
      const introTextByType: Record<DocType, string> = {
        preventivo: "Con la presente Vi sottoponiamo l'offerta assicurativa relativa al rischio in oggetto, alle condizioni e ai premi sotto riportati. Il presente preventivo ha validità di 30 giorni dalla data di emissione, salvo verifica positiva delle condizioni di rischio.",
        quietanza: "Con la presente si conferma l'avvenuto incasso del premio relativo alla polizza in oggetto. Il presente documento ha valore di quietanza ai sensi dell'art. 1199 c.c. La copertura assicurativa si intende regolarmente in essere alle condizioni contrattuali sottoscritte.",
        riepilogo_polizza: "Il presente documento riepiloga i dati essenziali della polizza in oggetto. Si invita il Cliente a verificare la correttezza delle informazioni e a segnalare tempestivamente eventuali discordanze.",
        sir: "N/D"
      };
      const intro = introTextByType[tipo];
      const wrap = (txt: string, maxChars = 95): string[] => {
        const words = txt.split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          if ((cur + " " + w).trim().length > maxChars) {
            lines.push(cur.trim());
            cur = w;
          } else cur += " " + w;
        }
        if (cur.trim()) lines.push(cur.trim());
        return lines;
      };
      for (const ln of wrap(intro)) {
        page.drawText(ln, { x: left, y, size: 10, font, color: textColor });
        y -= 14;
      }
    }

    // Footer
    const footerY = 40;
    page.drawLine({
      start: { x: left, y: footerY + 30 },
      end: { x: width - 40, y: footerY + 30 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.9),
    });
    const sedeName = titolo?.uffici?.nome_ufficio || "ConsulNet";
    const sedeIndirizzo = titolo?.uffici?.indirizzo || "";
    const sedeContatti = [titolo?.uffici?.telefono, titolo?.uffici?.email].filter(Boolean).join(" • ");
    page.drawText(sedeName, { x: left, y: footerY + 14, size: 9, font: fontBold, color: labelColor });
    page.drawText(sedeIndirizzo, { x: left, y: footerY + 2, size: 8, font, color: labelColor });
    page.drawText(sedeContatti, { x: left, y: footerY - 10, size: 8, font, color: labelColor });
    page.drawText(`Documento generato il ${new Date().toLocaleString("it-IT")}`, {
      x: width - 40 - font.widthOfTextAtSize(`Documento generato il ${new Date().toLocaleString("it-IT")}`, 7),
      y: footerY - 10,
      size: 7,
      font,
      color: labelColor,
    });

    const pdfBytes = await pdf.save();
    // base64 encode
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const filename = `${tipo}-${docNum}.pdf`;

    return new Response(JSON.stringify({ success: true, filename, content: base64 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("genera-pdf-template error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Errore interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
