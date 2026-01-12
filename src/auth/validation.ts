/**
 * Input Validation
 *
 * Simple validation helpers for user inputs.
 */

/**
 * Validate email format using a simple regex.
 * Matches most common email formats.
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = email.trim();

  if (trimmed.length === 0 || trimmed.length > 254) {
    return false;
  }

  // Simple email regex - not too strict to avoid false negatives
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate OTP code format.
 * Auth0 passwordless codes are typically 6 digits.
 */
export function validateOTP(otp: string): boolean {
  if (!otp || typeof otp !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = otp.trim();

  // Auth0 OTP codes are typically 6 digits
  const otpRegex = /^\d{6}$/;
  return otpRegex.test(trimmed);
}

/**
 * Normalize email address.
 * - Trims whitespace
 * - Converts to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize OTP code.
 * - Trims whitespace
 * - Removes any non-digit characters
 */
export function normalizeOTP(otp: string): string {
  return otp.trim().replace(/\D/g, '');
}
