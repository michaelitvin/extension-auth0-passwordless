import { defineConfig } from 'wxt';
import { config } from 'dotenv';

// Load .env file for config-time access
config();

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Auth0 Passwordless Demo',
    description: 'Reference implementation of Auth0 passwordless OTP login',
    permissions: ['storage', 'alarms', 'identity'],
    host_permissions: ['https://*.auth0.com/*'],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    // Extension key for consistent ID across builds (run: npm run generate-key)
    key: process.env.VITE_EXTENSION_KEY,
  },
});
