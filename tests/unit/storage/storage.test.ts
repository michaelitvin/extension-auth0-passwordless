import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Storage Layer Unit Tests
 *
 * Tests the storage facade and utility functions.
 * Chrome storage APIs are mocked since they're not available in Node.js.
 */

// Mock chrome.storage APIs
let mockSessionStorage: Record<string, unknown> = {};
let mockLocalStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  session: {
    get: vi.fn((key: string) => Promise.resolve({ [key]: mockSessionStorage[key] })),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockSessionStorage, items);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      mockSessionStorage = Object.fromEntries(
        Object.entries(mockSessionStorage).filter(([k]) => k !== key)
      );
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      mockSessionStorage = {};
      return Promise.resolve();
    }),
  },
  local: {
    get: vi.fn((key: string) => Promise.resolve({ [key]: mockLocalStorage[key] })),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockLocalStorage, items);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      mockLocalStorage = Object.fromEntries(
        Object.entries(mockLocalStorage).filter(([k]) => k !== key)
      );
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      mockLocalStorage = {};
      return Promise.resolve();
    }),
  },
};

// Mock chrome.runtime.id for encryption key derivation
const mockChromeRuntime = {
  id: 'test-extension-id-12345',
};

// Set up global chrome mock
vi.stubGlobal('chrome', {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
});

// Import after mocking
import {
  isSessionExpired,
  isAccessTokenExpired,
  isSessionValid,
} from '../../../src/storage/index';

describe('Storage Layer', () => {
  beforeEach(() => {
    // Clear mocked storages
    mockSessionStorage = {};
    mockLocalStorage = {};
    vi.clearAllMocks();
  });

  describe('isSessionExpired', () => {
    it('returns true when no session meta exists', async () => {
      const expired = await isSessionExpired();
      expect(expired).toBe(true);
    });

    it('returns false for session created now', async () => {
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now(),
        email: 'test@example.com',
      };

      const expired = await isSessionExpired();
      expect(expired).toBe(false);
    });

    it('returns true for session older than 7 days', async () => {
      const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now() - EIGHT_DAYS_MS,
        email: 'test@example.com',
      };

      const expired = await isSessionExpired();
      expect(expired).toBe(true);
    });

    it('returns false for session exactly 6 days old', async () => {
      const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now() - SIX_DAYS_MS,
        email: 'test@example.com',
      };

      const expired = await isSessionExpired();
      expect(expired).toBe(false);
    });
  });

  describe('isAccessTokenExpired', () => {
    it('returns true when no auth state exists', async () => {
      const expired = await isAccessTokenExpired();
      expect(expired).toBe(true);
    });

    it('returns false for token expiring in 10 minutes', async () => {
      const TEN_MINUTES_MS = 10 * 60 * 1000;
      mockSessionStorage['auth'] = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        email: 'test@example.com',
        expiresAt: Date.now() + TEN_MINUTES_MS,
      };

      const expired = await isAccessTokenExpired();
      expect(expired).toBe(false);
    });

    it('returns true for token expiring in 3 minutes (within 5-minute buffer)', async () => {
      const THREE_MINUTES_MS = 3 * 60 * 1000;
      mockSessionStorage['auth'] = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        email: 'test@example.com',
        expiresAt: Date.now() + THREE_MINUTES_MS,
      };

      const expired = await isAccessTokenExpired();
      expect(expired).toBe(true);
    });

    it('returns true for already expired token', async () => {
      mockSessionStorage['auth'] = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        email: 'test@example.com',
        expiresAt: Date.now() - 1000,
      };

      const expired = await isAccessTokenExpired();
      expect(expired).toBe(true);
    });
  });

  describe('isSessionValid', () => {
    it('returns false when no auth state exists', async () => {
      mockLocalStorage['encryptedRefreshToken'] = 'encrypted';
      mockLocalStorage['refreshTokenIV'] = 'iv';
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now(),
        email: 'test@example.com',
      };

      const valid = await isSessionValid();
      expect(valid).toBe(false);
    });

    it('returns false when no refresh token exists', async () => {
      mockSessionStorage['auth'] = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000,
      };
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now(),
        email: 'test@example.com',
      };

      const valid = await isSessionValid();
      expect(valid).toBe(false);
    });

    it('returns false when session is expired', async () => {
      const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
      mockSessionStorage['auth'] = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        email: 'test@example.com',
        expiresAt: Date.now() + 3600000,
      };
      mockLocalStorage['encryptedRefreshToken'] = 'encrypted';
      mockLocalStorage['refreshTokenIV'] = 'iv';
      mockLocalStorage['sessionMeta'] = {
        createdAt: Date.now() - EIGHT_DAYS_MS,
        email: 'test@example.com',
      };

      const valid = await isSessionValid();
      expect(valid).toBe(false);
    });
  });

  describe('Session storage mock interactions', () => {
    it('calls chrome.storage.session.get correctly', async () => {
      await isAccessTokenExpired();
      expect(mockChromeStorage.session.get).toHaveBeenCalledWith('auth');
    });

    it('calls chrome.storage.local.get correctly for session meta', async () => {
      await isSessionExpired();
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('sessionMeta');
    });
  });
});

describe('Storage Constants', () => {
  it('uses 7 days for session expiry', async () => {
    // Session created 6.9 days ago should be valid
    const ALMOST_SEVEN_DAYS_MS = 6.9 * 24 * 60 * 60 * 1000;
    mockLocalStorage['sessionMeta'] = {
      createdAt: Date.now() - ALMOST_SEVEN_DAYS_MS,
      email: 'test@example.com',
    };

    const expired = await isSessionExpired();
    expect(expired).toBe(false);

    // Session created 7.1 days ago should be expired
    const OVER_SEVEN_DAYS_MS = 7.1 * 24 * 60 * 60 * 1000;
    mockLocalStorage['sessionMeta'] = {
      createdAt: Date.now() - OVER_SEVEN_DAYS_MS,
      email: 'test@example.com',
    };

    const expiredNow = await isSessionExpired();
    expect(expiredNow).toBe(true);
  });

  it('uses 5-minute buffer for access token expiry', async () => {
    // Token expiring in 5.1 minutes should NOT be expired
    const FIVE_POINT_ONE_MINUTES_MS = 5.1 * 60 * 1000;
    mockSessionStorage['auth'] = {
      accessToken: 'test-access-token',
      idToken: 'test-id-token',
      email: 'test@example.com',
      expiresAt: Date.now() + FIVE_POINT_ONE_MINUTES_MS,
    };

    const notExpired = await isAccessTokenExpired();
    expect(notExpired).toBe(false);

    // Token expiring in 4.9 minutes should be expired (within 5-min buffer)
    const FOUR_POINT_NINE_MINUTES_MS = 4.9 * 60 * 1000;
    mockSessionStorage['auth'] = {
      accessToken: 'test-access-token',
      idToken: 'test-id-token',
      email: 'test@example.com',
      expiresAt: Date.now() + FOUR_POINT_NINE_MINUTES_MS,
    };

    const expired = await isAccessTokenExpired();
    expect(expired).toBe(true);
  });
});
