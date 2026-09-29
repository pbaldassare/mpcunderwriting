import { expect, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Credenziali di test.
 * Override possibile via variabili d'ambiente TEST_USER_EMAIL / TEST_USER_PASSWORD,
 * altrimenti si usano i valori forniti per la suite e2e.
 */
export const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'cloude@gmail.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Leone123!';

/**
 * Percorso dove viene salvato lo storageState (sessione autenticata) dal setup.
 * È gitignorato e ricreato a ogni run dal file 00-auth.setup.ts.
 */
export const STORAGE_STATE = path.resolve(process.cwd(), 'tests/.auth/user.json');

/** Rotte riservate esclusivamente al ruolo admin (RoleGuard). */
export const ADMIN_ONLY_ROUTES: { label: string; path: string }[] = [
  { label: 'Centro Utenti & Privilegi', path: '/utenti-privilegi' },
  { label: 'Backup & Export', path: '/backup-export' },
  { label: 'Manutenzione', path: '/manutenzione' },
  { label: 'Tabelle di Base', path: '/tabelle-base' },
  { label: 'Compagnie / Agenzie', path: '/compagnie' },
  { label: 'Gestione Uffici', path: '/gestione-uffici' },
  { label: 'Sitemap', path: '/sitemap' },
];

/** Rotte del portale cliente (ClienteGuard). */
export const CLIENTE_PORTAL_ROUTES: { label: string; path: string; heading?: RegExp }[] = [
  { label: 'Dashboard cliente', path: '/cliente', heading: /Benvenuto nella tua Area Clienti/i },
  { label: 'Polizze cliente', path: '/cliente/polizze', heading: /Polizze/i },
  { label: 'Documenti cliente', path: '/cliente/documenti' },
  { label: 'Scadenze cliente', path: '/cliente/scadenze' },
  { label: 'Anagrafica cliente', path: '/cliente/anagrafica' },
];

/** Rotte del gestionale che un utente cliente non deve raggiungere. */
export const GESTIONALE_BLOCKED_FOR_CLIENTE: string[] = [
  '/',
  '/archivi/clienti',
  '/titoli',
  '/utenti-privilegi',
  '/contabilita',
];

/**
 * Esegue il login via UI partendo dalla pagina /login e attende il redirect
 * verso una rotta autenticata (qualsiasi rotta diversa da /login).
 */
export async function login(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/login');

  // Il form di login può apparire dopo il bootstrap dell'auth (spinner iniziale)
  await page.waitForSelector('#email', { state: 'visible', timeout: 30_000 });

  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // onAuthStateChange aggiorna il context e il guard fa il <Navigate> reattivo.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

/**
 * Attende che la pagina si trovi su una URL attesa (regex o stringa).
 */
export async function expectOnRoute(page: Page, pattern: RegExp | string, timeout = 15_000): Promise<void> {
  if (typeof pattern === 'string') {
    await expect(page).toHaveURL(new RegExp(`${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`), { timeout });
  } else {
    await expect(page).toHaveURL(pattern, { timeout });
  }
}

/**
 * Naviga a una rotta protetta e verifica il redirect verso la home attesa del ruolo.
 */
export async function expectRouteBlocked(
  page: Page,
  path: string,
  expectedUrl: RegExp,
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page, `accesso a ${path} deve essere bloccato`).toHaveURL(expectedUrl, { timeout: 15_000 });
}

/**
 * Cerca un cliente per cognome nella lista anagrafica clienti.
 */
export async function searchClienti(page: Page, query: string): Promise<void> {
  await page.goto('/archivi/clienti');
  await page.getByPlaceholder('Cerca per nome, CF, P.IVA...').fill(query);
  await page.waitForTimeout(500);
}

/**
 * Cerca una polizza per numero nell'elenco titoli (premendo CERCA).
 */
export async function searchTitoli(page: Page, numeroPolizza: string): Promise<void> {
  await page.goto('/titoli');
  await page.getByPlaceholder('Numero polizza...').fill(numeroPolizza);
  await page.getByRole('button', { name: 'CERCA' }).click();
  await page.waitForTimeout(800);
}

/**
 * Logout via menu utente in Topbar ("Esci").
 */
export async function logout(page: Page): Promise<void> {
  // Il trigger del menu utente è il bottone con avatar in alto a destra
  await page.locator('header button').last().click();
  await page.getByRole('menuitem', { name: 'Esci' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 15_000 });
}

/**
 * Asserisce che la pagina corrente non sia in stato d'errore:
 * - non è stata espulsa verso /login
 * - non mostra l'AppErrorBoundary ("Si è verificato un errore...")
 * - non mostra la pagina 404 ("Page not found")
 */
export async function expectPageHealthy(page: Page): Promise<void> {
  await expect(page, 'non deve essere reindirizzato al login').not.toHaveURL(/\/login(\?|$)/);
  await expect(
    page.getByRole('heading', { name: /Si è verificato un errore/i }),
    'AppErrorBoundary non deve essere visibile',
  ).toHaveCount(0);
  await expect(
    page.getByText('Page not found', { exact: false }),
    'la rotta non deve cadere sul 404',
  ).toHaveCount(0);
}

/**
 * Rotte principali del gestionale accessibili a un utente con privilegi pieni.
 * Sono escluse le rotte di dettaglio (:id, richiedono dati) e i portali
 * cliente/prospect (layout/login differenti).
 */
export const GESTIONALE_ROUTES: { label: string; path: string }[] = [
  { label: 'Home / Dashboard', path: '/' },
  { label: 'Assistente IA', path: '/ai-assistant' },
  { label: 'Mio Profilo', path: '/mio-profilo' },

  // Trattative / commerciale
  { label: 'Prospect', path: '/archivi/prospect' },
  { label: 'Trattative', path: '/trattative' },
  { label: 'Calendario Trattative', path: '/trattative/calendario' },
  { label: 'Storico Trattative', path: '/trattative/storico' },
  { label: 'Storico Gare', path: '/trattative/storico-gare' },
  { label: 'Bandi Pubblici', path: '/bandi-pubblici' },
  { label: 'Chat', path: '/chat' },

  // Anagrafiche
  { label: 'Clienti', path: '/archivi/clienti' },
  { label: 'Anagrafiche Agenzie', path: '/archivi/anagrafiche-agenzie' },
  { label: 'Anagrafiche Amministrative', path: '/archivi/anagrafiche-amministrative' },
  { label: 'Conti Bancari', path: '/archivi/conti-bancari' },

  // Portafoglio
  { label: 'Polizze Attive', path: '/portafoglio/attive' },
  { label: 'Storico Polizze', path: '/portafoglio/storico' },
  { label: 'Immissione Polizza', path: '/portafoglio/immissione' },
  { label: 'Appendici', path: '/portafoglio/appendici' },
  { label: 'Rinnovi', path: '/portafoglio/rinnovi' },
  { label: 'Doc. Precontrattuale', path: '/portafoglio/doc-precontrattuale' },
  { label: 'Estrazioni e Stampe', path: '/portafoglio/estrazioni-stampe' },
  { label: 'Estrazione per Cliente', path: '/portafoglio/estrazioni/per-cliente' },
  { label: 'Estrazione per Compagnia', path: '/portafoglio/estrazioni/per-compagnia' },
  { label: 'Premi/Provvigioni', path: '/portafoglio/estrazioni/premi-provvigioni' },
  { label: 'Premi Scoperti/Garantiti', path: '/portafoglio/estrazioni/premi-scoperti-garantiti' },
  { label: 'E/C Clienti (estrazioni)', path: '/portafoglio/estrazioni/ec-clienti' },
  { label: 'Archivio Documentale', path: '/portafoglio/documentale' },
  { label: 'Elenco Polizze (titoli)', path: '/titoli' },

  // Sinistri
  { label: 'Sinistri', path: '/sinistri' },
  { label: 'Apertura Sinistro', path: '/sinistri/apertura' },
  { label: 'Prescrizioni Sinistri', path: '/sinistri/prescrizioni' },
  { label: 'Reminder Sinistri', path: '/sinistri/reminder' },
  { label: 'Report Sanitario SIR', path: '/sinistri/report-sir' },

  // Contabilità operativa
  { label: 'Incassi', path: '/portafoglio/incassi' },
  { label: 'Riepilogo Messe a Cassa', path: '/contabilita' },
  { label: 'Gestione Polizze', path: '/portafoglio/gestione' },
  { label: 'E/C Clienti', path: '/contabilita/ec-clienti' },
  { label: 'E/C Compagnia', path: '/contabilita/ec-compagnia' },

  // Contabilità Amministrativa (sidebar)
  { label: 'E/C Agenzie', path: '/contabilita/ec-agenzia' },
  { label: 'Agenzie in Pagamento', path: '/contabilita/ec-agenzia/in-pagamento' },

  { label: 'Storico E/C Agenzie', path: '/contabilita/ec-agenzia/storico' },
  { label: 'Storico E/C Clienti', path: '/contabilita/ec-cliente/storico' },
  { label: 'E/C Produttori', path: '/contabilita/ec-produttori' },
  { label: 'Storico E/C Produttori', path: '/contabilita/ec-produttore/storico' },
  { label: 'Storico Rimesse', path: '/contabilita/storico-rimesse' },
  { label: 'Provvigioni Maturate', path: '/provvigioni-maturate' },
  { label: 'Clientela RCA', path: '/rca/clientela' },
  { label: 'Scadenze RCA', path: '/rca/scadenze' },
  { label: 'Preventivi RCA', path: '/rca/preventivi' },
  { label: 'Riepilogo Acconti', path: '/contabilita/anticipi-clienti' },
  { label: 'Caricamento Mov. Bancari', path: '/contabilita/caricamento-mov-bancari' },
  { label: 'Bonifici (Incassi)', path: '/portafoglio/incassi?tab=bonifici' },
  { label: 'Storico bonifici', path: '/contabilita/ricongiungimento-bancario?tab=storico' },
  { label: 'Report IVA', path: '/report-iva' },
  { label: 'Pagamenti Provvigioni', path: '/pagamenti-provvigioni' },

  // Sistema / Admin
  { label: 'Centro Utenti & Privilegi', path: '/utenti-privilegi' },
  { label: 'Impostazioni', path: '/impostazioni' },
  { label: 'Backup & Export', path: '/backup-export' },
  { label: 'Manutenzione', path: '/manutenzione' },
  { label: 'Tabelle di Base', path: '/tabelle-base' },
  { label: 'Gestione Uffici', path: '/gestione-uffici' },
  { label: 'Compagnie / Agenzie', path: '/compagnie' },
  { label: 'Template Email', path: '/template' },
  { label: 'Comunicazioni', path: '/comunicazioni' },
  { label: 'Anomalie Sistema', path: '/anomalie-sistema' },
  { label: 'Anomalie KO', path: '/anomalie-ko' },
  { label: 'Sitemap', path: '/sitemap' },
  { label: 'Note di Restituzione', path: '/note-restituzione' },
  { label: 'Spedizioni', path: '/spedizioni' },
  { label: 'Notifiche', path: '/notifiche' },
  { label: 'Privacy & Consensi', path: '/privacy' },
  { label: 'Flussi Compagnie', path: '/flussi-compagnie' },
  { label: 'Report', path: '/report' },
];
