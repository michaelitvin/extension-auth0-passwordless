# Manual Test Checklist: Auth0 Passwordless OTP Flow

**Purpose**: Manual testing checklist for OAuth flows that cannot be automated due to Chrome extension security constraints.

**Prerequisites**:
1. Auth0 tenant configured per docs/SETUP.md
2. `.env` file with valid Auth0 credentials
3. Extension loaded in Chrome via `chrome://extensions` (Developer mode)

---

## US1: Initial OTP Login

### Test 1.1: Email Submission
- [ ] Open extension popup
- [ ] Enter valid email address
- [ ] Click "Send Code"
- [ ] Verify loading state appears
- [ ] Verify OTP entry screen appears
- [ ] Check email inbox for OTP code

### Test 1.2: OTP Verification (Success)
- [ ] Enter correct 6-digit OTP
- [ ] Click "Verify"
- [ ] Verify loading state appears
- [ ] Verify authenticated view appears
- [ ] Verify user email is displayed

### Test 1.3: OTP Verification (Failure)
- [ ] Enter incorrect OTP code
- [ ] Click "Verify"
- [ ] Verify error message appears: "The code you entered is incorrect"
- [ ] Verify user can retry with correct code

### Test 1.4: Invalid Email
- [ ] Enter invalid email format (e.g., "notanemail")
- [ ] Click "Send Code"
- [ ] Verify error message appears

### Test 1.5: OTP Expiry
- [ ] Submit email to receive OTP
- [ ] Wait 5+ minutes without entering code
- [ ] Enter the expired OTP
- [ ] Verify expiry error message appears

---

## US2: Session Persistence

### Test 2.1: Browser Restart
- [ ] Complete full login flow
- [ ] Close browser completely
- [ ] Reopen browser
- [ ] Open extension popup
- [ ] Verify still authenticated (no re-login required)

### Test 2.2: Logout
- [ ] While authenticated, click "Sign Out"
- [ ] Verify login screen appears
- [ ] Close and reopen popup
- [ ] Verify login screen still shown (logged out)

### Test 2.3: 7-Day Session Expiry
- [ ] (Requires waiting or modifying storage)
- [ ] Verify session expires after 7 days
- [ ] Verify user is prompted to re-authenticate

---

## US3: Resend OTP

### Test 3.1: Resend Success
- [ ] Submit email to initiate OTP
- [ ] On OTP screen, click "Resend Code"
- [ ] Verify confirmation message appears
- [ ] Verify remaining attempts shown
- [ ] Check email for new OTP

### Test 3.2: Rate Limiting
- [ ] Click "Resend Code" multiple times
- [ ] Verify rate limit message after 5 attempts
- [ ] Verify countdown or wait message shown

### Test 3.3: Back to Login
- [ ] On OTP screen, click "Use different email"
- [ ] Verify login screen appears
- [ ] Verify can enter new email

---

## US4: Authentication Status

### Test 4.1: Status Display
- [ ] While authenticated, open popup
- [ ] Verify email is displayed
- [ ] Verify session expiry info shown
- [ ] Verify avatar/initial displayed

### Test 4.2: Not Authenticated
- [ ] While logged out, open popup
- [ ] Verify login form appears (not authenticated view)

---

## US5: API Demo

### Test 5.1: Test API Call
- [ ] While authenticated, click "Test API Call"
- [ ] Verify loading state
- [ ] Verify user profile data displayed
- [ ] Verify includes: sub, email, name (if available)

### Test 5.2: Token Refresh
- [ ] (After token expiry, before session expiry)
- [ ] Click "Test API Call"
- [ ] Verify silent token refresh occurs
- [ ] Verify API call succeeds

---

## Cross-Browser Testing

### Chrome
- [ ] All tests pass in Chrome

### Edge (Chromium)
- [ ] Extension loads successfully
- [ ] Login flow works
- [ ] Session persists

### Brave
- [ ] Extension loads successfully
- [ ] Login flow works
- [ ] Session persists

---

## Edge Cases

### Network Errors
- [ ] Disable network, try to login
- [ ] Verify network error message appears
- [ ] Re-enable network, verify retry works

### Multiple Windows
- [ ] Login in one window
- [ ] Open popup in second window
- [ ] Verify both show authenticated state

### Service Worker Restart
- [ ] Login, then go to `chrome://extensions`
- [ ] Click "Service Worker" to inspect, then close it
- [ ] Open popup
- [ ] Verify auth state restored correctly

---

## Test Results

| Test | Date | Browser | Result | Notes |
|------|------|---------|--------|-------|
| | | | | |
