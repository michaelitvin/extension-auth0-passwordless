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

1. Go to **Settings** > scroll down to **Refresh Token Expiration**
2. Configure:
   ```
   Set idle refresh token lifetime:  ✓ Enabled
   Idle Refresh Token Lifetime:      604800   (7 days - matches our session)
   Maximum Refresh Token Lifetime:   2592000  (30 days)
   ```
3. Under **Refresh Token Rotation**, configure:
   ```
   Allow Refresh Token Rotation:     ✓ Enabled
   Rotation Overlap Period:          0        (seconds)
   ```
   > 💡 **Rotation Overlap Period**: How long the previous refresh token remains valid after rotation. Set to 0 for immediate invalidation (most secure), or a few seconds if you have concurrent requests.
4. Click **Save**

### Step 6: Enable Passwordless Email

1. Navigate to **Authentication** > **Passwordless**
2. Click **Email**
3. Toggle the switch to **Enabled**
4. Go to the **Applications** tab
5. Enable your application
6. (Optional) Customize the email template in **Templates**
7. Click **Save**

### Step 7: Configure Custom Email Provider (Amazon SES)

> ⚠️ **Why This Is Needed**: Auth0's built-in email provider has restrictions on development tenants. To send emails to any address, you need to configure your own email provider.

#### Part A: Set Up Amazon SES

1. **Create an AWS Account** (if you don't have one)
   - Go to [aws.amazon.com](https://aws.amazon.com)
   - Sign up for a free tier account

2. **Verify Your Domain in SES**
   - Go to **Amazon SES** > **Verified Identities**
   - Click **Create Identity** > select **Domain**
   - Enter your domain (e.g., `yourdomain.com`)
   - Click **Create Identity**

3. **Add DNS Records for DKIM** (in Subdomain Records)

   SES will show you 3 CNAME records for DKIM. Add them to your DNS provider's **Subdomain Records** section:

   | Type | Subdomain | Value |
   |------|-----------|-------|
   | CNAME | `abc123._domainkey` | `abc123.dkim.amazonses.com` |
   | CNAME | `def456._domainkey` | `def456.dkim.amazonses.com` |
   | CNAME | `ghi789._domainkey` | `ghi789.dkim.amazonses.com` |

   > ⚠️ **Common Mistake**: Don't include your domain in the subdomain field - your DNS provider appends it automatically. Enter `abc123._domainkey`, NOT `abc123._domainkey.yourdomain.com`, or you'll create a record like `abc123._domainkey.yourdomain.com.yourdomain.com` which won't work.

4. **Add DMARC Record** (in Subdomain Records)

   | Type | Subdomain | Value |
   |------|-----------|-------|
   | TXT | `_dmarc` | `v=DMARC1; p=none;` |

5. **Add SPF Record** (in Domain Records)

   This tells email servers that Amazon SES is authorized to send email for your domain:

   | Type | Value |
   |------|-------|
   | TXT | `v=spf1 include:amazonses.com ~all` |

6. **Wait for Verification**
   - DNS propagation takes 5-15 minutes (sometimes longer)
   - Verify propagation with: `dig CNAME abc123._domainkey.yourdomain.com +short`
   - Check status in SES console - all 3 DKIM records should show "Verified"
   - If verification stays pending, try clicking **Verify this identity** in SES

#### Part B: Configure Custom MAIL FROM Domain

This improves email deliverability by aligning SPF with your domain (required for DMARC alignment).

1. **In SES Console**
   - Go to **Verified Identities** > click your domain
   - Go to **Configuration** tab
   - Find **Custom MAIL FROM domain** > click **Edit**
   - Enter a subdomain: `mail` (will become `mail.yourdomain.com`)
   - Click **Save**

2. **Add DNS Records for MAIL FROM** (in Subdomain Records)

   SES will show you the required records. Add them to your DNS provider:

   | Type | Subdomain | Priority | Value |
   |------|-----------|----------|-------|
   | MX | `mail` | `10` | `feedback-smtp.{region}.amazonses.com` |
   | TXT | `mail` | - | `v=spf1 include:amazonses.com ~all` |

   > 💡 Replace `{region}` with your SES region (e.g., `us-east-1`, `us-east-2`, `eu-west-1`).

3. **Verify MAIL FROM Status**
   - Wait for DNS propagation (5-15 minutes)
   - Check SES console - MAIL FROM status should show "Verified"

#### Part C: Create IAM Credentials for Auth0

1. **Go to IAM Console**
   - Navigate to **IAM** > **Users**
   - Click **Create User**
   - Name: `auth0-ses-sender`
   - Click **Next**

2. **Attach SES Sending Policy**
   - Select **Attach policies directly**
   - Search for `AmazonSESFullAccess` (or create a custom policy for minimal permissions)
   - Click **Next** > **Create User**

3. **Create Access Keys**
   - Click on the user you just created
   - Go to **Security credentials** tab
   - Click **Create access key**
   - Select **Third-party service**
   - Check the confirmation box, click **Next**
   - Click **Create access key**
   - **Copy both values** (you won't see the secret again!):
     ```
     Access Key ID:     AKIA...
     Secret Access Key: wJalrXUtnFEMI...
     ```

#### Part D: Configure Auth0 Email Provider

1. **Go to Auth0 Dashboard**
   - Navigate to **Branding** > **Email Provider**
   - Click **Use my own email provider**

2. **Select Amazon SES**
   - Choose **Amazon SES** from the provider list

3. **Enter Credentials**
   ```
   Access Key ID:      [Your AWS Access Key ID]
   Secret Access Key:  [Your AWS Secret Access Key]
   Region:             [Your SES region, e.g., us-east-1]
   Default From:       noreply@yourdomain.com
   ```

4. **Save and Verify**
   - Click **Save**
   - Click **Send Test Email** to verify the configuration
   - Check your inbox for the test email

#### Part E: Request SES Production Access

> ⚠️ **Why This Is Needed**: New SES accounts are in "sandbox mode" by default. In sandbox mode, you can only send emails to verified email addresses. To send OTP emails to any user, you must request production access.

1. **Go to SES Console**
   - Navigate to **Amazon SES** > **Account dashboard**
   - You'll see "Your Amazon SES account is in the sandbox" banner

2. **Request Production Access**
   - Click **Request production access** button
   - Or go to **AWS Support** > **Create case** > **Service limit increase**

3. **Fill Out the Request Form**
   ```
   Mail Type:              Transactional
   Website URL:            [See options below]
   Use Case Description:   [See example below]
   ```

   **Website URL Options** (if you don't have a website):
   - GitHub repository URL: `https://github.com/username/repo`
   - LinkedIn profile: `https://linkedin.com/in/yourprofile`
   - Chrome Web Store URL (if published): `https://chrome.google.com/webstore/detail/your-extension-id`

   **Example Use Case Description:**
   ```
   We are building a Chrome extension that uses Auth0 for passwordless
   authentication. Users receive one-time passcodes (OTP) via email to log in.

   - Email type: Transactional (OTP codes only)
   - Expected volume: ~100-500 emails/day
   - Recipients: Only users who explicitly request login codes
   - Bounce/complaint handling: Auth0 manages bounce handling
   - We have configured DKIM, SPF, and DMARC for email authentication
   ```

4. **Additional Questions**
   - **How do you handle bounces and complaints?** Auth0 handles bounce management through SES feedback notifications
   - **How did you build your mailing list?** Emails are only sent when users explicitly request OTP codes
   - **How can recipients opt out?** Users control their accounts; no marketing emails are sent

5. **Submit and Wait**
   - Review your request and submit
   - AWS typically responds within 24-48 hours
   - You'll receive an email when approved

6. **Verify Production Access**
   - Once approved, return to SES **Account dashboard**
   - The sandbox banner should be gone
   - Your sending limits will be shown (typically starts at 50,000 emails/day)

> 💡 **While Waiting**: You can still test by adding recipient email addresses as "Verified Identities" in SES. This allows sending to those specific addresses even in sandbox mode.

#### DNS Records Summary

After completing setup, your domain should have these records:

**Domain Records:**
| Type | Value |
|------|-------|
| TXT (SPF) | `v=spf1 include:amazonses.com ~all` |

**Subdomain Records:**
| Type | Subdomain | Value |
|------|-----------|-------|
| CNAME | `{token1}._domainkey` | `{token1}.dkim.amazonses.com` |
| CNAME | `{token2}._domainkey` | `{token2}.dkim.amazonses.com` |
| CNAME | `{token3}._domainkey` | `{token3}.dkim.amazonses.com` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |
| MX | `mail` | `10 feedback-smtp.{region}.amazonses.com` |
| TXT | `mail` | `v=spf1 include:amazonses.com ~all` |

#### Minimal IAM Policy (Optional)

For production, use a restricted policy instead of `AmazonSESFullAccess`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### Step 8: Verify Configuration

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

### Step 2: Generate Extension Key

> 💡 **Why This Matters**: Chrome assigns each extension a unique ID based on its cryptographic key. Without a consistent key, your extension ID changes every time you rebuild, breaking Auth0 callback URLs.

Generate a permanent extension key:

```bash
npm run generate-key
```

This will:
1. Generate an RSA key pair (`extension.pem`)
2. Add the public key to your `.env` file
3. The extension ID will now be consistent across all builds

> ⚠️ **Important**: Keep `extension.pem` safe! It's your private key and is already in `.gitignore`. If you lose it, you'll need to generate a new key and update Auth0 callback URLs.

To find your extension ID after building:
1. Run `npm run build`
2. Load the extension in Chrome (`chrome://extensions`)
3. Copy the ID shown under your extension name

### Step 3: Add Auth0 Credentials

Edit `.env`:

```env
# Required: Your Auth0 tenant domain
VITE_AUTH0_DOMAIN=your-tenant.auth0.com

# Required: Your Auth0 application client ID
VITE_AUTH0_CLIENT_ID=your-client-id-here

# Optional: Custom API audience (if protecting your own API)
# VITE_AUTH0_AUDIENCE=https://api.yourapp.com
```

### Step 4: Build and Load Extension

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the .output/chrome-mv3 folder
```

### Step 5: Update Auth0 URLs

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

### "Email domain not authorized"

**Cause**: Auth0's built-in email provider restricts sending on development tenants.

**Fix**:
1. Configure a custom email provider (see [Step 7](#step-7-configure-custom-email-provider-amazon-ses))
2. Or use the same email address as your Auth0 account for testing

### "DKIM verification pending"

**Cause**: DNS records not configured correctly or not propagated.

**Fix**:
1. Verify DNS records don't include the domain suffix twice (e.g., `abc._domainkey`, NOT `abc._domainkey.yourdomain.com`)
2. Check propagation with: `dig CNAME abc._domainkey.yourdomain.com +short`
3. Wait 5-15 minutes for DNS propagation
4. Ensure all 3 DKIM CNAME records are added

### Extension doesn't load

**Cause**: Build error or manifest issue.

**Fix**:
```bash
# Rebuild
npm run build

# Check for errors
npm run lint
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
| `src/auth/api-client.ts` | Auth0 API integration |
| `src/auth/state-machine.ts` | Auth state management |
| `src/auth/message-handlers.ts` | Message handlers |
| `src/entrypoints/background.ts` | Service worker |
| `src/entrypoints/popup/` | User interface |
| `src/storage/` | Token storage layer |

---

## Need Help?

- [Auth0 Passwordless Docs](https://auth0.com/docs/authenticate/passwordless)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Project Specification](../specs/001-auth0-passwordless-otp/spec.md)
