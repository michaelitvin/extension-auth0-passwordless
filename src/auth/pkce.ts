/**
 * PKCE (Proof Key for Code Exchange) Implementation
 *
 * Implements PKCE helpers using Web Crypto API for secure OAuth flows.
 * While not strictly required for embedded passwordless OTP flow,
 * PKCE is included for completeness and potential authorization code fallback.
 *
 * References:
 * - RFC 7636: https://tools.ietf.org/html/rfc7636
 * - Auth0 PKCE: https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce
 */

const CODE_VERIFIER_LENGTH = 32;

/**
 * Generate a cryptographically random code verifier.
 * Returns a base64url-encoded string of 32 random bytes.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(CODE_VERIFIER_LENGTH);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate a code challenge from a code verifier using SHA-256.
 * Returns a base64url-encoded hash.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64url encode a Uint8Array.
 * Produces URL-safe base64 without padding.
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...buffer));

  // Make URL-safe: replace + with -, / with _, remove =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode a string to Uint8Array.
 */
export function base64UrlDecode(encoded: string): Uint8Array {
  // Restore base64: replace - with +, _ with /
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  // Decode
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a complete PKCE pair (verifier and challenge).
 */
export async function generatePKCEPair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}
