import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function nomeDaUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || 'bando.pdf'
    return decodeURIComponent(last)
  } catch {
    return 'bando.pdf'
  }
}

function inferTipo(nome: string, url: string): string {
  const blob = `${nome} ${url}`.toLowerCase()
  if (/esito|aggiudic|award|canv/.test(blob)) return 'esito'
  if (/disciplinar/.test(blob)) return 'disciplinare'
  if (/capitolat/.test(blob)) return 'capitolato'
  if (/chiariment|faq|quesit/.test(blob)) return 'chiarimento'
  if (/bando|avviso|notice|ted/.test(blob)) return 'bando'
  return 'altro'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { bando_id, pdf_url, harvest_run_id, tipo, nome: nomeIn, primario } = await req.json()

    if (!bando_id || !pdf_url) {
      return new Response(JSON.stringify({ error: 'bando_id e pdf_url sono obbligatori' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: bando, error: bandoError } = await supabase
      .from('bandi_pubblici')
      .select('scheda_id, pdf_url')
      .eq('id', bando_id)
      .single()

    if (bandoError || !bando) {
      return new Response(JSON.stringify({ error: 'Bando non trovato' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfRes = await fetch(pdf_url)
    if (!pdfRes.ok) {
      return new Response(JSON.stringify({ error: `Impossibile scaricare il PDF: ${pdfRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfBuffer = await pdfRes.arrayBuffer()
    const head = new Uint8Array(pdfBuffer.slice(0, 5))
    const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
    if (!isPdf) {
      return new Response(JSON.stringify({ error: 'Il file scaricato non è un PDF' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const hash = await sha256Hex(pdfBuffer)
    const safeScheda = String(bando.scheda_id).replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `bandi/${safeScheda}/${hash.slice(0, 16)}.pdf`
    const nome = String(nomeIn || '').trim() || nomeDaUrl(pdf_url)
    const tipoDoc = tipo || inferTipo(nome, pdf_url)

    const { error: uploadError } = await supabase.storage
      .from('documenti_generali')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: `Errore upload: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existing } = await supabase
      .from('bandi_documenti')
      .select('id, hash_sha256')
      .eq('bando_id', bando_id)
      .eq('url_origine', pdf_url)
      .maybeSingle()

    const stato = !existing ? 'nuovo' : existing.hash_sha256 === hash ? 'invariato' : 'aggiornato'
    const now = new Date().toISOString()
    const docRow = {
      bando_id,
      harvest_run_id: harvest_run_id || null,
      tipo: tipoDoc,
      nome,
      mime: 'application/pdf',
      url_origine: pdf_url,
      storage_path: fileName,
      hash_sha256: hash,
      stato,
      visto_il: now,
      scaricato_il: now,
    }

    if (existing?.id) {
      const { error: docErr } = await supabase.from('bandi_documenti').update(docRow).eq('id', existing.id)
      if (docErr) console.error('Update documento:', docErr)
    } else {
      const { error: docErr } = await supabase.from('bandi_documenti').insert(docRow)
      if (docErr) console.error('Insert documento:', docErr)
    }

    const updateScheda = primario === true || !bando.pdf_url || bando.pdf_url === pdf_url
    if (updateScheda) {
      const { error: updateError } = await supabase
        .from('bandi_pubblici')
        .update({ pdf_path: fileName, pdf_url })
        .eq('id', bando_id)

      if (updateError) {
        console.error('Update error:', updateError)
        return new Response(JSON.stringify({ error: `Errore aggiornamento: ${updateError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pdf_path: fileName,
      hash_sha256: hash,
      stato,
      tipo: tipoDoc,
      nome,
      documento_id: existing?.id || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in scarica-bando-pdf:', error)
    return new Response(JSON.stringify({ error: error.message || 'Errore interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
