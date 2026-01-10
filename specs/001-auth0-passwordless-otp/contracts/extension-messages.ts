/**
 * Extension Internal Message Contracts
 *
 * Defines the message types for communication between:
 * - Popup <-> Service Worker
 * - Content Scripts <-> Service Worker (if needed)
 */

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
  payload: Record<string, never>; // Empty object
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

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'AUTH0_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'REFRESH_FAILED'
  | 'STORAGE_ERROR'
  | 'NOT_AUTHENTICATED';

// ============================================================================
// Response Payloads
// ============================================================================

export interface InitiateOTPResponse {
  email: string;
  expiresAt: number; // Timestamp when OTP expires (5 min from now)
}

export interface VerifyOTPResponse {
  email: string;
  expiresAt: number; // Timestamp when session expires
}

export interface AuthStateResponse {
  isAuthenticated: boolean;
  email?: string;
  expiresAt?: number;
  sessionAge?: number; // Seconds since session creation
}

export interface UserInfoResponse {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

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
 * Type-safe message sender for popup
 */
export async function sendAuthMessage<T>(
  request: AuthRequest
): Promise<AuthResponse<T>> {
  return chrome.runtime.sendMessage(request);
}

/**
 * Type for service worker message handler
 */
export type AuthMessageHandler = (
  request: AuthRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: AuthResponse) => void
) => boolean | void;
