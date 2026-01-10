# Implementation Plan: Auth0 Passwordless OTP Login

**Branch**: `001-auth0-passwordless-otp` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-auth0-passwordless-otp/spec.md`

## Summary

Reference implementation of Auth0 passwordless OTP login flow in a Chromium extension (Manifest V3). Users authenticate via email OTP without passwords. Key features include: email-based OTP initiation, code verification, 7-day persistent sessions with silent token refresh, and a demo API call to Auth0's /userinfo endpoint. No custom backend required.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled per constitution)
**Primary Dependencies**: WXT (Vite-based extension framework), chrome.identity API, @types/chrome
**Storage**: chrome.storage.session (access tokens), chrome.storage.local (refresh tokens with encryption)
**Testing**: Vitest for unit tests, manual test checklist for OAuth flows
**Target Platform**: Chromium browsers (Chrome, Edge, Brave) via Manifest V3 extension
**Project Type**: Browser extension (single project with popup UI + service worker)
**Performance Goals**: Popup loads in <500ms, auth flow completes in <60s (excluding email delivery)
**Constraints**: Manifest V3 compliance, minimal permissions (identity, storage only), no persistent background pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | TypeScript 5.x with strict mode, all public APIs typed |
| II. Manifest V3 Compliance | PASS | Service worker for background, promise-based APIs, MV3 CSP |
| III. Secure Token Handling | PASS | chrome.storage.session for access tokens, PKCE required, service worker handles refresh |
| IV. Minimal Permissions | PASS | Only `identity` and `storage` permissions required |
| V. Framework-Agnostic Patterns | PASS | Core auth module decoupled from UI, event-based state changes |

**Technology Stack Compliance**:
- Required: TypeScript 5.x, WXT (Vite-based), chrome.identity + PKCE, @types/chrome, ESLint + Prettier, Vitest
- Prohibited: Webpack, CommonJS, jQuery, @auth0/auth0-spa-js

**Security Requirements Compliance**:
- chrome.identity.launchWebAuthFlow for OAuth
- PKCE implementation (code_verifier + code_challenge)
- ID token validation
- Silent token refresh in service worker
- Auth0 Application Type: Native

**All gates PASS - proceeding to Phase 0.**

### Post-Design Re-check (Phase 1 Complete)

| Principle | Status | Design Validation |
|-----------|--------|-------------------|
| I. TypeScript-First | PASS | All contracts in TypeScript, strict types defined in data-model.md |
| II. Manifest V3 Compliance | PASS | Service worker pattern, chrome.alarms for timers, no persistent background |
| III. Secure Token Handling | PASS | session storage for access tokens, local+encryption for refresh, PKCE documented |
| IV. Minimal Permissions | PASS | Only storage, alarms, identity permissions in manifest |
| V. Framework-Agnostic Patterns | PASS | Core auth/ module has no UI dependencies, event-based messages |

**Post-design gates PASS - ready for task generation.**

## Project Structure

### Documentation (this feature)

```text
specs/001-auth0-passwordless-otp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Auth0 API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── entrypoints/         # WXT entrypoints (auto-discovered)
│   ├── background.ts    # Service worker (token refresh, message handling)
│   └── popup/           # Extension popup UI
│       ├── index.html   # Popup entry
│       ├── main.ts      # Popup initialization
│       └── styles.css   # Popup styles
├── auth/                # Core authentication module (framework-agnostic)
│   ├── index.ts         # Public API exports
│   ├── pkce.ts          # PKCE helper (code_verifier, code_challenge)
│   ├── passwordless.ts  # Auth0 passwordless OTP flow
│   ├── tokens.ts        # Token storage and refresh logic
│   ├── session.ts       # Session management (7-day expiry)
│   └── types.ts         # TypeScript interfaces
├── messages/            # Extension message contracts
│   └── types.ts         # Request/response types for popup <-> service worker
├── storage/             # Chrome storage abstraction
│   └── secure-storage.ts # Encrypted wrapper for chrome.storage
└── utils/               # Shared utilities
    └── errors.ts        # Error handling and user messages

tests/
├── unit/                # Vitest unit tests
│   ├── auth/            # Auth module tests
│   └── storage/         # Storage tests
└── manual/              # Manual test checklists
    └── oauth-flow.md    # OAuth flow test checklist

public/
└── icons/               # Extension icons (16, 48, 128px)

# Root config files (WXT convention)
wxt.config.ts            # WXT + manifest configuration
tsconfig.json            # TypeScript configuration
.env.example             # Auth0 configuration template

docs/
└── SETUP.md             # Quick setup guide (Auth0 config + auth/authz explanation)
```

**Structure Decision**: Single project structure using WXT framework conventions. Entrypoints in `src/entrypoints/` are auto-discovered by WXT. Core auth logic in `src/auth/` is framework-agnostic per constitution. Service worker handles background operations (token refresh). Popup provides user interface.

## Complexity Tracking

> No constitution violations - no complexity justifications needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
