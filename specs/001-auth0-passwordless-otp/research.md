# Research: Auth0 Passwordless OTP in Chromium Extension

**Branch**: `001-auth0-passwordless-otp` | **Date**: 2026-01-10

## 1. Auth0 Passwordless Email OTP API

### Decision
Use Auth0's REST API directly with a two-step flow: `/passwordless/start` to initiate OTP delivery, then `/oauth/token` with the passwordless OTP grant type to exchange the code for tokens.

### Rationale
Auth0 provides a well-documented REST API for passwordless authentication that works in any JavaScript environment, including browser extensions. This approach avoids deprecated SDK dependencies (auth0-chrome) and gives full control over the authentication flow.

### API Details

**Step 1: Initiate OTP - `POST https://{tenant}.auth0.com/passwordless/start`**
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "connection": "email",
  "email": "user@example.com",
  "send": "code",
  "authParams": {
    "scope": "openid profile email offline_access",
    "audience": "YOUR_API_AUDIENCE"
  }
}
```

**Step 2: Exchange OTP for Tokens - `POST https://{tenant}.auth0.com/oauth/token`**
```json
{
  "grant_type": "http://auth0.com/oauth/grant-type/passwordless/otp",
  "client_id": "YOUR_CLIENT_ID",
  "username": "user@example.com",
  "otp": "123456",
  "realm": "email",
  "scope": "openid profile email offline_access"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "v1.M...",
  "id_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### Alternatives Considered
- **Auth0 Universal Login**: Redirect to hosted login page - simpler but less control over UX in extension popup
- **auth0.js SDK**: Adds bundle size and potential MV3 compatibility issues
- **auth0-chrome**: Deprecated, not recommended for new projects

---

## 2. Chrome Extension Auth with PKCE

### Decision
Implement PKCE manually using Web Crypto API for code verifier/challenge generation. Use `chrome.identity.launchWebAuthFlow()` only if redirect-based flow is needed (not for embedded passwordless).

### Rationale
For embedded passwordless OTP (our use case), PKCE is not strictly required since we're using the passwordless/otp grant type directly. However, PKCE implementation is included for completeness and potential future use with authorization code flows.

### Implementation Pattern

```typescript
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

### Key Points
- Redirect URL format: `https://<extension-id>.chromiumapp.org/callback`
- For embedded passwordless, we use direct API calls instead of launchWebAuthFlow
- PKCE helpers available if needed for fallback to authorization code flow

### Alternatives Considered
- **chrome.identity.launchWebAuthFlow**: Required for redirect-based OAuth, not needed for embedded passwordless
- **Third-party PKCE libraries**: Unnecessary overhead, Web Crypto API sufficient

---

## 3. Auth0 Native App Configuration

### Decision
Configure Auth0 application as **"Native"** type to enable Passwordless OTP grant and refresh token rotation.

### Rationale
Auth0 restricts the Passwordless OTP grant type to Native and Regular Web Application types. SPAs cannot use the `/oauth/token` endpoint with passwordless OTP. Native app type also enables proper refresh token handling.

### Configuration Steps

1. **Create Application**:
   - Auth0 Dashboard > Applications > Create Application
   - Select **"Native"** as application type

2. **Configure URLs**:
   ```
   Allowed Callback URLs: https://<extension-id>.chromiumapp.org/callback
   Allowed Logout URLs: https://<extension-id>.chromiumapp.org/logout
   Allowed Origins (CORS): chrome-extension://<extension-id>
   ```

3. **Enable Grant Types** (Settings > Advanced Settings > Grant Types):
   - [x] Authorization Code
   - [x] Refresh Token
   - [x] **Passwordless OTP** (critical for this implementation)

4. **Configure Refresh Token Rotation** (Settings > Refresh Token Rotation):
   - Enable **Rotation**
   - Set **Absolute Lifetime**: 2592000 seconds (30 days)
   - Set **Inactivity Lifetime**: 604800 seconds (7 days per spec)
   - Enable **Reuse Detection**

5. **Enable Passwordless Connection**:
   - Auth0 Dashboard > Authentication > Passwordless > Email
   - Enable your application in the Applications tab

### Alternatives Considered
- **SPA Application Type**: Cannot use embedded passwordless API - rejected
- **Regular Web Application**: Requires client_secret, not suitable for public clients

---

## 4. Token Refresh in MV3 Service Workers

### Decision
Use `chrome.storage.session` for access tokens, `chrome.storage.local` for encrypted refresh tokens, with `chrome.alarms` API for proactive refresh scheduling.

### Rationale
MV3 service workers are ephemeral (terminate after ~30s inactivity). Using `chrome.alarms` ensures refresh timers survive worker restarts. `chrome.storage.session` provides secure, in-memory storage that clears on browser close.

### Implementation Pattern

**Token Storage:**
```typescript
interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp
  email: string;
}

// Access tokens - session storage (cleared on browser close)
await chrome.storage.session.set({ auth: authState });

// Refresh tokens - local storage (persists, should be encrypted)
await chrome.storage.local.set({ refreshToken: encryptedToken });
```

**Alarm-Based Refresh:**
```typescript
// Schedule refresh 5 minutes before expiration
async function scheduleTokenRefresh(expiresIn: number): Promise<void> {
  const refreshInMinutes = Math.max(1, (expiresIn - 300) / 60);
  await chrome.alarms.create('token-refresh', {
    delayInMinutes: refreshInMinutes
  });
}

// Handle in service worker
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'token-refresh') {
    await performSilentRefresh();
  }
});
```

**Service Worker Initialization:**
```typescript
chrome.runtime.onStartup.addListener(async () => {
  const tokens = await getTokens();
  if (tokens && tokens.expiresAt > Date.now()) {
    const remainingSeconds = (tokens.expiresAt - Date.now()) / 1000;
    await scheduleTokenRefresh(remainingSeconds);
  }
});
```

### Key Considerations
- `chrome.alarms` minimum interval: 30 seconds (sufficient for token refresh)
- `chrome.storage.session` quota: ~10MB (ample for tokens)
- Refresh token stored in `chrome.storage.local` with encryption wrapper per constitution

### Alternatives Considered
- **Silent launchWebAuthFlow**: Use `interactive: false` with `prompt=none` - adds complexity, not needed for refresh token flow
- **Background fetch**: Not reliable in MV3 service workers

---

## 5. Build Framework: WXT vs CRXJS

### Decision
Use **WXT (Web Extension Toolkit)** as the build framework with Vite under the hood.

### Rationale
2025-2026 analysis shows WXT as superior for new projects:
- Active maintenance and development
- TypeScript-first with excellent type support
- Cross-browser support built-in
- File-based routing for entrypoints
- Vite-powered with HMR support

CRXJS remained in beta for 3+ years and has maintenance concerns.

### Project Setup

```bash
pnpm create wxt@latest auth0-passwordless-extension
```

**Project Structure:**
```
src/
├── entrypoints/
│   ├── background.ts      # Service worker
│   └── popup/
│       ├── index.html
│       └── main.ts
├── auth/                   # Core auth module
├── storage/                # Storage abstraction
└── utils/
```

**wxt.config.ts:**
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Auth0 Passwordless Extension',
    permissions: ['storage', 'alarms', 'identity'],
    host_permissions: ['https://*.auth0.com/*']
  },
  browser: 'chrome',
  manifestVersion: 3
});
```

### Alternatives Considered

| Framework | Verdict | Reason |
|-----------|---------|--------|
| CRXJS | Rejected | Beta for 3+ years, maintenance concerns |
| Plasmo | Rejected | Uses Parcel (not Vite), heavier abstraction |
| vite-plugin-web-extension | Rejected | Less features than WXT, less active |
| Raw Vite | Rejected | Requires manual manifest handling |

---

## Summary

| Topic | Decision | Key Technology |
|-------|----------|----------------|
| Auth0 API | Direct REST API calls | `/passwordless/start` + `/oauth/token` with OTP grant |
| PKCE | Web Crypto implementation | Available for fallback, not required for embedded flow |
| Auth0 App | Native type | Enables Passwordless OTP grant + refresh rotation |
| Token Storage | Session + Local storage | `chrome.storage.session` (access), `.local` (refresh) |
| Token Refresh | Alarm-based proactive | `chrome.alarms` API survives worker termination |
| Build Framework | WXT | Vite-powered, TypeScript-first, actively maintained |

---

## References

- [Auth0 Passwordless Documentation](https://auth0.com/docs/authenticate/passwordless)
- [Auth0 Passwordless API Endpoints](https://auth0.com/docs/authenticate/passwordless/implement-login/embedded-login/relevant-api-endpoints)
- [chrome.identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [MV3 Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [WXT Framework Documentation](https://wxt.dev/)
