/**
 * Chrome Storage Local Wrapper with Encryption
 *
 * Provides type-safe access to chrome.storage.local for:
 * - Encrypted refresh tokens (persists across browser sessions)
 * - Session metadata (for 7-day expiry tracking)
 *
 * Uses Web Crypto API for AES-GCM encryption of sensitive data.
 */

import type { LocalStorageSchema } from '../auth/types';

type LocalKey = keyof LocalStorageSchema;

// ============================================================================
// Encryption Constants
// ============================================================================

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Derive encryption key from extension ID (stable per installation)
let encryptionKey: CryptoKey | null = null;

/**
 * Get or create the encryption key.
 * Uses the extension ID as a stable seed for key derivation.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (encryptionKey) {
    return encryptionKey;
  }

  // Use extension ID as seed for key derivation
  const extensionId = chrome.runtime.id;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(extensionId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('auth0-passwordless-extension'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return encryptionKey;
}

/**
 * Encrypt a string value.
 */
async function encrypt(
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(new Uint8Array(cipherBuffer)),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt a string value.
 */
async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const decoder = new TextDecoder();

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(ciphertext)
  );

  return decoder.decode(plainBuffer);
}

/**
 * Convert Uint8Array to base64 string.
 */
function bufferToBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Base Storage Operations
// ============================================================================

/**
 * Get a value from local storage.
 */
async function getLocalValue<K extends LocalKey>(
  key: K
): Promise<LocalStorageSchema[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as LocalStorageSchema[K] | undefined;
}

/**
 * Set a value in local storage.
 */
async function setLocalValue<K extends LocalKey>(
  key: K,
  value: LocalStorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove a value from local storage.
 */
async function removeLocalValue(key: LocalKey): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Clear all local storage.
 */
export async function clearLocalStorage(): Promise<void> {
  await chrome.storage.local.clear();
}

// ============================================================================
// Refresh Token Operations (Encrypted)
// ============================================================================

/**
 * Store an encrypted refresh token.
 */
export async function setRefreshToken(token: string): Promise<void> {
  const { ciphertext, iv } = await encrypt(token);
  await Promise.all([
    setLocalValue('encryptedRefreshToken', ciphertext),
    setLocalValue('refreshTokenIV', iv),
  ]);
}

/**
 * Retrieve and decrypt the refresh token.
 * Returns undefined if no token is stored or decryption fails.
 */
export async function getRefreshToken(): Promise<string | undefined> {
  const [ciphertext, iv] = await Promise.all([
    getLocalValue('encryptedRefreshToken'),
    getLocalValue('refreshTokenIV'),
  ]);

  if (!ciphertext || !iv) {
    return undefined;
  }

  try {
    return await decrypt(ciphertext, iv);
  } catch {
    // Decryption failed - token is corrupted or key changed
    await clearRefreshToken();
    return undefined;
  }
}

/**
 * Clear the stored refresh token.
 */
export async function clearRefreshToken(): Promise<void> {
  await Promise.all([
    removeLocalValue('encryptedRefreshToken'),
    removeLocalValue('refreshTokenIV'),
  ]);
}

// ============================================================================
// Session Metadata Operations
// ============================================================================

/**
 * Store session metadata for 7-day expiry tracking.
 */
export async function setSessionMeta(email: string): Promise<void> {
  await setLocalValue('sessionMeta', {
    createdAt: Date.now(),
    email,
  });
}

/**
 * Get session metadata.
 */
export async function getSessionMeta(): Promise<
  LocalStorageSchema['sessionMeta'] | undefined
> {
  return getLocalValue('sessionMeta');
}

/**
 * Clear session metadata.
 */
export async function clearSessionMeta(): Promise<void> {
  await removeLocalValue('sessionMeta');
}

/**
 * Check if the session has expired (older than 7 days).
 */
export async function isSessionExpired(): Promise<boolean> {
  const meta = await getSessionMeta();
  if (!meta) {
    return true;
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - meta.createdAt > SEVEN_DAYS_MS;
}
