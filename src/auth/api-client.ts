/**
 * Auth0 API Client
 *
 * Handles all HTTP communication with Auth0 APIs:
 * - /passwordless/start - Initiate OTP flow
 * - /oauth/token - Exchange OTP for tokens / Refresh tokens
 * - /userinfo - Get user profile
 *
 * Includes error handling and retry logic for service worker cold starts.
 */

import type { TokenResponse, Auth0ErrorResponse } from './types';
import { AuthError } from '../utils/errors';
import {
  getAuth0Config,
  getPasswordlessStartUrl,
  getTokenUrl,
  getUserInfoUrl,
  DEFAULT_SCOPES,
  PASSWORDLESS_CONNECTION,
  OTP_SEND_TYPE,
  PASSWORDLESS_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from './config';

// ============================================================================
// Retry Configuration
// ============================================================================

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;

/**
 * Calculate exponential backoff delay with jitter.
 */
function getRetryDelay(attempt: number): number {
  const baseDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
  return Math.min(baseDelay + jitter, MAX_RETRY_DELAY_MS);
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network errors, 5xx errors).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors throw TypeError in fetch
    return true;
  }
  if (error instanceof AuthError) {
    return (
      error.code === 'NETWORK_ERROR' || error.code === 'AUTH0_UNAVAILABLE'
    );
  }
  return false;
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Make a fetch request with retry logic for service worker cold starts.
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Handle Auth0 error responses
      if (response.status >= 400 && response.status < 500) {
        const errorBody = (await response.json()) as Auth0ErrorResponse;
        throw AuthError.fromAuth0Error(errorBody);
      }

      // 5xx errors are retryable
      if (response.status >= 500) {
        throw new AuthError(
          'AUTH0_UNAVAILABLE',
          `Auth0 service error: ${String(response.status)}`
        );
      }

      throw new AuthError('NETWORK_ERROR', `Unexpected response: ${String(response.status)}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt < MAX_RETRIES - 1) {
        const delay = getRetryDelay(attempt);
        console.log(
          `[Auth0 API] Retry ${String(attempt + 1)}/${String(MAX_RETRIES)} after ${String(delay)}ms`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new AuthError('NETWORK_ERROR', 'Request failed after retries');
}

// ============================================================================
// Passwordless Start
// ============================================================================

interface PasswordlessStartResponse {
  _id: string;
  email: string;
  email_verified: boolean;
}

/**
 * Initiate the passwordless OTP flow by sending a code to the user's email.
 */
export async function initiatePasswordlessOTP(
  email: string
): Promise<PasswordlessStartResponse> {
  const config = getAuth0Config();
  const url = getPasswordlessStartUrl(config.domain);

  const body = {
    client_id: config.clientId,
    connection: PASSWORDLESS_CONNECTION,
    email,
    send: OTP_SEND_TYPE,
    authParams: {
      scope: DEFAULT_SCOPES,
      ...(config.audience && { audience: config.audience }),
    },
  };

  return fetchWithRetry<PasswordlessStartResponse>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ============================================================================
// Token Exchange
// ============================================================================

/**
 * Exchange an OTP code for tokens.
 */
export async function exchangeOTPForTokens(
  email: string,
  otp: string
): Promise<TokenResponse> {
  const config = getAuth0Config();
  const url = getTokenUrl(config.domain);

  const body = {
    grant_type: PASSWORDLESS_GRANT_TYPE,
    client_id: config.clientId,
    username: email,
    otp,
    realm: PASSWORDLESS_CONNECTION,
    scope: DEFAULT_SCOPES,
  };

  return fetchWithRetry<TokenResponse>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Refresh tokens using a refresh token.
 */
export async function refreshTokens(
  refreshToken: string
): Promise<TokenResponse> {
  const config = getAuth0Config();
  const url = getTokenUrl(config.domain);

  const body = {
    grant_type: REFRESH_TOKEN_GRANT_TYPE,
    client_id: config.clientId,
    refresh_token: refreshToken,
  };

  return fetchWithRetry<TokenResponse>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ============================================================================
// User Info
// ============================================================================

export interface UserInfoResponse {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  updated_at?: string;
}

/**
 * Fetch user profile from Auth0's /userinfo endpoint.
 */
export async function fetchUserInfo(
  accessToken: string
): Promise<UserInfoResponse> {
  const config = getAuth0Config();
  const url = getUserInfoUrl(config.domain);

  return fetchWithRetry<UserInfoResponse>(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
