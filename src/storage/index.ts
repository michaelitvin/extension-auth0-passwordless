/**
 * Unified SecureStorage Facade
 *
 * Combines chrome.storage.session and chrome.storage.local
 * into a single, type-safe storage interface.
 *
 * Storage strategy:
 * - Session storage: Access tokens, auth state, OTP requests (cleared on browser close)
 * - Local storage: Encrypted refresh tokens, session metadata (persists)
 */

import type {
  AuthState,
  OTPRequest,
  UserProfile,
  AuthFlowState,
} from '../auth/types';

import {
  getAuthState,
  setAuthState,
  clearAuthState,
  getOTPRequest,
  setOTPRequest,
  clearOTPRequest,
  getUserProfile,
  setUserProfile,
  clearUserProfile,
  getFlowState,
  setFlowState,
  clearSessionStorage,
} from './session-storage';

import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getSessionMeta,
  setSessionMeta,
  clearSessionMeta,
  isSessionExpired,
  clearLocalStorage,
} from './local-storage';

// ============================================================================
// Complete Auth State Management
// ============================================================================

/**
 * Get the complete authentication state.
 * Combines session storage (access token, etc.) with local storage (refresh token).
 */
export async function getCompleteAuthState(): Promise<AuthState | null> {
  const [sessionAuth, refreshToken] = await Promise.all([
    getAuthState(),
    getRefreshToken(),
  ]);

  if (!sessionAuth || !refreshToken) {
    return null;
  }

  return {
    ...sessionAuth,
    refreshToken,
  };
}

/**
 * Store the complete authentication state.
 * Splits data between session and local storage appropriately.
 */
export async function storeAuthState(auth: AuthState): Promise<void> {
  const { refreshToken, ...sessionAuth } = auth;

  await Promise.all([
    setAuthState(sessionAuth),
    setRefreshToken(refreshToken),
    setSessionMeta(auth.email),
  ]);
}

/**
 * Clear all authentication state from both storages.
 */
export async function clearAllAuthState(): Promise<void> {
  await Promise.all([
    clearAuthState(),
    clearRefreshToken(),
    clearSessionMeta(),
    clearUserProfile(),
    clearOTPRequest(),
    setFlowState('LOGGED_OUT'),
  ]);
}

// ============================================================================
// Re-export individual storage operations
// ============================================================================

// Session storage operations
export {
  getAuthState,
  setAuthState,
  clearAuthState,
  getOTPRequest,
  setOTPRequest,
  clearOTPRequest,
  getUserProfile,
  setUserProfile,
  clearUserProfile,
  getFlowState,
  setFlowState,
  clearSessionStorage,
};

// Local storage operations
export {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getSessionMeta,
  setSessionMeta,
  clearSessionMeta,
  isSessionExpired,
  clearLocalStorage,
};

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Check if the current session is valid.
 * A session is valid if:
 * 1. Auth state exists in session storage
 * 2. Refresh token exists in local storage
 * 3. Session is not older than 7 days
 */
export async function isSessionValid(): Promise<boolean> {
  const [auth, refreshToken, expired] = await Promise.all([
    getAuthState(),
    getRefreshToken(),
    isSessionExpired(),
  ]);

  return !!auth && !!refreshToken && !expired;
}

/**
 * Check if access token is expired or about to expire (within 5 minutes).
 */
export async function isAccessTokenExpired(): Promise<boolean> {
  const auth = await getAuthState();
  if (!auth) {
    return true;
  }

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  return Date.now() > auth.expiresAt - FIVE_MINUTES_MS;
}

// ============================================================================
// Type exports
// ============================================================================

export type { AuthState, OTPRequest, UserProfile, AuthFlowState };
