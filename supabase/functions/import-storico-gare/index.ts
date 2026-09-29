// Edge function: import storico gare da Excel multi-foglio
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RowOut {
  anno_riferimento: number;
  ente_nome: string;
  provincia?: string | null;
  tipologia?: string | null;
  esito?: string | null;
  broker_incumbent?: string | null;
  data_consegna?: string | null;
  data_inizio_mandato?: string | null;
  data_fine_mandato?: string | null;
  opzione_rinnovo?: string | null;
  flag_cauzione?: boolean | null;
  flag_referenze_bancarie?: boolean | null;
  flag_accesso_atti?: boolean | null;
  flag_offerta_tecnica?: boolean | null;
  pagine_offerta_tecnica?: string | null;
  note?: string | null;
  contatto_riferimento?: string | null;
  contatto_telefono?: string | null;
  source_sheet: string;
  source_row: number;
}

function parseDate(v: any): string | null {
  if (v === null || v === undefined || v === '' || v === '#REF!') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  // Try common formats: dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dn = parseInt(d), mn = parseInt(mo), yn = parseInt(y);
    if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
    const dt = new Date(yn, mn - 1, dn);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseFlag(v: any): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toUpperCase();
  if (s === '' || s === '-' || s === 'N/A' || s === 'NA') return null;
  if (s === 'SI' || s === 'S' || s === 'X' || s === 'YES' || s === 'Y') return true;
  if (s === 'NO' || s === 'N') return false;
  // ELBA, ITAS = nome compagnia di cauzione → true
  if (/^[A-Z]{3,}$/.test(s)) return true;
  return null;
}

function deriveEsito(notes: string | null): string | null {
  if (!notes) return null;
  const u = notes.toUpperCase();
  if (/AGGIUDICAT|VINTA/.test(u)) return 'vinta';
  if (/ANNULLAT|REVOCAT/.test(u)) return 'annullata';
  if (/NON ESTRATT|NON SORTEGG|NON PARTECIP/.test(u)) return 'non_partecipato';
  if (/IN ATTESA|IN VALUTAZ|IN CORSO/.test(u)) return 'in_corso';
  if (/PERSA|NON AGGIUDICAT/.test(u)) return 'persa';
  return null;
}

function isRiepilogo(firstCell: any): boolean {
  if (!firstCell) return false;
  const s = String(firstCell).toUpperCase().trim();
  return /^(TOT|TOTALE|GARA VINTE|PERCENTUALE|RIEPILOGO|N\.|NUMERO TOTALE)/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify role
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: profile } = await supabase.from('profiles').select('ruolo').eq('id', userData.user.id).single();
    if (!profile || !['admin', 'responsabile_sede'].includes(profile.ruolo)) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Body: { fileBase64, fileName, replace? }
    const body = await req.json();
    const { fileBase64, fileName, replace } = body;
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: 'fileBase64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const buf = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });

    const allRows: RowOut[] = [];
    const stats = {
      sheets_processed: 0,
      skipped_empty: 0,
      skipped_riepilogo: 0,
      parse_errors_dates: 0,
    };

    for (const sheetName of wb.SheetNames) {
      // Estrai anno dal nome foglio (es. "2017", "2011 - 2015" → usa primo)
      const yearMatch = sheetName.match(/(\d{4})/);
      if (!yearMatch && sheetName.toUpperCase() !== 'INTERMEDIA') continue;
      const annoSheet = yearMatch ? parseInt(yearMatch[1]) : 0;

      const ws = wb.Sheets[sheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
      if (json.length < 2) continue;

      // Trova header row (riga con "ENTE" in una colonna)
      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, json.length); i++) {
        if (json[i].some(c => c && String(c).toUpperCase().trim() === 'ENTE')) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx < 0) continue;

      const headers = json[headerIdx].map(h => h ? String(h).toUpperCase().trim() : '');
      const colIdx = (...names: string[]) => {
        for (const n of names) {
          const i = headers.indexOf(n);
          if (i >= 0) return i;
        }
        return -1;
      };

      const iEnte = colIdx('ENTE');
      const iProv = colIdx('PROV', 'PV');
      const iTipologia = colIdx('TIPOLOGIA');
      const iBroker = colIdx('BROKER', 'AGGIUDICATARIO');
      const iNoteEsito = colIdx('NOTE'); // prima NOTE (esito)
      const iInizio = colIdx('INIZIO MANDATO');
      const iFine = colIdx('FINE MANDATO');
      const iOpz = colIdx('OPZIONE RINNOVO');
      const iCons = colIdx('CONSEGNA', 'INVIO');
      const iCauz = colIdx('CAUZIONE');
      const iRef = colIdx('REF. BANCARIE', 'REF.BANCARIE', 'REF BANCARIE');
      const iAcc = colIdx('ACCESSO');
      const iOff = colIdx('OFF. TECNICA', 'OFF.TECNICA', 'OFFERTA TECNICA');
      const iStruttura = colIdx('STRUTTURA OFF. TECNICA');
      const iTel = colIdx('TELEFONO');
      const iRifMail = colIdx('RIFERIMENTI MAIL', 'RIFERIMENTI');

      // Trova SECONDA "NOTE" (note libere) se presente
      let iNoteFree = -1;
      let firstFound = false;
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] === 'NOTE' || headers[i] === 'NOTE ') {
          if (firstFound) { iNoteFree = i; break; }
          firstFound = true;
        }
      }

      for (let r = headerIdx + 1; r < json.length; r++) {
        const row = json[r];
        if (!row || row.every(c => c === null || c === '' || c === undefined)) {
          stats.skipped_empty++;
          continue;
        }
        const ente = iEnte >= 0 ? row[iEnte] : null;
        if (!ente || !String(ente).trim()) { stats.skipped_empty++; continue; }
        if (isRiepilogo(ente)) { stats.skipped_riepilogo++; continue; }

        const noteEsito = iNoteEsito >= 0 ? (row[iNoteEsito] ? String(row[iNoteEsito]) : null) : null;
        const noteFree = iNoteFree >= 0 ? (row[iNoteFree] ? String(row[iNoteFree]) : null) : null;
        const combinedNotes = [noteEsito, noteFree].filter(Boolean).join(' | ') || null;

        const tipoRaw = iTipologia >= 0 && row[iTipologia] ? String(row[iTipologia]).toLowerCase().trim() : null;
        let tipologia: string | null = null;
        if (tipoRaw) {
          if (tipoRaw.includes('manifest')) tipologia = 'manifestazione';
          else if (tipoRaw.includes('gara')) tipologia = 'gara';
          else if (tipoRaw.includes('affidam')) tipologia = 'affidamento_diretto';
          else tipologia = 'altro';
        }

        const dataInizio = iInizio >= 0 ? parseDate(row[iInizio]) : null;
        const dataFine = iFine >= 0 ? parseDate(row[iFine]) : null;
        const dataCons = iCons >= 0 ? parseDate(row[iCons]) : null;
        if (iInizio >= 0 && row[iInizio] && !dataInizio) stats.parse_errors_dates++;
        if (iFine >= 0 && row[iFine] && !dataFine) stats.parse_errors_dates++;

        allRows.push({
          anno_riferimento: annoSheet || (dataCons ? parseInt(dataCons.slice(0, 4)) : new Date().getFullYear()),
          ente_nome: String(ente).trim(),
          provincia: iProv >= 0 && row[iProv] ? String(row[iProv]).trim() : null,
          tipologia,
          esito: deriveEsito(combinedNotes),
          broker_incumbent: iBroker >= 0 && row[iBroker] ? String(row[iBroker]).trim() : null,
          data_consegna: dataCons,
          data_inizio_mandato: dataInizio,
          data_fine_mandato: dataFine,
          opzione_rinnovo: iOpz >= 0 && row[iOpz] ? String(row[iOpz]).trim() : null,
          flag_cauzione: iCauz >= 0 ? parseFlag(row[iCauz]) : null,
          flag_referenze_bancarie: iRef >= 0 ? parseFlag(row[iRef]) : null,
          flag_accesso_atti: iAcc >= 0 ? parseFlag(row[iAcc]) : null,
          flag_offerta_tecnica: iOff >= 0 ? parseFlag(row[iOff]) : null,
          pagine_offerta_tecnica: iStruttura >= 0 && row[iStruttura] ? String(row[iStruttura]).trim().slice(0, 200) : null,
          note: combinedNotes,
          contatto_riferimento: iRifMail >= 0 && row[iRifMail] ? String(row[iRifMail]).trim() : null,
          contatto_telefono: iTel >= 0 && row[iTel] ? String(row[iTel]).trim() : null,
          source_sheet: sheetName,
          source_row: r + 1,
        });
      }
      stats.sheets_processed++;
    }

    if (replace) {
      await supabase.from('storico_gare').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Batch insert 200 alla volta
    let inserted = 0;
    let auto_linked = 0;
    const errors: string[] = [];
    for (let i = 0; i < allRows.length; i += 200) {
      const batch = allRows.slice(i, i + 200);
      const { data, error } = await supabase.from('storico_gare').insert(batch).select('id, ente_nome');
      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
      } else {
        inserted += data.length;
      }
    }

    // Auto-link clienti su ente_nome (best-effort)
    const { data: insertedRows } = await supabase
      .from('storico_gare')
      .select('id, ente_nome')
      .is('cliente_id', null)
      .limit(2000);
    if (insertedRows) {
      for (const sg of insertedRows) {
        const cleanName = sg.ente_nome.replace(/[%_]/g, ' ').slice(0, 50);
        const { data: matches } = await supabase
          .from('clienti')
          .select('id')
          .ilike('ragione_sociale', `${cleanName}%`)
          .limit(2);
        if (matches && matches.length === 1) {
          await supabase.from('storico_gare').update({ cliente_id: matches[0].id }).eq('id', sg.id);
          auto_linked++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...stats,
      inserted,
      auto_linked_clients: auto_linked,
      total_rows: allRows.length,
      errors: errors.slice(0, 5),
      fileName,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
