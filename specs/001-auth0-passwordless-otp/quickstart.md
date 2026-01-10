# Quickstart: Auth0 Passwordless OTP Extension

**Branch**: `001-auth0-passwordless-otp` | **Date**: 2026-01-10

## Prerequisites

- **Node.js**: v18+ (v20 LTS recommended)
- **pnpm**: v8+ (`npm install -g pnpm`)
- **Chrome/Chromium**: v88+ (Manifest V3 support)
- **Auth0 Account**: Free tier sufficient

## Auth0 Setup (5 minutes)

### 1. Create Native Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com) > Applications > Create Application
2. Name: `Auth0 Passwordless Extension`
3. Type: **Native** (not SPA!)
4. Click Create

### 2. Configure Application

In the application settings:

```
Allowed Callback URLs:
https://<your-extension-id>.chromiumapp.org/callback

Allowed Logout URLs:
https://<your-extension-id>.chromiumapp.org/logout

Allowed Origins (CORS):
chrome-extension://<your-extension-id>
```

> **Note**: Use `chrome://extensions` with Developer Mode to find your extension ID after first load.

### 3. Enable Grant Types

Settings > Advanced Settings > Grant Types:
- [x] Authorization Code
- [x] Refresh Token
- [x] **Passwordless OTP** ← Critical!

### 4. Enable Passwordless Email

1. Authentication > Passwordless > Email
2. Toggle **ON**
3. Applications tab: Enable your application
4. (Optional) Customize email template

### 5. Configure Refresh Tokens

Settings > Refresh Token Rotation:
- [x] Rotation: Enabled
- Absolute Lifetime: `2592000` (30 days)
- Inactivity Lifetime: `604800` (7 days)
- [x] Reuse Detection: Enabled

## Project Setup (5 minutes)

### 1. Create Project

```bash
pnpm create wxt@latest auth0-passwordless-extension -- --template vanilla-ts
cd auth0-passwordless-extension
```

### 2. Install Dependencies

```bash
pnpm add -D @types/chrome
```

### 3. Configure Environment

Create `.env` in project root:

```env
# Auth0 Configuration
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id

# Optional: API audience if using custom API
# VITE_AUTH0_AUDIENCE=https://your-api.example.com
```

### 4. Update Manifest

In `wxt.config.ts`:

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Auth0 Passwordless Demo',
    description: 'Reference implementation of Auth0 passwordless OTP',
    permissions: ['storage', 'alarms', 'identity'],
    host_permissions: ['https://*.auth0.com/*'],
  },
  browser: 'chrome',
  manifestVersion: 3,
});
```

## Development

### Start Dev Server

```bash
pnpm dev
```

### Load Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `.output/chrome-mv3` directory

### Watch for Changes

WXT provides HMR - changes auto-reload the extension.

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts       # Service worker
│   └── popup/
│       ├── index.html      # Popup HTML
│       └── main.ts         # Popup logic
├── auth/
│   ├── index.ts            # Public API
│   ├── passwordless.ts     # Auth0 API calls
│   ├── tokens.ts           # Token management
│   └── types.ts            # TypeScript types
├── storage/
│   └── secure-storage.ts   # Chrome storage wrapper
└── utils/
    └── errors.ts           # Error handling
```

## Quick Test

### 1. Test OTP Flow

1. Click extension icon
2. Enter your email
3. Check email for 6-digit code
4. Enter code
5. See authenticated state

### 2. Test Session Persistence

1. Log in
2. Close and reopen browser
3. Click extension - should still be logged in

### 3. Test API Demo

1. Log in
2. Click "Test API" button
3. See /userinfo response displayed

## Common Issues

### "Passwordless OTP grant not enabled"

- Ensure Auth0 app type is **Native** (not SPA)
- Check Grant Types includes "Passwordless OTP"

### "Invalid redirect URI"

- Verify callback URL matches extension ID exactly
- No trailing slashes
- Use `chromiumapp.org` domain

### "CORS error"

- Add `chrome-extension://<id>` to Allowed Origins
- Verify host_permissions in manifest

### "Token refresh fails"

- Check Refresh Token Rotation is enabled
- Verify inactivity lifetime settings

## Next Steps

- **New to Auth0?** Read [docs/SETUP.md](../../docs/SETUP.md) for complete Auth0 setup and how authentication/authorization works
- Review [spec.md](./spec.md) for full requirements
- See [data-model.md](./data-model.md) for type definitions
- Check [contracts/](./contracts/) for API schemas
- Run `/speckit.tasks` to generate implementation tasks
