/**
 * AuthError Class
 *
 * Standardized error class for authentication operations.
 * Provides error codes for programmatic handling and
 * user-friendly messages for display.
 */

import type { AuthErrorCode, Auth0ErrorResponse } from '../auth/types';

/**
 * User-friendly error messages for each error code.
 */
const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_EMAIL:
    'Please enter a valid email address.',
  INVALID_OTP:
    'The code you entered is incorrect. Please check and try again.',
  OTP_EXPIRED:
    'This code has expired. Please request a new code.',
  RATE_LIMITED:
    'Too many requests. Please wait a few minutes before trying again.',
  NETWORK_ERROR:
    'Unable to connect. Please check your internet connection.',
  AUTH0_UNAVAILABLE:
    'Authentication service is temporarily unavailable. Please try again later.',
  SESSION_EXPIRED:
    'Your session has expired. Please log in again.',
  REFRESH_FAILED:
    'Unable to refresh your session. Please log in again.',
  STORAGE_ERROR:
    'Unable to save authentication data. Please try again.',
  NOT_AUTHENTICATED:
    'You are not logged in. Please log in to continue.',
  VALIDATION_ERROR:
    'Authentication failed. Please check your configuration or try again later.',
  EMAIL_DOMAIN_NOT_ALLOWED:
    'This email domain is not allowed. Please use an authorized email address or contact your administrator.',
};

/**
 * Custom error class for authentication errors.
 */
export class AuthError extends Error {
  /** Error code for programmatic handling */
  readonly code: AuthErrorCode;

  /** Original error if this is a wrapped error */
  readonly cause?: Error;

  constructor(code: AuthErrorCode, message?: string, cause?: Error) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AuthError';
    this.code = code;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments (Chrome extension)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, AuthError);
    }
  }

  /**
   * Get the user-friendly message for this error.
   */
  get userMessage(): string {
    return ERROR_MESSAGES[this.code];
  }

  /**
   * Create an AuthError from an Auth0 API error response.
   * Uses our user-friendly message instead of Auth0's error_description.
   */
  static fromAuth0Error(error: Auth0ErrorResponse): AuthError {
    // Auth0 can return error details in either error_description or message field
    const errorDetail = error.error_description ?? error.message ?? '';
    const code = mapAuth0ErrorToCode(error.error, errorDetail);
    // Log full error object for debugging
    console.log('[AuthError] Auth0 error response:', JSON.stringify(error));
    console.log(`[AuthError] Mapped: error="${error.error}", detail="${errorDetail}" -> code="${code}"`);
    return new AuthError(code);
  }

  /**
   * Create an AuthError from an unknown error.
   */
  static fromUnknown(error: unknown, defaultCode: AuthErrorCode = 'NETWORK_ERROR'): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof Error) {
      return new AuthError(defaultCode, error.message, error);
    }

    return new AuthError(defaultCode, String(error));
  }

  /**
   * Check if an error is an AuthError with a specific code.
   */
  static isCode(error: unknown, code: AuthErrorCode): boolean {
    return error instanceof AuthError && error.code === code;
  }

  /**
   * Convert to a plain object for serialization (e.g., message passing).
   */
  toJSON(): { code: AuthErrorCode; message: string } {
    return {
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Map Auth0 error codes to our AuthErrorCode enum.
 * Checks both the error code and error_description/message for known patterns.
 */
function mapAuth0ErrorToCode(auth0Error: string, errorDetail?: string): AuthErrorCode {
  const errorLower = auth0Error.toLowerCase();
  const detailLower = errorDetail?.toLowerCase() ?? '';

  // Check for email domain errors in either field
  if (
    errorLower.includes('unauthorized_email_domain') ||
    errorLower.includes('email_domain') ||
    detailLower.includes('unauthorized_email_domain') ||
    detailLower.includes('email domain') ||
    detailLower.includes('domain is not allowed') ||
    detailLower.includes('email address is not allowed')
  ) {
    return 'EMAIL_DOMAIN_NOT_ALLOWED';
  }

  switch (auth0Error) {
    case 'invalid_request':
      return 'INVALID_EMAIL';
    case 'invalid_grant':
      return 'INVALID_OTP';
    case 'access_denied':
      // Check if it's specifically about email domain
      if (detailLower.includes('domain')) {
        return 'EMAIL_DOMAIN_NOT_ALLOWED';
      }
      return 'INVALID_OTP';
    case 'unauthorized_client':
      return 'VALIDATION_ERROR';
    case 'too_many_requests':
      return 'RATE_LIMITED';
    case 'server_error':
      return 'AUTH0_UNAVAILABLE';
    default:
      // For unknown errors, return a generic validation error rather than network error
      // since we did get a response from Auth0
      return 'VALIDATION_ERROR';
  }
}

/**
 * Type guard to check if an error is an AuthError.
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Wrap an async function to convert all errors to AuthError.
 */
export function withAuthError<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  defaultCode: AuthErrorCode = 'NETWORK_ERROR'
): T {
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      const result = await fn(...args);
      // eslint-disable-next-line @typescript-eslint/return-await
      return result as ReturnType<T>;
    } catch (error) {
      throw AuthError.fromUnknown(error, defaultCode);
    }
  };
  return wrapped as T;
}
