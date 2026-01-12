import { describe, it, expect } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  base64UrlEncode,
  base64UrlDecode,
  generatePKCEPair,
} from '../../../src/auth/pkce';

describe('PKCE Helpers', () => {
  describe('generateCodeVerifier', () => {
    it('generates a string of expected length', () => {
      const verifier = generateCodeVerifier();
      // Base64url encoding of 32 bytes = ~43 characters
      expect(verifier.length).toBeGreaterThanOrEqual(40);
      expect(verifier.length).toBeLessThanOrEqual(50);
    });

    it('generates URL-safe characters only', () => {
      const verifier = generateCodeVerifier();
      // Should only contain base64url characters (no +, /, or =)
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates unique values each time', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('generates a consistent challenge for the same verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('generates different challenges for different verifiers', async () => {
      const challenge1 = await generateCodeChallenge('verifier-1');
      const challenge2 = await generateCodeChallenge('verifier-2');
      expect(challenge1).not.toBe(challenge2);
    });

    it('generates URL-safe output', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      // Should only contain base64url characters
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates challenge of correct length for SHA-256', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      // SHA-256 produces 32 bytes, base64url encoded = 43 characters
      expect(challenge.length).toBe(43);
    });
  });

  describe('base64UrlEncode', () => {
    it('encodes bytes to URL-safe base64', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).toBe('SGVsbG8');
    });

    it('removes padding', () => {
      const bytes = new Uint8Array([1, 2]);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('=');
    });

    it('replaces + with - and / with _', () => {
      // Test data that would produce + and / in standard base64
      const bytes = new Uint8Array([251, 255, 254]);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
    });
  });

  describe('base64UrlDecode', () => {
    it('decodes URL-safe base64 to bytes', () => {
      const decoded = base64UrlDecode('SGVsbG8');
      expect(Array.from(decoded)).toEqual([72, 101, 108, 108, 111]);
    });

    it('handles input without padding', () => {
      const decoded = base64UrlDecode('SGVsbG8');
      expect(decoded.length).toBe(5);
    });

    it('round-trips with base64UrlEncode', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const encoded = base64UrlEncode(original);
      const decoded = base64UrlDecode(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });
  });

  describe('generatePKCEPair', () => {
    it('generates both verifier and challenge', async () => {
      const pair = await generatePKCEPair();
      expect(pair).toHaveProperty('codeVerifier');
      expect(pair).toHaveProperty('codeChallenge');
    });

    it('generates matching verifier and challenge', async () => {
      const pair = await generatePKCEPair();
      const expectedChallenge = await generateCodeChallenge(pair.codeVerifier);
      expect(pair.codeChallenge).toBe(expectedChallenge);
    });
  });
});
