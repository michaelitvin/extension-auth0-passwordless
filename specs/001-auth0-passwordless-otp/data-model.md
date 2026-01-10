# Data Model: Auth0 Passwordless OTP Extension

**Branch**: `001-auth0-passwordless-otp` | **Date**: 2026-01-10

## Entities

### AuthState

Represents the complete authentication state stored in the extension.

```typescript
interface AuthState {
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
```

**Storage**:
- `accessToken`, `email`, `expiresAt`, `idToken`, `sessionCreatedAt`: `chrome.storage.session`
- `refreshToken`: `chrome.storage.local` (encrypted)

**Validation Rules**:
- `email`: Valid email format
- `accessToken`: Non-empty JWT string
- `refreshToken`: Non-empty string (opaque token)
- `expiresAt`: Future timestamp
- `sessionCreatedAt`: Past timestamp, max 7 days old

---

### OTPRequest

Represents a pending passwordless OTP verification.

```typescript
interface OTPRequest {
  /** Email address OTP was sent to */
  email: string;

  /** Timestamp when OTP was requested */
  requestedAt: number;

  /** Number of OTP requests made for this email (rate limiting) */
  attemptCount: number;

  /** Timestamp of first request in current rate limit window */
  windowStart: number;
}
```

**Storage**: `chrome.storage.session` (in-memory only, cleared on browser close)

**Validation Rules**:
- `email`: Valid email format, matches user input
- `attemptCount`: Max 5 per 15-minute window (FR-008, SC-006)
- `requestedAt`: Within last 5 minutes for code entry

**State Transitions**:
```
[None] --initiate--> [Pending] --verify--> [Authenticated]
                         |
                         +--expire/cancel--> [None]
                         |
                         +--resend--> [Pending] (attemptCount++)
```

---

### UserProfile

User profile data returned from Auth0 /userinfo endpoint.

```typescript
interface UserProfile {
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
```

**Storage**: `chrome.storage.session` (cached for performance)

**Validation Rules**:
- `sub`: Non-empty string, starts with "auth0|" or provider prefix
- `email`: Valid email format
- `email_verified`: Boolean

---

### TokenResponse

Auth0 token endpoint response structure.

```typescript
interface TokenResponse {
  /** Bearer access token */
  access_token: string;

  /** Refresh token for renewal */
  refresh_token: string;

  /** ID token with user claims */
  id_token: string;

  /** Token type (always "Bearer") */
  token_type: 'Bearer';

  /** Seconds until access token expires */
  expires_in: number;
}
```

**Source**: Auth0 `/oauth/token` endpoint response

---

### AuthError

Standardized error structure for auth operations.

```typescript
interface AuthError {
  /** Error code for programmatic handling */
  code: AuthErrorCode;

  /** Human-readable error message */
  message: string;

  /** Original error (if wrapped) */
  cause?: Error;
}

type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_otp'
  | 'otp_expired'
  | 'rate_limited'
  | 'network_error'
  | 'auth0_unavailable'
  | 'session_expired'
  | 'refresh_failed'
  | 'storage_error';
```

---

## Storage Schema

### chrome.storage.session

```typescript
interface SessionStorage {
  /** Current authentication state */
  auth?: AuthState;

  /** Pending OTP request (if in login flow) */
  otpRequest?: OTPRequest;

  /** Cached user profile */
  userProfile?: UserProfile;
}
```

### chrome.storage.local

```typescript
interface LocalStorage {
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
```

---

## State Machine: Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────┐  email    ┌───────────┐  otp     ┌─────────────┐ │
│  │          │ ─────────>│           │ ────────>│             │ │
│  │  LOGGED  │           │  PENDING  │          │ AUTHENTICATED│ │
│  │   OUT    │<─────────│    OTP    │<────────│             │ │
│  │          │  cancel   │           │  logout  │             │ │
│  └──────────┘           └───────────┘          └─────────────┘ │
│       ^                      │                       │         │
│       │                      │ expire                │ 7 days  │
│       │                      v                       v         │
│       └──────────────────────┴───────────────────────┘         │
│                         SESSION_EXPIRED                         │
└─────────────────────────────────────────────────────────────────┘
```

**States**:
- `LOGGED_OUT`: No valid session, show login form
- `PENDING_OTP`: OTP sent, waiting for code entry
- `AUTHENTICATED`: Valid session, show user info
- `SESSION_EXPIRED`: Session exceeded 7 days or refresh failed

**Transitions**:
| From | Event | To | Side Effects |
|------|-------|-----|--------------|
| LOGGED_OUT | submitEmail | PENDING_OTP | Call `/passwordless/start`, store OTPRequest |
| PENDING_OTP | submitOTP (valid) | AUTHENTICATED | Call `/oauth/token`, store AuthState, schedule refresh |
| PENDING_OTP | submitOTP (invalid) | PENDING_OTP | Show error, allow retry |
| PENDING_OTP | resend | PENDING_OTP | Call `/passwordless/start`, increment attemptCount |
| PENDING_OTP | cancel | LOGGED_OUT | Clear OTPRequest |
| PENDING_OTP | expire (5min) | LOGGED_OUT | Clear OTPRequest, show expiry message |
| AUTHENTICATED | logout | LOGGED_OUT | Clear all storage, cancel alarms |
| AUTHENTICATED | sessionExpired | LOGGED_OUT | Clear storage, show re-auth message |
| AUTHENTICATED | tokenRefresh | AUTHENTICATED | Update tokens, reschedule alarm |

---

## Relationships

```
┌─────────────┐       ┌─────────────┐
│  OTPRequest │──────>│  AuthState  │
│             │ leads │             │
│  (pending)  │  to   │(authenticated)│
└─────────────┘       └──────┬──────┘
                             │
                             │ fetches
                             v
                      ┌─────────────┐
                      │ UserProfile │
                      │             │
                      │  (cached)   │
                      └─────────────┘
```

- **OTPRequest → AuthState**: Successful OTP verification creates AuthState
- **AuthState → UserProfile**: Authenticated state enables /userinfo fetch
