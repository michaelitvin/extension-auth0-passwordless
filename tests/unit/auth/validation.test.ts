import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateOTP,
  normalizeEmail,
  normalizeOTP,
} from '../../../src/auth/validation';

describe('Validation Helpers', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('user.name@example.com')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user@subdomain.example.com')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(validateEmail('notanemail')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@example')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('  ')).toBe(false);
    });

    it('rejects null and undefined', () => {
      expect(validateEmail(null as unknown as string)).toBe(false);
      expect(validateEmail(undefined as unknown as string)).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(validateEmail('  user@example.com  ')).toBe(true);
    });

    it('rejects very long email addresses', () => {
      const longEmail = 'a'.repeat(300) + '@example.com';
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe('validateOTP', () => {
    it('accepts valid 6-digit OTP codes', () => {
      expect(validateOTP('123456')).toBe(true);
      expect(validateOTP('000000')).toBe(true);
      expect(validateOTP('999999')).toBe(true);
    });

    it('rejects invalid OTP codes', () => {
      expect(validateOTP('12345')).toBe(false); // Too short
      expect(validateOTP('1234567')).toBe(false); // Too long
      expect(validateOTP('abcdef')).toBe(false); // Not digits
      expect(validateOTP('12345a')).toBe(false); // Mixed
      expect(validateOTP('')).toBe(false);
    });

    it('rejects null and undefined', () => {
      expect(validateOTP(null as unknown as string)).toBe(false);
      expect(validateOTP(undefined as unknown as string)).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(validateOTP('  123456  ')).toBe(true);
    });
  });

  describe('normalizeEmail', () => {
    it('trims whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('converts to lowercase', () => {
      expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    });

    it('handles already normalized email', () => {
      expect(normalizeEmail('user@example.com')).toBe('user@example.com');
    });
  });

  describe('normalizeOTP', () => {
    it('trims whitespace', () => {
      expect(normalizeOTP('  123456  ')).toBe('123456');
    });

    it('removes non-digit characters', () => {
      expect(normalizeOTP('12-34-56')).toBe('123456');
      expect(normalizeOTP('1 2 3 4 5 6')).toBe('123456');
    });

    it('handles already normalized OTP', () => {
      expect(normalizeOTP('123456')).toBe('123456');
    });
  });
});
