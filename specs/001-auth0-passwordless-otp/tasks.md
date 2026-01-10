# Tasks: Auth0 Passwordless OTP Login

**Input**: Design documents from `/specs/001-auth0-passwordless-otp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual test checklists only (per constitution - Chrome OAuth flows require manual testing)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize WXT project with TypeScript and configure Auth0 environment

- [ ] T001 Initialize WXT project with TypeScript template using `pnpm create wxt@latest`
- [ ] T002 Configure wxt.config.ts with manifest permissions (storage, alarms, identity) and host_permissions
- [ ] T003 [P] Configure tsconfig.json with strict mode per constitution in tsconfig.json
- [ ] T004 [P] Add @types/chrome dependency and configure ESLint + Prettier
- [ ] T005 [P] Create .env.example with AUTH0_DOMAIN and AUTH0_CLIENT_ID placeholders in .env.example
- [ ] T006 [P] Create extension icons (16x16, 48x48, 128x128) in public/icons/

---

## Phase 2: Foundational (Core Auth Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Type Definitions

- [ ] T007 [P] Create TypeScript interfaces (AuthState, OTPRequest, TokenResponse, AuthError) in src/auth/types.ts
- [ ] T008 [P] Create message contracts (AuthRequest, AuthResponse types) in src/messages/types.ts

### Storage Layer

- [ ] T009 [P] Implement chrome.storage.session wrapper for access tokens in src/storage/session-storage.ts
- [ ] T010 [P] Implement chrome.storage.local wrapper with encryption for refresh tokens in src/storage/local-storage.ts
- [ ] T011 Implement unified SecureStorage facade combining session and local in src/storage/index.ts

### Auth0 API Client

- [ ] T012 [P] Implement PKCE helper (generateCodeVerifier, generateCodeChallenge) in src/auth/pkce.ts
- [ ] T013 Implement Auth0 config loader (domain, clientId from env) in src/auth/config.ts
- [ ] T014 Implement base Auth0 API client with error handling and retry logic for service worker cold starts in src/auth/api-client.ts

### Token Validation

- [ ] T015 Implement ID token validation (signature, audience, issuer, expiration) in src/auth/token-validation.ts

### Error Handling

- [ ] T016 Implement AuthError class with error codes and user-friendly messages in src/utils/errors.ts

### Service Worker Shell

- [ ] T017 Create service worker entry point with message listener scaffold in src/entrypoints/background.ts

### Auth State Machine (State Persistence Guard)

- [ ] T018 Implement Auth State Machine in service worker - all auth state (code_verifier, email, OTP flow state) persists in chrome.storage.session, survives popup closure. Popup acts as dumb view sending messages only in src/auth/state-machine.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Initial OTP Login (Priority: P1) 🎯 MVP

**Goal**: User can authenticate using email + OTP code (core passwordless flow)

**Independent Test**: Enter email → receive OTP → enter code → see authenticated state

### Implementation for User Story 1

- [ ] T019 [US1] Implement initiateOTP function calling /passwordless/start in src/auth/passwordless.ts
- [ ] T020 [US1] Implement verifyOTP function calling /oauth/token with OTP grant in src/auth/passwordless.ts
- [ ] T021 [US1] Implement OTPRequest state management (tracking attempts, expiry, code_verifier keyed by email for multi-window support) in src/auth/otp-state.ts
- [ ] T022 [US1] Add INITIATE_OTP message handler in service worker in src/entrypoints/background.ts
- [ ] T023 [US1] Add VERIFY_OTP message handler in service worker in src/entrypoints/background.ts
- [ ] T024 [P] [US1] Create popup HTML structure with email form and OTP input in src/entrypoints/popup/index.html
- [ ] T025 [P] [US1] Create popup styles (login form, OTP input, status display) in src/entrypoints/popup/styles.css
- [ ] T026 [US1] Implement popup main.ts with email submission logic in src/entrypoints/popup/main.ts
- [ ] T027 [US1] Implement OTP code input UI with validation (6 digits) in src/entrypoints/popup/main.ts
- [ ] T028 [US1] Add loading states and error message display in popup in src/entrypoints/popup/main.ts
- [ ] T029 [US1] Add email format validation before OTP request in src/auth/validation.ts

**Checkpoint**: User can complete full OTP login flow - MVP functional

---

## Phase 4: User Story 2 - Persistent Session Management (Priority: P2)

**Goal**: User stays logged in across browser restarts until logout or 7-day expiry

**Independent Test**: Login → close browser → reopen → still authenticated

### Implementation for User Story 2

- [ ] T030 [US2] Implement token storage on successful auth (session + local) in src/auth/tokens.ts
- [ ] T031 [US2] Implement session restoration on service worker startup in src/entrypoints/background.ts
- [ ] T032 [US2] Implement 7-day session expiry check in src/auth/session.ts
- [ ] T033 [US2] Implement silent token refresh using chrome.alarms in src/auth/tokens.ts
- [ ] T034 [US2] Add alarm listener for token-refresh in service worker in src/entrypoints/background.ts
- [ ] T035 [US2] Implement logout function clearing all storage in src/auth/session.ts
- [ ] T036 [US2] Add LOGOUT message handler in service worker in src/entrypoints/background.ts
- [ ] T037 [US2] Add logout button and handler in popup UI in src/entrypoints/popup/main.ts
- [ ] T038 [US2] Add GET_AUTH_STATE message handler for popup initialization in src/entrypoints/background.ts

**Checkpoint**: Sessions persist across browser restarts, logout works

---

## Phase 5: User Story 3 - Request New OTP Code (Priority: P3)

**Goal**: User can resend OTP code with rate limiting protection

**Independent Test**: Request OTP → click resend → receive new code (max 5 per 15 min)

### Implementation for User Story 3

- [ ] T039 [US3] Implement rate limiting logic (5 requests per 15-minute window) in src/auth/otp-state.ts
- [ ] T040 [US3] Implement resendOTP function with rate limit check in src/auth/passwordless.ts
- [ ] T041 [US3] Add RESEND_OTP message handler in service worker in src/entrypoints/background.ts
- [ ] T042 [US3] Add "Resend Code" button in OTP entry UI in src/entrypoints/popup/main.ts
- [ ] T043 [US3] Display rate limit countdown when limit reached in src/entrypoints/popup/main.ts
- [ ] T044 [US3] Show confirmation message after successful resend in src/entrypoints/popup/main.ts

**Checkpoint**: Users can resend OTP codes with rate limiting protection

---

## Phase 6: User Story 4 - View Authentication Status (Priority: P4)

**Goal**: User sees their authenticated email and session status in popup

**Independent Test**: Login → view popup → see email displayed

### Implementation for User Story 4

- [ ] T045 [US4] Create authenticated state view showing user email in src/entrypoints/popup/main.ts
- [ ] T046 [US4] Implement auth state detection on popup open in src/entrypoints/popup/main.ts
- [ ] T047 [US4] Add session age indicator (days remaining) in src/entrypoints/popup/main.ts
- [ ] T048 [US4] Implement state sync across multiple popup instances via storage events in src/entrypoints/popup/main.ts

**Checkpoint**: Users see their authentication status clearly

---

## Phase 7: User Story 5 - Demo Authenticated API Call (Priority: P5)

**Goal**: Demonstrate using access token to call Auth0 /userinfo endpoint

**Independent Test**: Login → click "Test API" → see profile data from Auth0

### Implementation for User Story 5

- [ ] T049 [US5] Implement fetchUserInfo function calling /userinfo with access token in src/auth/userinfo.ts
- [ ] T050 [US5] Add FETCH_USER_INFO message handler in service worker in src/entrypoints/background.ts
- [ ] T051 [US5] Handle token refresh before API call if expired in src/auth/userinfo.ts
- [ ] T052 [US5] Add "Test API" button in authenticated popup view in src/entrypoints/popup/main.ts
- [ ] T053 [US5] Display UserProfile response (sub, email, name, picture) in popup in src/entrypoints/popup/main.ts
- [ ] T054 [US5] Add loading and error states for API demo in src/entrypoints/popup/main.ts

**Checkpoint**: Full auth-to-API-call pattern demonstrated

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T055 [P] Create manual test checklist for OAuth flows in tests/manual/oauth-flow.md
- [ ] T056 [P] Add unit tests for PKCE helpers in tests/unit/auth/pkce.test.ts
- [ ] T057 [P] Add unit tests for storage layer in tests/unit/storage/storage.test.ts
- [ ] T058 [P] Add unit tests for validation functions in tests/unit/auth/validation.test.ts
- [ ] T059 Verify docs/SETUP.md accuracy with actual implementation
- [ ] T060 Add inline code comments for reference implementation clarity
- [ ] T061 Run ESLint and fix any warnings
- [ ] T062 Test extension in Chrome, Edge, and Brave browsers
- [ ] T063 Verify all acceptance scenarios from spec.md pass
- [ ] T064 Run pnpm audit and resolve any security vulnerabilities

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
┌───────────────────────────────────────────────────┐
│ User Stories can proceed in priority order:       │
│                                                   │
│   Phase 3: US1 - OTP Login (MVP)                  │
│       ↓                                           │
│   Phase 4: US2 - Session Persistence              │
│       ↓                                           │
│   Phase 5: US3 - Resend OTP                       │
│       ↓                                           │
│   Phase 6: US4 - Auth Status View                 │
│       ↓                                           │
│   Phase 7: US5 - API Demo                         │
└───────────────────────────────────────────────────┘
    ↓
Phase 8: Polish
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (OTP Login) | Foundational | Phase 2 complete |
| US2 (Session) | US1 | T023 (verify handler) |
| US3 (Resend) | US1 | T021 (OTP state) |
| US4 (Status View) | US2 | T030 (token storage) |
| US5 (API Demo) | US2 | T033 (token refresh) |

### Within Each Phase

- Tasks marked [P] can run in parallel
- Sequential tasks depend on previous tasks in same phase
- All Foundational tasks must complete before any User Story tasks

### Parallel Opportunities

**Phase 1 (Setup)**:
- T003, T004, T005, T006 can all run in parallel after T002

**Phase 2 (Foundational)**:
- T007, T008 (types) in parallel
- T009, T010 (storage) in parallel
- T012 (PKCE) independent

**Phase 3 (US1)**:
- T024, T025 (UI structure) can run parallel to auth implementation

---

## Parallel Example: Foundational Phase

```bash
# Launch type definitions in parallel:
Task: "Create TypeScript interfaces in src/auth/types.ts"
Task: "Create message contracts in src/messages/types.ts"

# Launch storage implementations in parallel:
Task: "Implement session storage wrapper in src/storage/session-storage.ts"
Task: "Implement local storage with encryption in src/storage/local-storage.ts"
```

## Parallel Example: User Story 1

```bash
# Launch UI tasks parallel to auth tasks:
Task: "Create popup HTML structure in src/entrypoints/popup/index.html"
Task: "Create popup styles in src/entrypoints/popup/styles.css"
# While working on:
Task: "Implement initiateOTP function in src/auth/passwordless.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (~30 min)
2. Complete Phase 2: Foundational (~2 hours)
3. Complete Phase 3: User Story 1 (~2 hours)
4. **STOP and VALIDATE**: Test OTP login flow end-to-end
5. Deploy/demo if ready - core value delivered!

### Incremental Delivery

| Increment | Stories Complete | Value Delivered |
|-----------|------------------|-----------------|
| MVP | US1 | Users can log in via OTP |
| +Sessions | US1, US2 | Users stay logged in |
| +Resend | US1-US3 | Users can recover from OTP issues |
| +Status | US1-US4 | Users see their auth state |
| +API Demo | US1-US5 | Full reference implementation |

### Time Estimates (Solo Developer)

| Phase | Estimated Time |
|-------|----------------|
| Setup | 30 minutes |
| Foundational | 2-3 hours |
| US1 (MVP) | 2-3 hours |
| US2 | 1-2 hours |
| US3 | 1 hour |
| US4 | 30 minutes |
| US5 | 1 hour |
| Polish | 1-2 hours |
| **Total** | **9-13 hours** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- WXT uses `src/entrypoints/` convention (not `src/background/` or `src/popup/`)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Manual OAuth flow testing required - Chrome APIs not automatable
