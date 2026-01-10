<!--
## Sync Impact Report

**Version change**: 0.0.0 → 1.0.0 (MAJOR: Initial constitution ratification)

**Modified principles**: N/A (initial version)

**Added sections**:
- Core Principles (5 principles: TypeScript-First, Manifest V3, Secure Token Handling,
  Minimal Permissions, Framework-Agnostic)
- Technology Stack (Vite + CRXJS, chrome.identity API, @types/chrome)
- Security Requirements (PKCE, launchWebAuthFlow, Native app type)
- Development Workflow
- Governance

**Removed sections**: N/A (initial version)

**Templates requiring updates**:
- ✅ `.specify/templates/plan-template.md` - Compatible (no changes needed)
- ✅ `.specify/templates/spec-template.md` - Compatible (no changes needed)
- ✅ `.specify/templates/tasks-template.md` - Compatible (no changes needed)

**Validation sources (2026)**:
- Chrome extension auth: chrome.identity.launchWebAuthFlow + PKCE (Google Identity Platform docs)
- Build tooling: Vite + CRXJS/vite-plugin-web-extension (industry standard over Webpack)
- Token storage: chrome.storage.session for sensitive data (Chrome API docs)
- Auth0 config: Native app type required, auth0-chrome deprecated
- Types: @types/chrome (818k weekly downloads) or chrome-types (official Google)

**Follow-up TODOs**: None
-->

# Auth0 Passwordless Extension Template Constitution

## Core Principles

### I. TypeScript-First

All source code MUST be written in TypeScript with strict mode enabled. Type safety is
non-negotiable for both extension code and build tooling.

**Rationale**: TypeScript catches authentication flow errors at compile time, provides
self-documenting APIs, and ensures maintainability as a reference implementation.

**Requirements**:
- `strict: true` in tsconfig.json
- No `any` types except when interfacing with untyped third-party libraries (MUST be
  documented with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`)
- All public APIs MUST have explicit type annotations

### II. Manifest V3 Compliance

The extension MUST use Chrome Extension Manifest V3 exclusively. No Manifest V2 patterns
or polyfills permitted.

**Rationale**: Manifest V3 is required for Chrome Web Store distribution since 2024 and
represents the modern, secure extension architecture.

**Requirements**:
- Service workers for background scripts (no persistent background pages)
- Declarative net request for any network modifications
- Promise-based APIs preferred over callback patterns
- Content Security Policy compliance with MV3 restrictions

### III. Secure Token Handling

All authentication tokens and secrets MUST follow browser extension security best
practices. No tokens in localStorage; chrome.storage.session preferred.

**Rationale**: Extensions have unique security contexts. Improper token storage exposes
users to XSS and extension-based attacks.

**Requirements**:
- Access tokens MUST use `chrome.storage.session` (encrypted, session-scoped)
- Refresh tokens MUST use `chrome.storage.local` with encryption wrapper
- PKCE (Proof Key for Code Exchange) MUST be used for OAuth flows
- No tokens in URL parameters or console logs
- Token refresh MUST happen in service worker, not content scripts

### IV. Minimal Permissions

The extension MUST request only the minimum permissions required for Auth0
authentication. Every permission MUST be justified in documentation.

**Rationale**: Users trust extensions based on permissions requested. Excessive
permissions reduce adoption and create security audit burdens.

**Requirements**:
- `identity` permission for OAuth flow
- `storage` permission for token persistence
- No `<all_urls>` or broad host permissions unless explicitly justified
- Optional permissions for features beyond core authentication
- Permission justification documented in README.md

### V. Framework-Agnostic Patterns

The authentication logic MUST be decoupled from UI frameworks. Core auth module works
with vanilla JS; framework integrations are optional wrappers.

**Rationale**: As a template, this project serves developers using React, Vue, Svelte,
or vanilla JS. Framework lock-in limits utility.

**Requirements**:
- Core `auth/` module has zero UI framework dependencies
- Event-based API for auth state changes (CustomEvent or similar)
- Framework examples (React hooks, Vue composables) in separate directories
- Build output includes both ESM and bundled formats

## Technology Stack

**Required**:
- TypeScript 5.x with strict mode
- Vite + CRXJS or vite-plugin-web-extension for build tooling (HMR, native ESM)
- chrome.identity API with custom PKCE implementation for Auth0 (auth0-chrome is deprecated)
- Chrome Types (`@types/chrome` from DefinitelyTyped or `chrome-types` from Google)
- ESLint + Prettier for code quality
- Vitest for unit testing

**Recommended**:
- pnpm for package management (faster, stricter)
- Tailwind CSS for popup/options UI (optional, not in core)
- auth0.js for token validation helpers (optional, not required for core flow)

**Prohibited**:
- Webpack (use Vite instead - faster builds, simpler config)
- CommonJS modules in source (ESM only)
- jQuery or legacy DOM libraries
- @auth0/auth0-spa-js (designed for SPAs, not extensions)

## Security Requirements

**Authentication Flow**:
- MUST use `chrome.identity.launchWebAuthFlow` for OAuth initiation
- MUST implement Authorization Code Flow with PKCE (code_verifier + code_challenge)
- MUST validate ID tokens (signature, audience, issuer, expiration)
- MUST handle token refresh before expiration
- MUST provide secure logout (clear tokens, revoke if possible)
- Auth0 Application Type MUST be set to "Native" (not SPA)

**Extension Security**:
- Content Security Policy MUST disallow inline scripts
- External script loading MUST use integrity hashes when possible
- Cross-origin requests limited to Auth0 tenant domain
- No eval() or Function() constructors

**Code Quality**:
- All dependencies MUST be audited (`pnpm audit` clean)
- No dependencies with known critical vulnerabilities
- Dependabot or Renovate configured for security updates

## Development Workflow

**Local Development**:
1. Clone repository
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and configure Auth0 credentials
4. Run `pnpm dev` for watch mode with HMR
5. Load `dist/` as unpacked extension in Chrome

**Testing Requirements**:
- Unit tests for auth logic (Vitest)
- Integration tests optional but encouraged
- Manual test checklist for OAuth flows (automated testing limited by Chrome APIs)

**Pull Request Requirements**:
- TypeScript compilation MUST succeed with zero errors
- ESLint MUST pass with zero warnings
- All existing tests MUST pass
- New auth features MUST include corresponding tests

## Governance

This constitution establishes the foundational principles for the Auth0 Passwordless
Extension Template. All contributions, features, and architectural decisions MUST align
with these principles.

**Amendment Process**:
1. Propose amendment via GitHub Issue with rationale
2. Discussion period of at least 48 hours
3. Amendment requires explicit approval from maintainers
4. Update constitution version and document migration path

**Versioning Policy**:
- MAJOR: Principle removal or fundamental redefinition
- MINOR: New principle added or existing principle expanded
- PATCH: Clarifications, typos, or non-semantic changes

**Compliance**:
- All PRs MUST verify alignment with constitution principles
- Constitution violations block merge until resolved or justified
- Runtime guidance available in project README.md

**Version**: 1.0.0 | **Ratified**: 2026-01-10 | **Last Amended**: 2026-01-10
