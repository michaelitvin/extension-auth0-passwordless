/**
 * Message Handlers
 *
 * Implements the business logic for each message type.
 * Called by the service worker's message listener.
 */

import type { AuthResponse, AuthStateResponseData, UserInfoResponseData } from '../messages/types';
import { successResponse, errorResponse } from '../messages/types';
import type { AuthState, UserProfile } from './types';
import {
  transitionToOTPPending,
  transitionToAuthenticated,
  transitionToLoggedOut,
  getCurrentState,
  isRateLimited,
  updateUserProfile,
} from './state-machine';
import {
  initiatePasswordlessOTP,
  exchangeOTPForTokens,
  refreshTokens,
  fetchUserInfo,
} from './api-client';
import {
  getRefreshToken,
  getAuthState,
  getUserProfile as getStoredUserProfile,
  isSessionExpired,
} from '../storage';
import { AuthError } from '../utils/errors';
import { validateEmail } from './validation';

// ============================================================================
// OTP Handlers
// ============================================================================

/**
 * Handle INITIATE_OTP message.
 * Starts the passwordless OTP flow by sending a code to the user's email.
 */
export async function handleInitiateOTP(
  email: string
): Promise<AuthResponse<{ email: string; expiresAt: number }>> {
  try {
    // Validate email format
    if (!validateEmail(email)) {
      return errorResponse('INVALID_EMAIL', 'Please enter a valid email address');
    }

    // Check rate limiting
    const rateLimit = await isRateLimited(email);
    if (rateLimit.limited) {
      const resetIn = rateLimit.resetAt
        ? Math.ceil((rateLimit.resetAt - Date.now()) / 60000)
        : 15;
      return errorResponse(
        'RATE_LIMITED',
        `Too many requests. Please try again in ${String(resetIn)} minutes.`
      );
    }

    // Initiate OTP flow with Auth0
    await initiatePasswordlessOTP(email);

    // Update state machine
    await transitionToOTPPending(email);

    // OTP expires in 5 minutes
    const expiresAt = Date.now() + 5 * 60 * 1000;

    return successResponse({ email, expiresAt });
  } catch (error) {
    console.error('[handleInitiateOTP] Error:', error);
    const authError = AuthError.fromUnknown(error);
    return errorResponse(authError.code, authError.message);
  }
}

/**
 * Handle VERIFY_OTP message.
 * Verifies the OTP code and exchanges it for tokens.
 */
export async function handleVerifyOTP(
  email: string,
  otp: string
): Promise<AuthResponse<{ email: string; expiresAt: number }>> {
  try {
    // Validate inputs
    if (!validateEmail(email)) {
      return errorResponse('INVALID_EMAIL', 'Please enter a valid email address');
    }

    if (!otp || otp.length < 4) {
      return errorResponse('INVALID_OTP', 'Please enter a valid code');
    }

    // Exchange OTP for tokens
    const tokenResponse = await exchangeOTPForTokens(email, otp);

    // Verify we got a refresh token (required for session persistence)
    if (!tokenResponse.refresh_token) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Authentication failed: no refresh token received'
      );
    }

    // Calculate expiration timestamp
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;

    // Create auth state
    const authState: AuthState = {
      email,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      idToken: tokenResponse.id_token,
      sessionCreatedAt: Date.now(),
    };

    // Transition to authenticated state
    await transitionToAuthenticated(authState);

    return successResponse({ email, expiresAt });
  } catch (error) {
    console.error('[handleVerifyOTP] Error:', error);
    const authError = AuthError.fromUnknown(error);

    // Map specific Auth0 errors
    if (authError.message.includes('invalid') || authError.message.includes('Wrong')) {
      return errorResponse('INVALID_OTP', 'The code you entered is incorrect');
    }
    if (authError.message.includes('expired')) {
      return errorResponse('OTP_EXPIRED', 'This code has expired. Please request a new one.');
    }

    return errorResponse(authError.code, authError.message);
  }
}

/**
 * Handle RESEND_OTP message.
 * Resends the OTP code to the user's email.
 */
export async function handleResendOTP(
  email: string
): Promise<AuthResponse<{ email: string; expiresAt: number; remainingAttempts: number }>> {
  try {
    // Validate email format
    if (!validateEmail(email)) {
      return errorResponse('INVALID_EMAIL', 'Please enter a valid email address');
    }

    // Check rate limiting
    const rateLimit = await isRateLimited(email);
    if (rateLimit.limited) {
      const resetIn = rateLimit.resetAt
        ? Math.ceil((rateLimit.resetAt - Date.now()) / 60000)
        : 15;
      return errorResponse(
        'RATE_LIMITED',
        `Too many requests. Please try again in ${String(resetIn)} minutes.`
      );
    }

    // Initiate new OTP flow with Auth0
    await initiatePasswordlessOTP(email);

    // Update state machine
    await transitionToOTPPending(email);

    // OTP expires in 5 minutes
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Get updated rate limit info
    const updatedRateLimit = await isRateLimited(email);

    return successResponse({
      email,
      expiresAt,
      remainingAttempts: updatedRateLimit.remainingAttempts,
    });
  } catch (error) {
    console.error('[handleResendOTP] Error:', error);
    const authError = AuthError.fromUnknown(error);
    return errorResponse(authError.code, authError.message);
  }
}

// ============================================================================
// Token Handlers
// ============================================================================

/**
 * Handle REFRESH_TOKEN message.
 * Silently refreshes the access token using the refresh token.
 */
export async function handleRefreshToken(): Promise<AuthResponse<{ expiresAt: number }>> {
  try {
    // Check if session has expired (7 days)
    const sessionExpired = await isSessionExpired();
    if (sessionExpired) {
      await transitionToLoggedOut('expired');
      return errorResponse('SESSION_EXPIRED', 'Your session has expired. Please log in again.');
    }

    // Get the current refresh token
    const currentRefreshToken = await getRefreshToken();
    if (!currentRefreshToken) {
      return errorResponse('NOT_AUTHENTICATED', 'No refresh token available');
    }

    // Get current auth state for email
    const currentAuth = await getAuthState();
    if (!currentAuth) {
      return errorResponse('NOT_AUTHENTICATED', 'No authentication state found');
    }

    // Refresh tokens with Auth0
    const tokenResponse = await refreshTokens(currentRefreshToken);

    // Calculate new expiration
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;

    // Update auth state
    const authState: AuthState = {
      email: currentAuth.email,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? currentRefreshToken,
      expiresAt,
      idToken: tokenResponse.id_token ?? currentAuth.idToken,
      sessionCreatedAt: currentAuth.sessionCreatedAt,
    };

    await transitionToAuthenticated(authState);

    return successResponse({ expiresAt });
  } catch (error) {
    console.error('[handleRefreshToken] Error:', error);
    const authError = AuthError.fromUnknown(error, 'REFRESH_FAILED');

    // If refresh failed due to invalid token, log out
    if (authError.code === 'REFRESH_FAILED' || authError.code === 'VALIDATION_ERROR') {
      await transitionToLoggedOut('failed');
    }

    return errorResponse(authError.code, authError.message);
  }
}

// ============================================================================
// Auth State Handlers
// ============================================================================

/**
 * Handle LOGOUT message.
 * Clears all auth state and logs the user out.
 */
export async function handleLogout(): Promise<AuthResponse<{ success: boolean }>> {
  try {
    await transitionToLoggedOut('manual');
    return successResponse({ success: true });
  } catch (error) {
    console.error('[handleLogout] Error:', error);
    const authError = AuthError.fromUnknown(error, 'STORAGE_ERROR');
    return errorResponse(authError.code, authError.message);
  }
}

/**
 * Handle GET_AUTH_STATE message.
 * Returns the current authentication state for the popup UI.
 */
export async function handleGetAuthState(): Promise<AuthResponse<AuthStateResponseData>> {
  try {
    const state = await getCurrentState();

    return successResponse({
      isAuthenticated: state.isAuthenticated,
      email: state.email,
      expiresAt: state.expiresAt,
      sessionAge: state.sessionAge,
      flowState: state.flowState,
      otpRequest: state.otpRequest,
    });
  } catch (error) {
    console.error('[handleGetAuthState] Error:', error);
    const authError = AuthError.fromUnknown(error, 'STORAGE_ERROR');
    return errorResponse(authError.code, authError.message);
  }
}

// ============================================================================
// User Info Handlers
// ============================================================================

/**
 * Handle FETCH_USER_INFO message.
 * Fetches user profile from Auth0's /userinfo endpoint.
 */
export async function handleFetchUserInfo(): Promise<AuthResponse<UserInfoResponseData>> {
  try {
    // Get current auth state
    const auth = await getAuthState();
    if (!auth) {
      return errorResponse('NOT_AUTHENTICATED', 'You must be logged in to fetch user info');
    }

    // Check for cached profile (less than 5 minutes old)
    const cachedProfile = await getStoredUserProfile();
    if (cachedProfile && cachedProfile.updatedAt > Date.now() - 5 * 60 * 1000) {
      return successResponse(cachedProfile);
    }

    // Fetch fresh profile from Auth0
    const userInfo = await fetchUserInfo(auth.accessToken);

    // Transform to our UserProfile type
    const profile: UserProfile = {
      sub: userInfo.sub,
      email: userInfo.email,
      email_verified: userInfo.email_verified,
      name: userInfo.name,
      picture: userInfo.picture,
      updatedAt: Date.now(),
    };

    // Cache the profile
    await updateUserProfile(profile);

    return successResponse(profile);
  } catch (error) {
    console.error('[handleFetchUserInfo] Error:', error);
    const authError = AuthError.fromUnknown(error);

    // If token is invalid, try to refresh and retry
    if (authError.code === 'NOT_AUTHENTICATED' || authError.code === 'VALIDATION_ERROR') {
      const refreshResult = await handleRefreshToken();
      if (refreshResult.success) {
        // Retry with new token
        return handleFetchUserInfo();
      }
    }

    return errorResponse(authError.code, authError.message);
  }
}
