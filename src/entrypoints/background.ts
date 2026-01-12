/**
 * Service Worker Entry Point
 *
 * Handles all background operations for the Auth0 Passwordless extension:
 * - Message handling (popup <-> service worker communication)
 * - Token refresh scheduling via chrome.alarms
 * - Session restoration on startup
 */

import type { AuthRequest, AuthResponse } from '../messages/types';
import { errorResponse } from '../messages/types';
import {
  initializeStateMachine,
  getCurrentState,
  transitionToLoggedOut,
  needsTokenRefresh,
} from '../auth/state-machine';
import {
  handleInitiateOTP,
  handleVerifyOTP,
  handleResendOTP,
  handleRefreshToken,
  handleLogout,
  handleGetAuthState,
  handleFetchUserInfo,
} from '../auth/message-handlers';

// ============================================================================
// Constants
// ============================================================================

const TOKEN_REFRESH_ALARM = 'token-refresh';
const REFRESH_MARGIN_MINUTES = 5;

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

export default defineBackground(() => {
  console.log('[Background] Auth0 Passwordless Extension initialized');

  // Initialize state machine on service worker start
  void initializeStateMachine().then(async (state) => {
    console.log('[Background] State machine initialized:', state.flowState);

    // Schedule token refresh if authenticated
    if (state.isAuthenticated && state.expiresAt) {
      await scheduleTokenRefresh(state.expiresAt);
    }
  });

  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up alarm listener for token refresh
  chrome.alarms.onAlarm.addListener((alarm) => {
    void handleAlarm(alarm);
  });

  // Handle service worker startup (browser restart)
  chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] Browser started, restoring session');
    void restoreSession();
  });
});

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle incoming messages from popup or content scripts.
 * Returns true to indicate async response.
 */
function handleMessage(
  request: AuthRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: AuthResponse) => void
): boolean {
  console.log('[Background] Received message:', request.type);

  void processMessage(request)
    .then(sendResponse)
    .catch((error: unknown) => {
      console.error('[Background] Message handling error:', error);
      sendResponse(
        errorResponse('NETWORK_ERROR', 'An unexpected error occurred')
      );
    });

  // Return true to indicate we will send a response asynchronously
  return true;
}

/**
 * Process a message and return the response.
 */
async function processMessage(
  request: AuthRequest
): Promise<AuthResponse> {
  switch (request.type) {
    case 'INITIATE_OTP':
      return handleInitiateOTP(request.payload.email);

    case 'VERIFY_OTP':
      return handleVerifyOTP(request.payload.email, request.payload.otp);

    case 'RESEND_OTP':
      return handleResendOTP(request.payload.email);

    case 'REFRESH_TOKEN':
      return handleRefreshToken();

    case 'LOGOUT':
      return handleLogout();

    case 'GET_AUTH_STATE':
      return handleGetAuthState();

    case 'FETCH_USER_INFO':
      return handleFetchUserInfo();

    default:
      // TypeScript exhaustive check - if this line errors, a case is missing
      return request satisfies never;
  }
}

// ============================================================================
// Alarm Handling
// ============================================================================

/**
 * Handle alarm events.
 */
async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  console.log('[Background] Alarm fired:', alarm.name);

  if (alarm.name === TOKEN_REFRESH_ALARM) {
    await performTokenRefresh();
  }
}

/**
 * Schedule a token refresh alarm.
 */
export async function scheduleTokenRefresh(expiresAt: number): Promise<void> {
  // Calculate when to refresh (5 minutes before expiry)
  const refreshTime = expiresAt - REFRESH_MARGIN_MINUTES * 60 * 1000;
  const delayMinutes = Math.max(1, (refreshTime - Date.now()) / 60000);

  console.log(
    `[Background] Scheduling token refresh in ${delayMinutes.toFixed(1)} minutes`
  );

  await chrome.alarms.create(TOKEN_REFRESH_ALARM, {
    delayInMinutes: delayMinutes,
  });
}

/**
 * Perform silent token refresh.
 */
async function performTokenRefresh(): Promise<void> {
  console.log('[Background] Performing token refresh');

  const result = await handleRefreshToken();

  if (result.success) {
    console.log('[Background] Token refresh successful');
    const state = await getCurrentState();
    if (state.expiresAt) {
      await scheduleTokenRefresh(state.expiresAt);
    }
  } else {
    console.log('[Background] Token refresh failed:', result.error.message);
    await transitionToLoggedOut('failed');
    await chrome.alarms.clear(TOKEN_REFRESH_ALARM);
  }
}

// ============================================================================
// Session Restoration
// ============================================================================

/**
 * Restore session on browser startup.
 */
async function restoreSession(): Promise<void> {
  const state = await initializeStateMachine();

  if (state.isAuthenticated) {
    // Check if we need to refresh tokens
    if (await needsTokenRefresh()) {
      await performTokenRefresh();
    } else if (state.expiresAt) {
      await scheduleTokenRefresh(state.expiresAt);
    }
  }
}
