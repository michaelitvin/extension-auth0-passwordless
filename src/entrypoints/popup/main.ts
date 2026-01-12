/**
 * Popup Main Entry Point
 *
 * Handles the popup UI for the Auth0 Passwordless extension.
 * Acts as a "dumb view" - all state management happens in the service worker.
 */

import './styles.css';
import type {
  AuthStateResponseData,
  UserInfoResponseData,
} from '../../messages/types';
import { sendAuthMessage } from '../../messages/types';

// ============================================================================
// DOM Elements
// ============================================================================

/**
 * Get an element by ID, throwing if not found.
 */
function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element #${id} not found`);
  }
  return element;
}

const views = {
  loading: getElement('loading-view'),
  login: getElement('login-view'),
  otp: getElement('otp-view'),
  authenticated: getElement('authenticated-view'),
};

const elements = {
  // Login view
  emailForm: getElement('email-form') as HTMLFormElement,
  emailInput: getElement('email-input') as HTMLInputElement,
  emailSubmit: getElement('email-submit') as HTMLButtonElement,
  loginError: getElement('login-error'),

  // OTP view
  otpForm: getElement('otp-form') as HTMLFormElement,
  otpInput: getElement('otp-input') as HTMLInputElement,
  otpSubmit: getElement('otp-submit') as HTMLButtonElement,
  otpEmail: getElement('otp-email'),
  otpError: getElement('otp-error'),
  otpSuccess: getElement('otp-success'),
  resendBtn: getElement('resend-btn') as HTMLButtonElement,
  backBtn: getElement('back-btn') as HTMLButtonElement,

  // Authenticated view
  avatarInitial: getElement('avatar-initial'),
  userName: getElement('user-name'),
  userEmail: getElement('user-email'),
  sessionExpiry: getElement('session-expiry'),
  testApiBtn: getElement('test-api-btn') as HTMLButtonElement,
  logoutBtn: getElement('logout-btn') as HTMLButtonElement,
  apiResult: getElement('api-result'),
  apiResponse: getElement('api-response'),
  authError: getElement('auth-error'),
};

// ============================================================================
// State
// ============================================================================

let currentEmail = '';

// ============================================================================
// View Management
// ============================================================================

function showView(viewName: keyof typeof views): void {
  Object.entries(views).forEach(([name, element]) => {
    if (name === viewName) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  });
}

function showError(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.classList.remove('hidden');
}

function hideError(element: HTMLElement): void {
  element.classList.add('hidden');
}

function showSuccess(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.classList.remove('hidden');
  setTimeout(() => {
    element.classList.add('hidden');
  }, 3000);
}

function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  button.disabled = loading;
  if (loading) {
    button.dataset['originalText'] = button.textContent;
    button.textContent = 'Loading...';
  } else {
    button.textContent = button.dataset['originalText'] ?? '';
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  console.log('[Popup] Initializing...');

  try {
    const response = await sendAuthMessage<AuthStateResponseData>({
      type: 'GET_AUTH_STATE',
      payload: {},
    });

    if (response.success) {
      if (response.data.isAuthenticated) {
        await showAuthenticatedView(response.data);
      } else if (response.data.flowState === 'PENDING_OTP' && response.data.otpRequest) {
        // Restore OTP view if user closed popup while waiting for code
        currentEmail = response.data.otpRequest.email;
        elements.otpEmail.textContent = currentEmail;
        showView('otp');
        elements.otpInput.focus();
      } else {
        showView('login');
      }
    } else {
      console.error('[Popup] Failed to get auth state:', response.error);
      showView('login');
    }
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
    showView('login');
  }
}

// ============================================================================
// Login Flow
// ============================================================================

async function handleEmailSubmit(event: Event): Promise<void> {
  event.preventDefault();
  hideError(elements.loginError);

  const email = elements.emailInput.value.trim();
  if (!email) {
    showError(elements.loginError, 'Please enter your email address');
    return;
  }

  setButtonLoading(elements.emailSubmit, true);

  try {
    const response = await sendAuthMessage<{ email: string; expiresAt: number }>(
      {
        type: 'INITIATE_OTP',
        payload: { email },
      }
    );

    if (response.success) {
      currentEmail = email;
      elements.otpEmail.textContent = email;
      showView('otp');
      elements.otpInput.focus();
    } else {
      showError(elements.loginError, response.error.message);
    }
  } catch (error) {
    console.error('[Popup] Email submit error:', error);
    showError(elements.loginError, 'An unexpected error occurred');
  } finally {
    setButtonLoading(elements.emailSubmit, false);
  }
}

// ============================================================================
// OTP Verification Flow
// ============================================================================

async function handleOTPSubmit(event: Event): Promise<void> {
  event.preventDefault();
  hideError(elements.otpError);

  const otp = elements.otpInput.value.trim();
  if (!otp) {
    showError(elements.otpError, 'Please enter the verification code');
    return;
  }

  setButtonLoading(elements.otpSubmit, true);

  try {
    const response = await sendAuthMessage<{ email: string; expiresAt: number }>(
      {
        type: 'VERIFY_OTP',
        payload: { email: currentEmail, otp },
      }
    );

    if (response.success) {
      // Fetch auth state to show authenticated view
      const authStateResponse = await sendAuthMessage<AuthStateResponseData>({
        type: 'GET_AUTH_STATE',
        payload: {},
      });

      if (authStateResponse.success && authStateResponse.data.isAuthenticated) {
        await showAuthenticatedView(authStateResponse.data);
      } else {
        showError(elements.otpError, 'Authentication failed');
      }
    } else {
      showError(elements.otpError, response.error.message);
    }
  } catch (error) {
    console.error('[Popup] OTP submit error:', error);
    showError(elements.otpError, 'An unexpected error occurred');
  } finally {
    setButtonLoading(elements.otpSubmit, false);
  }
}

async function handleResendOTP(): Promise<void> {
  hideError(elements.otpError);
  setButtonLoading(elements.resendBtn, true);

  try {
    const response = await sendAuthMessage<{
      email: string;
      expiresAt: number;
      remainingAttempts: number;
    }>({
      type: 'RESEND_OTP',
      payload: { email: currentEmail },
    });

    if (response.success) {
      showSuccess(
        elements.otpSuccess,
        `Code sent! ${String(response.data.remainingAttempts)} attempts remaining.`
      );
      elements.otpInput.value = '';
      elements.otpInput.focus();
    } else {
      showError(elements.otpError, response.error.message);
    }
  } catch (error) {
    console.error('[Popup] Resend OTP error:', error);
    showError(elements.otpError, 'An unexpected error occurred');
  } finally {
    setButtonLoading(elements.resendBtn, false);
  }
}

function handleBackToLogin(): void {
  currentEmail = '';
  elements.otpInput.value = '';
  hideError(elements.otpError);
  showView('login');
}

// ============================================================================
// Authenticated View
// ============================================================================

async function showAuthenticatedView(
  authState: AuthStateResponseData
): Promise<void> {
  // Set basic info from auth state
  const email = authState.email ?? 'Unknown';
  elements.userEmail.textContent = email;
  elements.avatarInitial.textContent = email.charAt(0).toUpperCase();
  elements.userName.textContent = email.split('@')[0] ?? 'User';

  // Calculate session expiry
  if (authState.sessionAge !== undefined) {
    const daysRemaining = Math.max(
      0,
      7 - Math.floor(authState.sessionAge / 86400)
    );
    elements.sessionExpiry.textContent = `${String(daysRemaining)} days`;
  } else {
    elements.sessionExpiry.textContent = 'Unknown';
  }

  // Hide API result
  elements.apiResult.classList.add('hidden');
  hideError(elements.authError);

  showView('authenticated');

  // Try to fetch user info for better display
  try {
    const userInfoResponse = await sendAuthMessage<UserInfoResponseData>({
      type: 'FETCH_USER_INFO',
      payload: {},
    });

    if (userInfoResponse.success) {
      const userInfo = userInfoResponse.data;
      if (userInfo.name) {
        elements.userName.textContent = userInfo.name;
      }
      if (userInfo.picture) {
        const avatar = document.getElementById('user-avatar');
        if (avatar) {
          avatar.innerHTML = `<img src="${userInfo.picture}" alt="Avatar" />`;
        }
      }
    }
  } catch (error) {
    console.log('[Popup] Could not fetch user info:', error);
  }
}

async function handleTestAPI(): Promise<void> {
  hideError(elements.authError);
  setButtonLoading(elements.testApiBtn, true);

  try {
    const response = await sendAuthMessage<UserInfoResponseData>({
      type: 'FETCH_USER_INFO',
      payload: {},
    });

    if (response.success) {
      elements.apiResponse.textContent = JSON.stringify(response.data, null, 2);
      elements.apiResult.classList.remove('hidden');
    } else {
      showError(elements.authError, response.error.message);
    }
  } catch (error) {
    console.error('[Popup] Test API error:', error);
    showError(elements.authError, 'An unexpected error occurred');
  } finally {
    setButtonLoading(elements.testApiBtn, false);
  }
}

async function handleLogout(): Promise<void> {
  setButtonLoading(elements.logoutBtn, true);

  try {
    const response = await sendAuthMessage<{ success: boolean }>({
      type: 'LOGOUT',
      payload: {},
    });

    if (response.success) {
      currentEmail = '';
      elements.emailInput.value = '';
      showView('login');
    } else {
      showError(elements.authError, response.error.message);
    }
  } catch (error) {
    console.error('[Popup] Logout error:', error);
    showError(elements.authError, 'An unexpected error occurred');
  } finally {
    setButtonLoading(elements.logoutBtn, false);
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

elements.emailForm.addEventListener('submit', (e) => void handleEmailSubmit(e));
elements.otpForm.addEventListener('submit', (e) => void handleOTPSubmit(e));
elements.resendBtn.addEventListener('click', () => void handleResendOTP());
elements.backBtn.addEventListener('click', handleBackToLogin);
elements.testApiBtn.addEventListener('click', () => void handleTestAPI());
elements.logoutBtn.addEventListener('click', () => void handleLogout());

// ============================================================================
// Storage Event Sync (T048)
// ============================================================================

/**
 * Listen for storage changes to sync state across multiple popup instances.
 * If auth state changes (e.g., logout in another window), update this popup.
 */
function setupStorageSync(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    // Only care about session storage changes affecting auth state
    if (areaName === 'session') {
      const authChanged = 'auth' in changes;
      const flowStateChanged = 'flowState' in changes;

      if (authChanged || flowStateChanged) {
        console.log('[Popup] Storage changed, refreshing state...');

        // If auth was cleared (logout), show login view
        if (authChanged && !changes['auth']?.newValue) {
          currentEmail = '';
          elements.emailInput.value = '';
          showView('login');
          return;
        }

        // If flow state changed, reinitialize to get correct view
        if (flowStateChanged) {
          void initialize();
        }
      }
    }

    // Also watch local storage for session expiry
    if (areaName === 'local') {
      const sessionMetaChange = changes['sessionMeta'];
      // If session meta was cleared (logout or expiry), show login
      if (sessionMetaChange && !sessionMetaChange.newValue) {
        currentEmail = '';
        elements.emailInput.value = '';
        showView('login');
      }
    }
  });
}

// Initialize storage sync
setupStorageSync();

// Initialize on load
void initialize();
