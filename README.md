# Auth0 Passwordless Browser Extension

A reference implementation of Auth0 passwordless OTP authentication for Chromium browser extensions using Manifest V3.

## Overview

This extension demonstrates a complete, production-ready pattern for passwordless authentication in browser extensions. Users receive a 6-digit OTP code via email instead of managing passwords—reducing support burden and improving security.

## Features

- **Email-based OTP login** - No passwords to remember or steal
- **7-day persistent sessions** - Automatic expiry with silent background refresh
- **Secure token storage** - Access tokens in session storage, encrypted refresh tokens in local storage
- **Demo API integration** - "Test API" button shows authenticated requests to `/userinfo`
- **Cross-browser support** - Chrome, Edge, Brave, and Firefox builds

## Quick Start

```bash
# Install dependencies
npm install

# Generate extension key (for consistent extension ID)
npm run generate-key

# Configure Auth0 credentials
cp .env.example .env
# Edit .env with your Auth0 domain and client ID

# Start development
npm run dev
```

**Load in Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `.output/chrome-mv3`
4. Update Auth0 callback URLs with the displayed Extension ID

See [docs/SETUP.md](docs/SETUP.md) for detailed Auth0 configuration.

## Tech Stack

- **TypeScript 5.x** (strict mode)
- **WXT** (Vite-based extension framework)
- **Manifest V3** with service worker
- **Auth0** passwordless API
- **Vitest** for testing

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts      # Service worker
│   └── popup/             # Extension popup UI
├── auth/                  # Auth0 integration & state machine
├── storage/               # Chrome storage wrappers
└── utils/                 # Error handling
tests/                     # Unit & manual tests
docs/                      # Setup guide
specs/                     # Feature specifications
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run zip` | Create distributable zip |
| `npm test` | Run tests |
| `npm run lint` | Lint code |
| `npm run dev:firefox` | Firefox development build |

## Documentation

- [docs/SETUP.md](docs/SETUP.md) - Auth0 configuration & installation guide

## License

MIT
