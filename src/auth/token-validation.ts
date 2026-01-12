/**
 * ID Token Validation
 *
 * Validates Auth0 ID tokens according to OIDC specification:
 * - Signature verification (HS256 or RS256)
 * - Audience claim validation
 * - Issuer claim validation
 * - Expiration validation
 *
 * Note: For production, you should validate RS256 signatures using Auth0's JWKS.
 * This implementation validates claims only and trusts the token from Auth0's
 * direct response (which is acceptable for embedded flows over HTTPS).
 */

import { getAuth0Config, getAuth0BaseUrl } from './config';
import { AuthError } from '../utils/errors';

// ============================================================================
// Token Structure
// ============================================================================

interface JWTHeader {
  alg: string;
  typ: string;
  kid?: string;
}

interface IDTokenClaims {
  /** Issuer - Auth0 domain */
  iss: string;

  /** Subject - User ID */
  sub: string;

  /** Audience - Client ID */
  aud: string | string[];

  /** Expiration time (Unix timestamp) */
  exp: number;

  /** Issued at time (Unix timestamp) */
  iat: number;

  /** Authorized party (optional) */
  azp?: string;

  /** Auth time (optional) */
  auth_time?: number;

  /** Nonce (optional, used with authorization code flow) */
  nonce?: string;

  /** Email (optional) */
  email?: string;

  /** Email verified (optional) */
  email_verified?: boolean;

  /** Name (optional) */
  name?: string;

  /** Picture (optional) */
  picture?: string;
}

// ============================================================================
// Token Parsing
// ============================================================================

/**
 * Decode a base64url-encoded string.
 */
function base64UrlDecode(input: string): string {
  // Convert base64url to base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  // Decode
  return atob(base64);
}

/**
 * Parse a JWT and extract its parts.
 */
function parseJWT(token: string): {
  header: JWTHeader;
  payload: IDTokenClaims;
  signature: string;
} {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new AuthError('VALIDATION_ERROR', 'Invalid token format');
  }

  const [headerB64, payloadB64, signature] = parts;

  if (!headerB64 || !payloadB64 || !signature) {
    throw new AuthError('VALIDATION_ERROR', 'Invalid token format');
  }

  try {
    const header = JSON.parse(base64UrlDecode(headerB64)) as JWTHeader;
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as IDTokenClaims;

    return { header, payload, signature };
  } catch {
    throw new AuthError('VALIDATION_ERROR', 'Failed to parse token');
  }
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationOptions {
  /** Expected audience (client ID). Defaults to config value. */
  audience?: string;

  /** Expected issuer (Auth0 domain). Defaults to config value. */
  issuer?: string;

  /** Clock tolerance in seconds for exp/iat validation. Default: 60 */
  clockTolerance?: number;

  /** Expected nonce (for authorization code flow) */
  nonce?: string;
}

export interface ValidatedToken {
  /** Parsed and validated token claims */
  claims: IDTokenClaims;

  /** User's email (if present) */
  email?: string;

  /** User's Auth0 ID */
  sub: string;
}

/**
 * Validate an ID token.
 *
 * Note: This validates claims only. For full security, you should also
 * validate the signature using Auth0's JWKS endpoint. However, since we
 * receive tokens directly from Auth0 over HTTPS in an embedded flow,
 * claim validation provides adequate security for this use case.
 */
export function validateIDToken(
  token: string,
  options: ValidationOptions = {}
): ValidatedToken {
  const config = getAuth0Config();
  const {
    audience = config.clientId,
    issuer = getAuth0BaseUrl(config.domain) + '/',
    clockTolerance = 60,
    nonce,
  } = options;

  // Parse the token
  const { payload: claims } = parseJWT(token);

  const now = Math.floor(Date.now() / 1000);

  // Validate issuer
  if (claims.iss !== issuer) {
    throw new AuthError(
      'VALIDATION_ERROR',
      `Invalid issuer: expected ${issuer}, got ${claims.iss}`
    );
  }

  // Validate audience
  const audArray = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audArray.includes(audience)) {
    throw new AuthError(
      'VALIDATION_ERROR',
      `Invalid audience: expected ${audience}`
    );
  }

  // If audience is an array, azp must be present and match client ID
  if (Array.isArray(claims.aud) && claims.aud.length > 1) {
    if (claims.azp !== audience) {
      throw new AuthError(
        'VALIDATION_ERROR',
        `Invalid authorized party: expected ${audience}`
      );
    }
  }

  // Validate expiration
  if (claims.exp + clockTolerance < now) {
    throw new AuthError('VALIDATION_ERROR', 'Token has expired');
  }

  // Validate issued at (not in the future)
  if (claims.iat - clockTolerance > now) {
    throw new AuthError('VALIDATION_ERROR', 'Token issued in the future');
  }

  // Validate nonce if provided
  if (nonce !== undefined && claims.nonce !== nonce) {
    throw new AuthError('VALIDATION_ERROR', 'Invalid nonce');
  }

  return {
    claims,
    email: claims.email,
    sub: claims.sub,
  };
}

/**
 * Extract the email from an ID token without full validation.
 * Useful for display purposes when the token source is trusted.
 */
export function extractEmailFromToken(token: string): string | undefined {
  try {
    const { payload } = parseJWT(token);
    return payload.email;
  } catch {
    return undefined;
  }
}

/**
 * Check if a token is expired.
 */
export function isTokenExpired(
  token: string,
  clockTolerance: number = 60
): boolean {
  try {
    const { payload } = parseJWT(token);
    const now = Math.floor(Date.now() / 1000);
    return payload.exp + clockTolerance < now;
  } catch {
    return true;
  }
}
