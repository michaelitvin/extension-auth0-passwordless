/**
 * Chrome Storage Session Wrapper
 *
 * Provides type-safe access to chrome.storage.session for:
 * - Access tokens (short-lived)
 * - Auth state (email, expiration)
 * - OTP request state
 * - User profile cache
 *
 * Data is encrypted and cleared when browser closes.
 */

import type {
  AuthState,
  OTPRequest,
  UserProfile,
  AuthFlowState,
  SessionStorageSchema,
} from '../auth/types';

type SessionKey = keyof SessionStorageSchema;

/**
 * Get a value from session storage.
 */
export async function getSessionValue<K extends SessionKey>(
  key: K
): Promise<SessionStorageSchema[K] | undefined> {
  const result = await chrome.storage.session.get(key);
  return result[key] as SessionStorageSchema[K] | undefined;
}

/**
 * Set a value in session storage.
 */
export async function setSessionValue<K extends SessionKey>(
  key: K,
  value: SessionStorageSchema[K]
): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

/**
 * Remove a value from session storage.
 */
export async function removeSessionValue(key: SessionKey): Promise<void> {
  await chrome.storage.session.remove(key);
}

/**
 * Clear all session storage.
 */
export async function clearSessionStorage(): Promise<void> {
  await chrome.storage.session.clear();
}

// ============================================================================
// Auth State Operations
// ============================================================================

/**
 * Get the current auth state from session storage.
 * Note: Does not include refreshToken (stored in local storage).
 */
export async function getAuthState(): Promise<
  Omit<AuthState, 'refreshToken'> | undefined
> {
  return getSessionValue('auth');
}

/**
 * Set the auth state in session storage.
 * Note: refreshToken should be stored separately in local storage.
 */
export async function setAuthState(
  auth: Omit<AuthState, 'refreshToken'>
): Promise<void> {
  await setSessionValue('auth', auth);
}

/**
 * Clear the auth state from session storage.
 */
export async function clearAuthState(): Promise<void> {
  await removeSessionValue('auth');
}

// ============================================================================
// OTP Request Operations
// ============================================================================

/**
 * Get the current OTP request state.
 */
export async function getOTPRequest(): Promise<OTPRequest | undefined> {
  return getSessionValue('otpRequest');
}

/**
 * Set the OTP request state.
 */
export async function setOTPRequest(request: OTPRequest): Promise<void> {
  await setSessionValue('otpRequest', request);
}

/**
 * Clear the OTP request state.
 */
export async function clearOTPRequest(): Promise<void> {
  await removeSessionValue('otpRequest');
}

// ============================================================================
// User Profile Operations
// ============================================================================

/**
 * Get the cached user profile.
 */
export async function getUserProfile(): Promise<UserProfile | undefined> {
  return getSessionValue('userProfile');
}

/**
 * Set the cached user profile.
 */
export async function setUserProfile(profile: UserProfile): Promise<void> {
  await setSessionValue('userProfile', profile);
}

/**
 * Clear the cached user profile.
 */
export async function clearUserProfile(): Promise<void> {
  await removeSessionValue('userProfile');
}

// ============================================================================
// Flow State Operations
// ============================================================================

/**
 * Get the current auth flow state.
 */
export async function getFlowState(): Promise<AuthFlowState | undefined> {
  return getSessionValue('flowState');
}

/**
 * Set the current auth flow state.
 */
export async function setFlowState(state: AuthFlowState): Promise<void> {
  await setSessionValue('flowState', state);
}
