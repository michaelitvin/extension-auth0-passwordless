/**
 * Auth State Machine (State Persistence Guard)
 *
 * Manages authentication state that persists in chrome.storage.session.
 * Designed to survive popup closure - popup acts as a dumb view,
 * all state management happens here in the service worker.
 *
 * State Machine:
 * LOGGED_OUT -> PENDING_OTP -> AUTHENTICATED
 *     ^                |              |
 *     |                v              v
 *     +---- cancel/expire ----+------+
 *                              SESSION_EXPIRED
 */

import type {
  AuthState,
  AuthFlowState,
  OTPRequest,
  UserProfile,
} from './types';
import {
  getFlowState,
  setFlowState,
  getOTPRequest,
  setOTPRequest,
  clearOTPRequest,
  getCompleteAuthState,
  storeAuthState,
  clearAllAuthState,
  getUserProfile,
  setUserProfile,
  isSessionExpired,
  isAccessTokenExpired,
  getRefreshToken,
} from '../storage';

// ============================================================================
// State Machine Interface
// ============================================================================

export interface StateMachineState {
  flowState: AuthFlowState;
  email?: string;
  isAuthenticated: boolean;
  otpRequest?: OTPRequest;
  userProfile?: UserProfile;
  sessionAge?: number;
  expiresAt?: number;
}

// ============================================================================
// State Getters
// ============================================================================

/**
 * Get the current state machine state.
 * This is the single source of truth for auth state.
 */
export async function getCurrentState(): Promise<StateMachineState> {
  const [flowState, auth, otpRequest, userProfile, sessionMeta] =
    await Promise.all([
      getFlowState(),
      getCompleteAuthState(),
      getOTPRequest(),
      getUserProfile(),
      import('../storage').then((m) => m.getSessionMeta()),
    ]);

  const currentFlowState = flowState ?? 'LOGGED_OUT';
  const isAuthenticated = currentFlowState === 'AUTHENTICATED' && !!auth;

  return {
    flowState: currentFlowState,
    email: auth?.email ?? otpRequest?.email,
    isAuthenticated,
    otpRequest,
    userProfile,
    sessionAge: sessionMeta
      ? Math.floor((Date.now() - sessionMeta.createdAt) / 1000)
      : undefined,
    expiresAt: auth?.expiresAt,
  };
}

/**
 * Initialize state machine on service worker startup.
 * Restores state from storage and validates session.
 */
export async function initializeStateMachine(): Promise<StateMachineState> {
  // Check if we have a valid session
  const [auth, refreshToken, expired] = await Promise.all([
    getCompleteAuthState(),
    getRefreshToken(),
    isSessionExpired(),
  ]);

  if (auth && refreshToken && !expired) {
    // Valid session exists
    await setFlowState('AUTHENTICATED');
    return getCurrentState();
  }

  if (expired || (!auth && refreshToken)) {
    // Session expired or incomplete - clear everything
    await clearAllAuthState();
    return getCurrentState();
  }

  // Check if there's a pending OTP request
  const otpRequest = await getOTPRequest();
  if (otpRequest) {
    // Check if OTP hasn't expired (5 minutes)
    const OTP_EXPIRY_MS = 5 * 60 * 1000;
    if (Date.now() - otpRequest.requestedAt < OTP_EXPIRY_MS) {
      await setFlowState('PENDING_OTP');
      return getCurrentState();
    } else {
      // OTP expired, clear it
      await clearOTPRequest();
    }
  }

  // No valid session or pending OTP
  await setFlowState('LOGGED_OUT');
  return getCurrentState();
}

// ============================================================================
// State Transitions
// ============================================================================

/**
 * Transition to PENDING_OTP state when OTP is initiated.
 */
export async function transitionToOTPPending(
  email: string,
  codeVerifier?: string
): Promise<StateMachineState> {
  const existingRequest = await getOTPRequest();

  const otpRequest: OTPRequest = {
    email,
    requestedAt: Date.now(),
    attemptCount: (existingRequest?.email === email ? existingRequest.attemptCount : 0) + 1,
    windowStart: existingRequest?.email === email ? existingRequest.windowStart : Date.now(),
    codeVerifier,
  };

  await Promise.all([
    setOTPRequest(otpRequest),
    setFlowState('PENDING_OTP'),
  ]);

  return getCurrentState();
}

/**
 * Transition to AUTHENTICATED state when OTP is verified.
 */
export async function transitionToAuthenticated(
  auth: AuthState
): Promise<StateMachineState> {
  await Promise.all([
    storeAuthState(auth),
    clearOTPRequest(),
    setFlowState('AUTHENTICATED'),
  ]);

  return getCurrentState();
}

/**
 * Transition to LOGGED_OUT state.
 */
export async function transitionToLoggedOut(
  reason: 'manual' | 'expired' | 'failed' = 'manual'
): Promise<StateMachineState> {
  console.log(`[StateMachine] Logging out: ${reason}`);

  await clearAllAuthState();

  return getCurrentState();
}

/**
 * Transition to SESSION_EXPIRED state.
 */
export async function transitionToSessionExpired(): Promise<StateMachineState> {
  await Promise.all([
    clearAllAuthState(),
    setFlowState('SESSION_EXPIRED'),
  ]);

  return getCurrentState();
}

/**
 * Cancel pending OTP and return to LOGGED_OUT.
 */
export async function cancelOTP(): Promise<StateMachineState> {
  await Promise.all([
    clearOTPRequest(),
    setFlowState('LOGGED_OUT'),
  ]);

  return getCurrentState();
}

// ============================================================================
// State Queries
// ============================================================================

/**
 * Check if user is currently authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const state = await getCurrentState();
  return state.isAuthenticated;
}

/**
 * Check if there's a pending OTP request.
 */
export async function hasPendingOTP(): Promise<boolean> {
  const state = await getCurrentState();
  return state.flowState === 'PENDING_OTP';
}

/**
 * Check if access token needs refresh.
 */
export async function needsTokenRefresh(): Promise<boolean> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return false;
  }

  return isAccessTokenExpired();
}

/**
 * Update auth state after token refresh.
 */
export async function updateTokens(auth: AuthState): Promise<void> {
  await storeAuthState(auth);
}

/**
 * Update cached user profile.
 */
export async function updateUserProfile(profile: UserProfile): Promise<void> {
  await setUserProfile(profile);
}

// ============================================================================
// Rate Limiting
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_REQUESTS = 5;

/**
 * Check if rate limited for OTP requests.
 */
export async function isRateLimited(email: string): Promise<{
  limited: boolean;
  remainingAttempts: number;
  resetAt?: number;
}> {
  const otpRequest = await getOTPRequest();

  if (!otpRequest || otpRequest.email !== email) {
    return { limited: false, remainingAttempts: MAX_OTP_REQUESTS };
  }

  // Check if window has expired
  if (Date.now() - otpRequest.windowStart > RATE_LIMIT_WINDOW_MS) {
    return { limited: false, remainingAttempts: MAX_OTP_REQUESTS };
  }

  const remaining = MAX_OTP_REQUESTS - otpRequest.attemptCount;

  return {
    limited: remaining <= 0,
    remainingAttempts: Math.max(0, remaining),
    resetAt: otpRequest.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}
