// ---------------------------------------------------------------------------
// OpenWebClaw — Password-based authentication (PBKDF2 + Web Crypto)
// ---------------------------------------------------------------------------
//
// Passwords are never stored. Instead, a PBKDF2-derived key is used as a
// verifier. The salt and verifier are stored in the config IndexedDB store.
// ---------------------------------------------------------------------------

import { openDatabase, getConfig, setConfig } from './db.js';
import { CONFIG_KEYS } from './config.js';

/** Ensure the DB is open before any auth operation. */
async function ensureDb(): Promise<void> {
  try { await openDatabase(); } catch { /* already open or unreachable */ }
}

const PBKDF2_ITERATIONS = 200_000;
const HASH_ALGO = 'SHA-256';
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// ---- internal helpers -----------------------------------------------------

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    baseKey,
    KEY_BYTES * 8,
  );
}

// ---- Public API -----------------------------------------------------------

/**
 * Returns true when a password has been set (i.e. first-launch setup is done).
 */
export async function hasPassword(): Promise<boolean> {
  await ensureDb();
  const verifier = await getConfig(CONFIG_KEYS.PASSPHRASE_VERIFY);
  return !!verifier;
}

/**
 * Set (or change) the password. Generates a fresh random salt and stores
 * the derived-key verifier.
 */
export async function setPassword(password: string): Promise<void> {
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }
  await ensureDb();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveKey(password, salt);
  await setConfig(CONFIG_KEYS.PASSPHRASE_SALT, b64encode(salt));
  await setConfig(CONFIG_KEYS.PASSPHRASE_VERIFY, b64encode(bits));
}

/**
 * Verify a password attempt. Returns true if correct.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  await ensureDb();
  const saltB64 = await getConfig(CONFIG_KEYS.PASSPHRASE_SALT);
  const verifierB64 = await getConfig(CONFIG_KEYS.PASSPHRASE_VERIFY);
  if (!saltB64 || !verifierB64) return false;

  const salt = b64decode(saltB64);
  const expected = b64decode(verifierB64);
  const derived = new Uint8Array(await deriveKey(password, salt));

  // Constant-time comparison
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived[i] ^ expected[i];
  }
  return diff === 0;
}

// ---- Session helpers (sessionStorage + optional localStorage) -------------

const SESSION_KEY = 'owc_session';
const REMEMBER_KEY = 'owc_remember';

export function readSession(): boolean {
  return (
    sessionStorage.getItem(SESSION_KEY) === '1' ||
    localStorage.getItem(REMEMBER_KEY) === '1'
  );
}

export function writeSession(rememberMe: boolean): void {
  sessionStorage.setItem(SESSION_KEY, '1');
  if (rememberMe) {
    localStorage.setItem(REMEMBER_KEY, '1');
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}
