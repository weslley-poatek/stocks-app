# Proposal

## Why

**Rigor:** orchestrated. **Oversight:** milestone. **Delivery:** local.
**Branch:** `build-stocks-app-v1`.

The repo has a written v1 spec for a B3 stocks app (Stocks App — React Native Spec, 2026-11-26) but no code. This change builds that v1. It's an iOS and Android app where each user connects their own InvestingData API key, browses and searches B3 stocks, and opens one to see its end-of-day price, chart and key stats. Its look and interactions follow Apple Stocks.

## What Changes

- Scaffold an Expo (managed) + React Native app in strict TypeScript, with Expo Router on a native stack, and Jest + React Native Testing Library + MSW for tests. Add `package.json` scripts for typecheck, lint and test, so the project gets a quality gate.
- Add an **API key screen**. It runs on first launch, when the key is rejected, and from the list header. It checks the key with `GET /v1/usage`, stores it only in the device keychain, and links to the InvestingData dashboard for sign-up.
- Add a typed **InvestingData client**: an `x-api-key` header, zod-validated responses mapped to domain models, and a request queue sized to the key's per-minute limit that pauses on 429. Errors are mapped per status. Responses are cached with TanStack Query, persisted with MMKV, and each price history is stored as its own file.
- Add **on-device derivations** as pure, unit-tested functions: quote and change, session date, sparkline, range slices and downsampling, 52-week high and low, average volume, approximate market cap, trailing dividend yield, and timestamp-unit detection.
- Add the **stock list**: 15 blue-chip starter tickers sorted by last-session volume, rows with sparkline and change pill (tapping a pill cycles %, R$ and market cap), and on-device search over the cached company index, with a server fallback by name.
- Add **stock details**: price block, 1W–ALL range selector, scrubbable chart with haptics, a stats grid and an About section.
- Loading, empty, error and offline states on every screen; light and dark mode; VoiceOver and TalkBack labels; locale-aware BRL formatting.

Out of scope for v1, per the spec: watchlist editing, news, price alerts, accounts, portfolio tracking, multi-stock comparison, home-screen widgets, P/E, intraday (1D) data, and timed polling.

## Capabilities

### New Capabilities
- `api-key`: Connecting, checking, storing, replacing and removing the user's own InvestingData API key, and gating the app on it.
- `market-data`: Fetching B3 data from InvestingData: auth, rate limiting, error handling, response validation, caching, persistence and freshness rules.
- `stock-metrics`: Values derived on device from price, dividend and company data (quote, change, ranges, 52W, averages, market cap, dividend yield).
- `stock-list`: The main list of stocks, its rows, the change-pill modes, search, and its states.
- `stock-details`: The single-stock screen: price block, range selector, scrubbable chart, stats grid, About section, and its states.

### Modified Capabilities
- None (the project has no specs yet).

## Impact

- **New code:** everything under `src/` (`app/`, `features/stocks/`, `shared/`), plus Expo, TypeScript, Jest and ESLint config at the repo root.
- **Dependencies:** expo, react-native, expo-router, @tanstack/react-query (plus its persister), react-native-mmkv, expo-secure-store, expo-file-system, expo-web-browser, expo-haptics, expo-localization, expo-dev-client, expo-image (SVG logos), expo-clipboard, @tanstack/react-query-persist-client, @tanstack/query-sync-storage-persister, zod, @shopify/flash-list, victory-native with @shopify/react-native-skia; dev: jest, jest-expo, @testing-library/react-native, msw, typescript, eslint.
- **External API:** InvestingData v1 (`/v1/usage`, `/v1/companies`, `/v1/tickers/{symbol}`, `/v1/tickers/{symbol}/price`, `/v1/tickers/{symbol}/dividends`), called with each user's own key, under that key's plan limits.
- **Native modules:** react-native-mmkv isn't bundled in Expo Go, so the app runs as an Expo development build (`expo-dev-client`), still with no hand-edited native projects (see design.md).
- **Project docs:** `AGENTS.md` gets its Commands section filled in once the scripts exist.
