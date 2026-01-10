# Auth0 Passwordless Extension Setup Guide

This guide walks you through setting up Auth0 and understanding how authentication and authorization work in this Chrome extension.

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Auth0 Setup](#auth0-setup)
4. [Extension Configuration](#extension-configuration)
5. [Testing Your Setup](#testing-your-setup)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Passwordless Authentication?

Instead of remembering passwords, users receive a one-time code (OTP) via email. They enter this code to prove their identity. Benefits:

- **No passwords to remember** - reduces friction
- **No passwords to steal** - improves security
- **No password resets** - reduces support burden

### What This Extension Does

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   User      │      │  Extension  │      │   Auth0     │
│  (Browser)  │      │  (Popup)    │      │  (Server)   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │  1. Enter email    │                    │
       │ ──────────────────>│                    │
       │                    │  2. Request OTP    │
       │                    │ ──────────────────>│
       │                    │                    │
       │  3. Receive email  │<───────────────────│
       │     with code      │                    │
       │                    │                    │
       │  4. Enter code     │                    │
       │ ──────────────────>│                    │
       │                    │  5. Verify code    │
       │                    │ ──────────────────>│
       │                    │                    │
       │                    │  6. Get tokens     │
       │                    │<───────────────────│
       │  7. Logged in!     │                    │
       │<───────────────────│                    │
```

---

## How It Works

### Authentication vs Authorization

| Concept | Question Answered | In This Extension |
|---------|-------------------|-------------------|
| **Authentication** | "Who are you?" | User proves identity via email OTP |
| **Authorization** | "What can you do?" | Access token grants API access |

### The Token System

After successful OTP verification, Auth0 returns three tokens:

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOKEN TYPES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  Short-lived (24h)                            │
│  │ Access Token │  Used to call APIs                            │
│  │    (JWT)     │  Contains: user ID, scopes, expiration        │
│  └──────────────┘  Stored in: chrome.storage.session            │
│                                                                 │
│  ┌──────────────┐  Long-lived (7 days)                          │
│  │Refresh Token │  Used to get new access tokens                │
│  │   (opaque)   │  Never sent to APIs, only to Auth0            │
│  └──────────────┘  Stored in: chrome.storage.local (encrypted)  │
│                                                                 │
│  ┌──────────────┐  Contains user info                           │
│  │  ID Token    │  Email, name, profile picture                 │
│  │    (JWT)     │  Used for display only, not for API calls     │
│  └──────────────┘  Stored in: chrome.storage.session            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Session Lifecycle

```
Day 0                    Day 1-6                      Day 7
  │                         │                           │
  ▼                         ▼                           ▼
┌─────┐                 ┌─────────┐                 ┌────────┐
│Login│ ───────────────>│ Active  │ ───────────────>│Expired │
│ OTP │                 │ Session │                 │Re-login│
└─────┘                 └─────────┘                 └────────┘
                             │
                             │ Every ~23 hours
                             ▼
                    ┌─────────────────┐
                    │ Silent Refresh  │
                    │ (in background) │
                    └─────────────────┘
```

- **Login**: User enters email → receives OTP → enters code → gets tokens
- **Active Session**: Access token valid, user can use extension
- **Silent Refresh**: Before access token expires, service worker automatically gets a new one
- **Session Expiry**: After 7 days, user must re-authenticate with OTP

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    POPUP (User Interface)                   ││
│  │  • Login form                                               ││
│  │  • OTP entry                                                ││
│  │  • User status display                                      ││
│  │  • CANNOT access tokens directly                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              │ Messages                         │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              SERVICE WORKER (Background)                    ││
│  │  • Handles all Auth0 API calls                              ││
│  │  • Manages token storage                                    ││
│  │  • Performs silent refresh                                  ││
│  │  • Only component with token access                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    CHROME STORAGE                           ││
│  │  • session: access token, ID token (cleared on browser close)│
│  │  • local: encrypted refresh token (persists)                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auth0 Setup

### Step 1: Create an Auth0 Account

1. Go to [auth0.com](https://auth0.com)
2. Click "Sign Up" (free tier is sufficient)
3. Create a tenant (e.g., `my-company.auth0.com`)

### Step 2: Create a Native Application

> ⚠️ **Important**: Must be "Native" type, NOT "Single Page Application"

1. Navigate to **Applications** > **Applications**
2. Click **Create Application**
3. Enter name: `Auth0 Passwordless Extension`
4. Select type: **Native**
5. Click **Create**

### Step 3: Configure Application Settings

In your application's **Settings** tab:

#### Basic Information
```
Domain:     your-tenant.auth0.com  (copy this)
Client ID:  abc123xyz...           (copy this)
```

#### Application URIs

```
Allowed Callback URLs:
https://YOUR_EXTENSION_ID.chromiumapp.org/callback

Allowed Logout URLs:
https://YOUR_EXTENSION_ID.chromiumapp.org/logout

Allowed Web Origins:
chrome-extension://YOUR_EXTENSION_ID
```

> 💡 **Finding Your Extension ID**: Load the extension in Chrome (`chrome://extensions` with Developer Mode), then copy the ID shown under your extension.

#### Scroll down and click **Save Changes**

### Step 4: Enable Grant Types

1. Go to **Settings** > **Advanced Settings** > **Grant Types**
2. Enable these grants:
   - [x] Authorization Code
   - [x] Refresh Token
   - [x] **Passwordless OTP** ← This is critical!
3. Click **Save**

### Step 5: Configure Refresh Tokens

1. Go to **Settings** > **Refresh Token Rotation**
2. Configure:
   ```
   Rotation:            Enabled
   Reuse Detection:     Enabled
   Absolute Lifetime:   2592000  (30 days max)
   Inactivity Lifetime: 604800   (7 days - matches our session)
   ```
3. Click **Save**

### Step 6: Enable Passwordless Email

1. Navigate to **Authentication** > **Passwordless**
2. Click **Email**
3. Toggle the switch to **Enabled**
4. Go to the **Applications** tab
5. Enable your application
6. (Optional) Customize the email template in **Templates**
7. Click **Save**

### Step 7: Verify Configuration

Your Auth0 setup checklist:

- [ ] Application type is "Native"
- [ ] Passwordless OTP grant is enabled
- [ ] Refresh Token grant is enabled
- [ ] Refresh Token Rotation is enabled
- [ ] Passwordless Email connection is enabled
- [ ] Your application is enabled for Passwordless Email
- [ ] Callback URLs include your extension ID

---

## Extension Configuration

### Step 1: Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### Step 2: Add Auth0 Credentials

Edit `.env`:

```env
# Required: Your Auth0 tenant domain
VITE_AUTH0_DOMAIN=your-tenant.auth0.com

# Required: Your Auth0 application client ID
VITE_AUTH0_CLIENT_ID=your-client-id-here

# Optional: Custom API audience (if protecting your own API)
# VITE_AUTH0_AUDIENCE=https://api.yourapp.com
```

### Step 3: Build and Load Extension

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm dev

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the .output/chrome-mv3 folder
```

### Step 4: Update Auth0 URLs

After loading the extension, you'll see its ID in Chrome. Go back to Auth0 and update the URLs with the real extension ID.

---

## Testing Your Setup

### Test 1: Basic Login Flow

1. Click the extension icon
2. Enter your email address
3. Check your email for the 6-digit code
4. Enter the code in the extension
5. ✅ You should see your email displayed as "logged in"

### Test 2: Session Persistence

1. Log in (if not already)
2. Close Chrome completely
3. Reopen Chrome
4. Click the extension icon
5. ✅ You should still be logged in

### Test 3: API Demo

1. Log in (if not already)
2. Click "Test API" button
3. ✅ You should see your profile info from Auth0's /userinfo endpoint

### Test 4: Logout

1. Click "Logout" button
2. ✅ You should see the login form
3. Close and reopen Chrome
4. ✅ You should still see the login form (session cleared)

---

## Troubleshooting

### "Passwordless OTP grant type is not enabled"

**Cause**: Auth0 application is SPA type or OTP grant not enabled.

**Fix**:
1. Verify application type is "Native" in Auth0 Dashboard
2. Enable "Passwordless OTP" in Grant Types

### "Invalid redirect URI"

**Cause**: Callback URL mismatch.

**Fix**:
1. Get exact extension ID from `chrome://extensions`
2. Update Allowed Callback URLs in Auth0:
   ```
   https://EXACT_EXTENSION_ID.chromiumapp.org/callback
   ```
3. No trailing slash!

### "CORS error" / "Network error"

**Cause**: Origin not allowed.

**Fix**:
1. Add to Allowed Web Origins in Auth0:
   ```
   chrome-extension://YOUR_EXTENSION_ID
   ```

### "Token refresh failed"

**Cause**: Refresh token expired or rotation misconfigured.

**Fix**:
1. Enable Refresh Token Rotation in Auth0
2. Check Inactivity Lifetime is set (604800 recommended)
3. Log out and log in again

### "OTP code invalid"

**Cause**: Code expired (5 min lifetime) or typo.

**Fix**:
1. Request a new code
2. Enter code within 5 minutes
3. Check spam folder for email

### Extension doesn't load

**Cause**: Build error or manifest issue.

**Fix**:
```bash
# Rebuild
pnpm build

# Check for errors
pnpm lint
```

---

## Quick Reference

### Auth0 Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /passwordless/start` | Send OTP email |
| `POST /oauth/token` | Exchange OTP for tokens |
| `GET /userinfo` | Get user profile |

### Permissions Required

| Permission | Why |
|------------|-----|
| `storage` | Store tokens securely |
| `alarms` | Schedule token refresh |
| `identity` | OAuth redirect handling |

### Key Files

| File | Purpose |
|------|---------|
| `src/auth/passwordless.ts` | Auth0 API integration |
| `src/auth/tokens.ts` | Token management |
| `src/background/service-worker.ts` | Background operations |
| `src/popup/` | User interface |

---

## Need Help?

- [Auth0 Passwordless Docs](https://auth0.com/docs/authenticate/passwordless)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Project Specification](../specs/001-auth0-passwordless-otp/spec.md)
