# Feature Specification: Auth0 Passwordless OTP Login for Chromium Extension

**Feature Branch**: `001-auth0-passwordless-otp`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "create a reference implementation of auth0 passwordless OTP login flow in a Chromium extension."

## Clarifications

### Session 2026-01-10

- Q: What should the session duration be before requiring re-authentication? → A: 7 days (balanced security/UX, industry standard)
- Q: How should the extension handle access token expiration within a session? → A: Silent refresh (auto-renew tokens in background, seamless UX)
- Q: Should the reference implementation include a demo of using authenticated tokens? → A: Include demo API call (show full auth-to-API-call pattern)
- Q: What backend should be used for the demo API call? → A: Auth0 userinfo only (no custom backend, call Auth0's /userinfo endpoint directly)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial OTP Login (Priority: P1)

A user wants to authenticate to the extension using their email address and a one-time password code, without needing to remember or manage a traditional password.

**Why this priority**: This is the core authentication flow - without it, users cannot access any protected functionality. It provides the fundamental value proposition of passwordless authentication.

**Independent Test**: Can be fully tested by entering an email, receiving an OTP code, and submitting it to gain authenticated access. Delivers the primary value of secure, passwordless login.

**Acceptance Scenarios**:

1. **Given** a user is not authenticated, **When** they open the extension popup and enter a valid email address, **Then** the system initiates the OTP flow and displays a code entry form.
2. **Given** a user has received an OTP code via email, **When** they enter the correct code within the validity window, **Then** they are authenticated and see their authenticated state in the extension.
3. **Given** a user enters an incorrect OTP code, **When** they submit the form, **Then** they see a clear error message indicating the code is invalid and can retry.
4. **Given** a user's OTP code has expired, **When** they attempt to submit it, **Then** they see a message indicating expiration and are offered the option to request a new code.

---

### User Story 2 - Persistent Session Management (Priority: P2)

A user expects to remain logged in across browser sessions until they explicitly log out or the session expires, without re-entering OTP codes every time they open the browser.

**Why this priority**: Session persistence is critical for usability - requiring OTP entry on every browser open would make the extension impractical for regular use.

**Independent Test**: Can be tested by logging in, closing and reopening the browser, and verifying the authenticated state persists.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they close and reopen the browser, **Then** they remain authenticated without needing to re-enter an OTP.
2. **Given** a user's session has expired, **When** they interact with the extension, **Then** they are prompted to re-authenticate via OTP.
3. **Given** a user is authenticated, **When** they click the logout button, **Then** their session is terminated and they see the login form.

---

### User Story 3 - Request New OTP Code (Priority: P3)

A user who did not receive their OTP code, or whose code expired, needs to request a new code to complete authentication.

**Why this priority**: This is a recovery flow that handles common edge cases (email delays, expired codes) and ensures users aren't blocked from accessing the extension.

**Independent Test**: Can be tested by initiating login, waiting for code expiry or simulating non-receipt, requesting a new code, and completing authentication.

**Acceptance Scenarios**:

1. **Given** a user is on the OTP entry screen, **When** they click "Resend Code", **Then** a new OTP is sent to their email and the validity window resets.
2. **Given** a user requests a new code, **When** the request succeeds, **Then** they see confirmation that a new code was sent.
3. **Given** a user has requested too many codes in a short period, **When** they attempt another request, **Then** they see a rate-limiting message indicating they must wait.

---

### User Story 4 - View Authentication Status (Priority: P4)

A user wants to see their current authentication state and identity (email) within the extension interface.

**Why this priority**: Provides user confidence and context about who is logged in, supporting multi-account scenarios and verification.

**Independent Test**: Can be tested by logging in and verifying the displayed email matches the authenticated user.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they view the extension popup, **Then** they see their authenticated email address displayed.
2. **Given** a user is not authenticated, **When** they view the extension popup, **Then** they see the login form instead of user information.

---

### User Story 5 - Demo Authenticated API Call (Priority: P5)

A developer reviewing this reference implementation wants to see a complete example of using the authentication token to make an authenticated API call, demonstrating the full auth-to-API pattern.

**Why this priority**: As a reference implementation, demonstrating token usage completes the developer learning journey. Without this, developers only see half the authentication pattern.

**Independent Test**: Can be tested by logging in and triggering a demo API call to Auth0's /userinfo endpoint, which returns user profile data. No custom backend server is required.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they click a "Test API" button, **Then** the extension makes an authenticated call and displays the response (e.g., user profile data).
2. **Given** a user is authenticated but the token has expired, **When** they click "Test API", **Then** the system silently refreshes the token and completes the API call.
3. **Given** a user is not authenticated, **When** they attempt to access the API demo, **Then** they are prompted to log in first.

---

### Edge Cases

- What happens when the user enters an email not registered with Auth0? (System should still send OTP - Auth0 handles user creation or rejection based on tenant settings)
- How does the system handle network connectivity loss during OTP verification? (User sees a network error message with retry option)
- What happens if the user has multiple extension windows open? (Authentication state should sync across all windows)
- How does the system handle Auth0 service unavailability? (User sees a service unavailable message with guidance to retry later)
- What happens if the user's email provider delays OTP delivery? (User can request a new code; UI indicates expected delivery time)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a popup interface for users to initiate passwordless authentication
- **FR-002**: System MUST accept email address input and validate email format before submission
- **FR-003**: System MUST integrate with Auth0's passwordless OTP API to send verification codes
- **FR-004**: System MUST display a code entry interface after email submission
- **FR-005**: System MUST verify OTP codes against Auth0 and establish authenticated sessions
- **FR-006**: System MUST securely store authentication tokens for session persistence
- **FR-007**: System MUST provide visual feedback for authentication state (loading, success, error)
- **FR-008**: System MUST allow users to request new OTP codes with rate limiting
- **FR-009**: System MUST provide logout functionality that clears stored credentials
- **FR-010**: System MUST handle and display appropriate error messages for all failure scenarios
- **FR-011**: System MUST work within Chromium extension security constraints (manifest v3)
- **FR-012**: System MUST validate OTP codes are entered within the validity window (default: 5 minutes)
- **FR-013**: System MUST sync authentication state across multiple extension instances
- **FR-014**: System MUST expire user sessions after 7 days, requiring re-authentication via OTP
- **FR-015**: System MUST silently refresh access tokens in the background before expiration to maintain seamless user experience
- **FR-016**: System MUST provide a demo feature that calls Auth0's /userinfo endpoint with the access token to retrieve and display user profile data (no custom backend required)

### Key Entities

- **User Session**: Represents an authenticated user state; contains the user's email, access token, and session expiration timestamp. Sessions expire after 7 days of inactivity or on explicit logout
- **OTP Request**: Represents a pending verification; contains the email address, request timestamp, and attempt count for rate limiting
- **Authentication Token**: Secure credential received from Auth0 upon successful verification; includes short-lived access token and refresh token for silent background renewal

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full OTP login flow (email entry to authenticated state) in under 60 seconds, excluding email delivery time
- **SC-002**: 95% of valid OTP codes successfully authenticate on first submission attempt
- **SC-003**: Authenticated sessions persist correctly across browser restarts 100% of the time until explicit logout or expiration
- **SC-004**: Users receive clear, actionable error messages for all failure scenarios within 3 seconds
- **SC-005**: Extension popup loads and displays current authentication state within 500 milliseconds
- **SC-006**: Rate limiting prevents more than 5 OTP requests per email per 15-minute window
- **SC-007**: Users can successfully log out and see the login form within 2 seconds

## Assumptions

- Auth0 tenant is pre-configured with passwordless email OTP enabled
- Auth0 client ID and domain are provided as configuration
- Users have access to the email address they use for authentication
- The extension will use Manifest V3 (current Chromium extension standard)
- Standard OTP validity window of 5 minutes as per Auth0 defaults
- Rate limiting follows Auth0's default policies unless otherwise specified
- No custom backend server is required; all API interactions use Auth0's built-in endpoints (/userinfo for demo)
