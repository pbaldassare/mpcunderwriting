import type { TestInfo } from '@playwright/test';
import { getLevelByRole } from '../../src/lib/userLevels';
import {
  supabaseAdmin,
  createTestUser,
  deleteTestUser,
  createTestUfficio,
  deleteTestUfficio,
  createTestClienteAnagrafica,
  linkClientePortalUser,
  createTestTitoloForUfficio,
  deleteTestClienteAnagrafica,
} from './db-helper';

/** Password condivisa per tutti gli utenti creati dai test auth/RLS. */
export const AUTH_ROLE_TEST_PASSWORD = process.env.AUTH_ROLE_TEST_PASSWORD || 'Password123!';

export interface AuthRoleFixtures {
  runId: string;
  password: string;
  admin: { email: string; userId: string };
  sede: { email: string; userId: string; ufficioId: string };
  cliente: { email: string; userId: string };
  ufficioA: { id: string; nome: string };
  ufficioB: { id: string; nome: string };
  clienteA: { id: string; cognome: string; codiceRicerca: string };
  clienteB: { id: string; cognome: string; codiceRicerca: string };
  polizzaA: { id: string; numero: string };
  polizzaB: { id: string; numero: string };
}

let cachedFixtures: AuthRoleFixtures | null = null;

export function skipWithoutServiceRole(testInfo: TestInfo): boolean {
  if (supabaseAdmin) return false;
  testInfo.skip(true, 'SUPABASE_SERVICE_ROLE_KEY non configurata nel .env');
  return true;
}

export function hasServiceRole(): boolean {
  return !!supabaseAdmin;
}

/**
 * Crea utenti, due sedi, clienti e polizze per verificare i confini RLS.
 * I dati restano in cache per tutta la run (workers: 1).
 */
export async function setupAuthRoleFixtures(): Promise<AuthRoleFixtures> {
  if (cachedFixtures) return cachedFixtures;
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata nel .env');
  }

  const runId = `${Date.now()}`;
  const password = AUTH_ROLE_TEST_PASSWORD;
  const ufficioPermessi = getLevelByRole('ufficio').defaultPermissions;

  const ufficioA = await createTestUfficio(`E2E Auth Sede A ${runId}`);
  const ufficioB = await createTestUfficio(`E2E Auth Sede B ${runId}`);

  const adminEmail = `e2e.auth.admin.${runId}@consulbrokers.it`;
  const sedeEmail = `e2e.auth.sede.${runId}@consulbrokers.it`;
  const clienteEmail = `e2e.auth.cliente.${runId}@consulbrokers.it`;

  const adminUserId = await createTestUser(adminEmail, password, 'admin', 'Admin-E2E');
  const sedeUserId = await createTestUser(sedeEmail, password, 'ufficio', 'Sede-E2E', {
    ufficioId: ufficioA.id,
    permessi_json: ufficioPermessi,
  });
  const clienteUserId = await createTestUser(clienteEmail, password, 'cliente', 'Cliente-E2E');

  const cognomeA = `RLSAuthA${runId.slice(-6)}`;
  const cognomeB = `RLSAuthB${runId.slice(-6)}`;
  const codiceA = `EA${runId.slice(-8)}A`;
  const codiceB = `EA${runId.slice(-8)}B`;

  const clienteA = await createTestClienteAnagrafica({
    ufficioId: ufficioA.id,
    cognome: cognomeA,
    codiceRicerca: codiceA,
  });
  const clienteB = await createTestClienteAnagrafica({
    ufficioId: ufficioB.id,
    cognome: cognomeB,
    codiceRicerca: codiceB,
  });

  await linkClientePortalUser({
    userId: clienteUserId,
    clienteAnagraficaId: clienteA.id,
    email: clienteEmail,
  });

  const polizzaNumA = `AUTH-E2E-A-${runId}`;
  const polizzaNumB = `AUTH-E2E-B-${runId}`;

  const polizzaA = await createTestTitoloForUfficio({
    numeroTitolo: polizzaNumA,
    ufficioId: ufficioA.id,
    clienteAnagraficaId: clienteA.id,
  });
  const polizzaB = await createTestTitoloForUfficio({
    numeroTitolo: polizzaNumB,
    ufficioId: ufficioB.id,
    clienteAnagraficaId: clienteB.id,
  });

  cachedFixtures = {
    runId,
    password,
    admin: { email: adminEmail, userId: adminUserId },
    sede: { email: sedeEmail, userId: sedeUserId, ufficioId: ufficioA.id },
    cliente: { email: clienteEmail, userId: clienteUserId },
    ufficioA: { id: ufficioA.id, nome: ufficioA.nome_ufficio },
    ufficioB: { id: ufficioB.id, nome: ufficioB.nome_ufficio },
    clienteA: { id: clienteA.id, cognome: cognomeA, codiceRicerca: codiceA },
    clienteB: { id: clienteB.id, cognome: cognomeB, codiceRicerca: codiceB },
    polizzaA: { id: polizzaA.id, numero: polizzaNumA },
    polizzaB: { id: polizzaB.id, numero: polizzaNumB },
  };

  return cachedFixtures;
}

/** Ripulisce utenti, clienti, polizze e sedi create per i test auth. */
export async function teardownAuthRoleFixtures(fixtures: AuthRoleFixtures | null): Promise<void> {
  if (!supabaseAdmin || !fixtures) return;

  await deleteTestClienteAnagrafica(fixtures.clienteA.id);
  await deleteTestClienteAnagrafica(fixtures.clienteB.id);
  await deleteTestUser(fixtures.cliente.userId);
  await deleteTestUser(fixtures.sede.userId);
  await deleteTestUser(fixtures.admin.userId);
  await deleteTestUfficio(fixtures.ufficioA.id);
  await deleteTestUfficio(fixtures.ufficioB.id);

  cachedFixtures = null;
}
