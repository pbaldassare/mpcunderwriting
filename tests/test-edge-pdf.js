import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  const adminEmail = 'segreteria@consulbrokers.it';
  const password = 'Leone123!';
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: password
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('Logged in successfully. Access token:', authData.session.access_token);

  // Invoke edge function directly via fetch so we can see the exact error response body
  const url = `${supabaseUrl}/functions/v1/genera-pdf-template`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.session.access_token}`
    },
    body: JSON.stringify({
      tipo: 'sospesix', // let's try a wrong tipo to see if it replies 400
      dati: []
    })
  });

  console.log('Wrong tipo response status:', response.status);
  console.log('Wrong tipo response body:', await response.text());

  const response2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.session.access_token}`
    },
    body: JSON.stringify({
      tipo: 'sospesi',
      dati: [
        {
          numero_polizza: 'TEST-123',
          cliente: 'John Doe',
          compagnia: 'Allianz',
          ramo: 'RCA',
          premio_lordo: 500.20,
          data_sospensione: '01/01/2026',
          giorni_sospeso: '10 gg',
          responsabile: 'Mario Rossi'
        }
      ],
      filtri: {
        Ufficio: 'Napoli',
        Compagnia: 'Allianz'
      }
    })
  });

  // Query one row from titoli to see schema
  const { data: rows, error: err } = await supabase
    .from('titoli')
    .select('*')
    .limit(1);
  console.log('titoli row:', rows ? rows[0] : null, 'Error:', err);
}

run();


