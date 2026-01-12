/**
 * Auth0 Configuration Loader
 *
 * Loads Auth0 configuration from environment variables.
 * Environment variables are injected by Vite at build time.
 */

export interface Auth0Config {
  /** Auth0 tenant domain (e.g., "your-tenant.auth0.com") */
  domain: string;

  /** Auth0 application client ID */
  clientId: string;

  /** Optional API audience for access token */
  audience?: string;
}

/**
 * Default OAuth scopes for passwordless flow.
 * - openid: Required for OIDC
 * - profile: User's name and picture
 * - email: User's email address
 * - offline_access: Get refresh token for silent renewal
 */
export const DEFAULT_SCOPES = 'openid profile email offline_access';

/**
 * Auth0 passwordless connection type.
 */
export const PASSWORDLESS_CONNECTION = 'email';

/**
 * OTP delivery method.
 */
export const OTP_SEND_TYPE = 'code';

/**
 * Passwordless OTP grant type for token exchange.
 */
export const PASSWORDLESS_GRANT_TYPE =
  'http://auth0.com/oauth/grant-type/passwordless/otp';

/**
 * Refresh token grant type.
 */
export const REFRESH_TOKEN_GRANT_TYPE = 'refresh_token';

/**
 * Get the Auth0 configuration from environment variables.
 * Throws an error if required variables are not set.
 */
export function getAuth0Config(): Auth0Config {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

  if (!domain) {
    throw new Error(
      'VITE_AUTH0_DOMAIN is not set. Please configure .env file.'
    );
  }

  if (!clientId) {
    throw new Error(
      'VITE_AUTH0_CLIENT_ID is not set. Please configure .env file.'
    );
  }

  return {
    domain,
    clientId,
    audience,
  };
}

/**
 * Get the Auth0 base URL for API calls.
 */
export function getAuth0BaseUrl(domain: string): string {
  // Ensure domain doesn't have protocol prefix
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  return `https://${cleanDomain}`;
}

/**
 * Get the passwordless/start endpoint URL.
 */
export function getPasswordlessStartUrl(domain: string): string {
  return `${getAuth0BaseUrl(domain)}/passwordless/start`;
}

/**
 * Get the oauth/token endpoint URL.
 */
export function getTokenUrl(domain: string): string {
  return `${getAuth0BaseUrl(domain)}/oauth/token`;
}

/**
 * Get the userinfo endpoint URL.
 */
export function getUserInfoUrl(domain: string): string {
  return `${getAuth0BaseUrl(domain)}/userinfo`;
}
