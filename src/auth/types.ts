/**
 * Core authentication types for Auth0 Passwordless Extension
 * Based on data-model.md specifications
 */

/**
 * Complete authentication state stored in the extension.
 * Access tokens and session data in chrome.storage.session,
 * Refresh tokens encrypted in chrome.storage.local.
 */
export interface AuthState {
  /** User's email address (from ID token) */
  email: string;

  /** Short-lived access token for API calls */
  accessToken: string;

  /** Long-lived refresh token for silent renewal */
  refreshToken: string;

  /** Timestamp when access token expires (ms since epoch) */
  expiresAt: number;

  /** ID token containing user claims (optional, for userinfo) */
  idToken?: string;

  /** Session creation timestamp for 7-day expiry tracking */
  sessionCreatedAt: number;
}

/**
 * Represents a pending passwordless OTP verification.
 * Stored in chrome.storage.session (cleared on browser close).
 */
export interface OTPRequest {
  /** Email address OTP was sent to */
  email: string;

  /** Timestamp when OTP was requested */
  requestedAt: number;

  /** Number of OTP requests made for this email (rate limiting) */
  attemptCount: number;

  /** Timestamp of first request in current rate limit window */
  windowStart: number;

  /** PKCE code verifier for this OTP flow (if using authorization code) */
  codeVerifier?: string;
}

/**
 * User profile data returned from Auth0 /userinfo endpoint.
 */
export interface UserProfile {
  /** Auth0 user ID (sub claim) */
  sub: string;

  /** User's email address */
  email: string;

  /** Whether email is verified */
  email_verified: boolean;

  /** User's display name (optional) */
  name?: string;

  /** Profile picture URL (optional) */
  picture?: string;

  /** Last profile fetch timestamp */
  updatedAt: number;
}

/**
 * Auth0 token endpoint response structure.
 */
export interface TokenResponse {
  /** Bearer access token */
  access_token: string;

  /** Refresh token for renewal (may not be returned on refresh) */
  refresh_token?: string;

  /** ID token with user claims (may not be returned on refresh) */
  id_token?: string;

  /** Token type (always "Bearer") */
  token_type: 'Bearer';

  /** Seconds until access token expires */
  expires_in: number;
}

/**
 * Error codes for authentication operations.
 */
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
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'EMAIL_DOMAIN_NOT_ALLOWED';

/**
 * Auth0 API error response.
 * Auth0 can return errors in different formats depending on the endpoint.
 */
export interface Auth0ErrorResponse {
  error: string;
  error_description?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Authentication flow states.
 */
export type AuthFlowState =
  | 'LOGGED_OUT'
  | 'PENDING_OTP'
  | 'AUTHENTICATED'
  | 'SESSION_EXPIRED';

/**
 * Session storage schema for chrome.storage.session.
 */
export interface SessionStorageSchema {
  /** Current authentication state */
  auth?: Omit<AuthState, 'refreshToken'>;

  /** Pending OTP request (if in login flow) */
  otpRequest?: OTPRequest;

  /** Cached user profile */
  userProfile?: UserProfile;

  /** Current auth flow state */
  flowState?: AuthFlowState;
}

/**
 * Local storage schema for chrome.storage.local.
 */
export interface LocalStorageSchema {
  /** Encrypted refresh token for session persistence */
  encryptedRefreshToken?: string;

  /** Encryption IV for refresh token */
  refreshTokenIV?: string;

  /** Session metadata for 7-day tracking */
  sessionMeta?: {
    createdAt: number;
    email: string;
  };
}
