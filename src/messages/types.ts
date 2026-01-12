/**
 * Extension Internal Message Contracts
 *
 * Defines the message types for communication between:
 * - Popup <-> Service Worker
 * - Content Scripts <-> Service Worker (if needed)
 */

import type { AuthErrorCode, UserProfile, AuthFlowState, OTPRequest } from '../auth/types';

// ============================================================================
// Request Messages (Popup -> Service Worker)
// ============================================================================

export type AuthRequest =
  | InitiateOTPRequest
  | VerifyOTPRequest
  | ResendOTPRequest
  | RefreshTokenRequest
  | LogoutRequest
  | GetAuthStateRequest
  | FetchUserInfoRequest;

export interface InitiateOTPRequest {
  type: 'INITIATE_OTP';
  payload: {
    email: string;
  };
}

export interface VerifyOTPRequest {
  type: 'VERIFY_OTP';
  payload: {
    email: string;
    otp: string;
  };
}

export interface ResendOTPRequest {
  type: 'RESEND_OTP';
  payload: {
    email: string;
  };
}

export interface RefreshTokenRequest {
  type: 'REFRESH_TOKEN';
  payload: Record<string, never>;
}

export interface LogoutRequest {
  type: 'LOGOUT';
  payload: Record<string, never>;
}

export interface GetAuthStateRequest {
  type: 'GET_AUTH_STATE';
  payload: Record<string, never>;
}

export interface FetchUserInfoRequest {
  type: 'FETCH_USER_INFO';
  payload: Record<string, never>;
}

// ============================================================================
// Response Messages (Service Worker -> Popup)
// ============================================================================

export type AuthResponse<T = unknown> =
  | AuthSuccessResponse<T>
  | AuthErrorResponse;

export interface AuthSuccessResponse<T> {
  success: true;
  data: T;
}

export interface AuthErrorResponse {
  success: false;
  error: {
    code: AuthErrorCode;
    message: string;
  };
}

// ============================================================================
// Response Payloads
// ============================================================================

export interface InitiateOTPResponseData {
  email: string;
  expiresAt: number;
}

export interface VerifyOTPResponseData {
  email: string;
  expiresAt: number;
}

export interface ResendOTPResponseData {
  email: string;
  expiresAt: number;
  remainingAttempts: number;
}

export interface AuthStateResponseData {
  isAuthenticated: boolean;
  email?: string;
  expiresAt?: number;
  sessionAge?: number;
  flowState?: AuthFlowState;
  otpRequest?: OTPRequest | null;
}

export type UserInfoResponseData = UserProfile;

// ============================================================================
// Event Messages (Service Worker -> Popup, broadcast)
// ============================================================================

export type AuthEvent =
  | AuthStateChangedEvent
  | TokenRefreshedEvent
  | SessionExpiredEvent;

export interface AuthStateChangedEvent {
  type: 'AUTH_STATE_CHANGED';
  payload: {
    isAuthenticated: boolean;
    email?: string;
  };
}

export interface TokenRefreshedEvent {
  type: 'TOKEN_REFRESHED';
  payload: {
    expiresAt: number;
  };
}

export interface SessionExpiredEvent {
  type: 'SESSION_EXPIRED';
  payload: {
    reason: 'timeout' | 'refresh_failed' | 'manual_logout';
  };
}

// ============================================================================
// Message Handler Types
// ============================================================================

/**
 * Type-safe message sender for popup.
 * Uses chrome.runtime.sendMessage to communicate with service worker.
 */
export async function sendAuthMessage<T>(
  request: AuthRequest
): Promise<AuthResponse<T>> {
  return chrome.runtime.sendMessage(request);
}

/**
 * Type for service worker message handler.
 */
export type AuthMessageHandler = (
  request: AuthRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: AuthResponse) => void
) => boolean | undefined;

/**
 * Helper to create a success response.
 */
export function successResponse<T>(data: T): AuthSuccessResponse<T> {
  return { success: true, data };
}

/**
 * Helper to create an error response.
 */
export function errorResponse(
  code: AuthErrorCode,
  message: string
): AuthErrorResponse {
  return { success: false, error: { code, message } };
}
