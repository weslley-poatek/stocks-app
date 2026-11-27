# Tasks

## Agents

- `developer`: Build. Tasks 1.1–1.3, 1.5–8.3, plus writing 1.4's fixtures from the scout's findings. Its description covers building, implementing and fixing changes in this repo.
- `scout`: Research. Task 1.4's shape check against InvestingData's OpenAPI document. Its description covers cited research from local files and public sources, and it never edits (judgment).
- `reviewer`: Review. The review step's base reviewer.

## 1. Try it and look

- [x] 1.1 Scaffold the app with `create-expo-app` on the current stable Expo SDK: TypeScript `strict`, Expo Router with routes under `src/app/`, `expo-dev-client`, `eslint-config-expo`, Jest with `jest-expo`, and `ios/` and `android/` gitignored (design D1, D2). Add the `typecheck`, `lint` and `test` scripts. Verify that `npm run typecheck && npm run lint && npm test` pass, and that the app boots on an iOS simulator with `npx expo run:ios`.
- [x] 1.2 Fill in the Commands section of `AGENTS.md` with each script, what it does, and how to start the development build. Verify that each command runs as written. (`npm run android` moved to 8.1: this Mac had no Android emulator, and the person chose to check Android there.)
- [x] 1.3 Declare `npm run typecheck && npm run lint && npm test` as the quality gate in `.chassis/config.json`. Verify that `chassis-cli config validate` reports it valid.
- [x] 1.4 Confirm each endpoint's response shape against InvestingData's OpenAPI v1.0 document (D15): `/v1/usage`, `/v1/companies` (paged and `search`), `/v1/tickers/{symbol}`, `/v1/companies/{id}`, `/v1/tickers/{symbol}/price` and `/v1/tickers/{symbol}/dividends`, plus where 429's `resets_at` lives. Write one fixture per endpoint in `src/features/stocks/api/__fixtures__/`, and note any difference from the spec in design.md. Verify that a fixture exists for each endpoint and that each design.md note cites the document.
- [x] 1.5 Build the smallest working path, with no queue or persistence yet:
  - a plain key screen that saves the key to secure storage after `/v1/usage` succeeds;
  - a list that fetches `/price` for the starter tickers one at a time and shows ticker, last close and change %;
  - a details screen with the last close and a 1W line.

  Verify on the iOS simulator, with the person pasting their own key, that the list shows real closes and a tapped row shows its 1W line.
- [x] 1.6 Show it: share iOS simulator screenshots of the key screen, the list and a details screen, plus any surprises in the API's real responses. Verify that the screenshots are shared with the person.

## 2. Data layer: schemas, client, queue

- [x] 2.1 Write zod schemas and mappers for every endpoint into domain models (`KeyStatus`, `StockSummary`, `StockDetails`, company, dividends), with timestamps normalized to milliseconds (D7). Release builds sample the first and last 50 bars. Verify with unit tests against the fixtures: a malformed bar fails, both timestamp units map to the same date, and release sampling accepts a valid 5,000-bar history.
- [x] 2.2 Build the HTTP client with the `x-api-key` header and the typed errors from D5. Verify with unit tests (MSW) that 401, 403, 404, 429, a network failure and an invalid body each map to their error kind, and that the header is sent.
- [x] 2.3 Build the sliding-window queue in `api/queue.ts` (D4): the limit comes from `/v1/usage` (default 10 a minute), jobs are ordered by priority then arrival, and a 429 pauses the whole queue until `resets_at`. Verify with fake-timer tests:
  - 40 jobs at a 25-a-minute limit never put more than 25 in any 60-second window;
  - priority order holds;
  - a 429 pauses, then resumes and retries the job.
- [x] 2.4 Set up the QueryClient: retry only `network` errors, twice with exponential backoff, and no focus or interval refetch. Verify with tests that 4xx errors never retry and a network failure makes exactly 3 attempts.
- [x] 2.5 Make development logs readable outside the app: the `[diag]` lines from 1.5 never reached Metro's output. Then record, in design.md's Risks, PETR4's bar count, timestamp unit, sort order, and how many bars have `adjusted` different from `close`. Also find out why B3SA3 showed `n/a` on the real API. Verify that the log lines are captured in a file outside the app, and that the design.md note and the B3SA3 cause are recorded.

## 3. Derived metrics, formatting and theme

- [x] 3.1 Add quote, change, change %, session date and sparkline to `derive.ts`. Verify with unit tests for the stock-metrics scenarios "Up day", "Single bar" and "Down week".
- [x] 3.2 Add range slices for 1W–ALL (YTD from the last bar's calendar year) and the 5Y/ALL downsampling (D11). Verify with unit tests for "One month", "Range longer than history", "Five years" and "Twenty years" (at most 500 points, last point equal to the last close).
- [x] 3.3 Add session stats, average volume over the last 30 daily bars (a daily bar is at most 5 days after the bar before it), 52W high and low over the bars dated within 365 days of the last bar, approximate market cap and trailing dividend yield, each absent when its inputs are missing (D16). Verify with unit tests for every scenario under those stock-metrics requirements, including "Monthly then daily history".
- [x] 3.4 Write `shared/format.ts` (D13), with the device locale from `expo-localization`. Verify with unit tests: "R$ 37,85" in pt-BR, "+1.20%" in en-US, compact market caps, and "25 Nov" short dates.
- [x] 3.5 Write `shared/theme.ts`: light and dark palettes, up and down colours, and the type scale (ticker 17 semibold, name 13, close 34 semibold). Verify with a unit test that pill text meets 4.5:1 contrast on its pill colour in both palettes.
- [x] 3.6 Make `toStockSummary` and `toStockDetails` in `api/mappers.ts` call `derive.ts` instead of computing stats inline, and use fractions for change % and dividend yield everywhere, with `formatPercent` doing the ×100. Verify that `mappers.ts` has no stat formulas of its own, and that the tests pass.

## 4. Caching and persistence

- [x] 4.1 Persist the `companies`, `company` and `dividends` queries to MMKV through the TanStack Query persister, with a dehydrate filter that leaves out `prices` (D6). Verify with a test that the persisted payload has no `prices` entries and no copy of the key.
- [x] 4.2 Build `history-store.ts`: one file per symbol with its fetch time. The `prices` query seeds from that file, goes stale after 12 h, and a pull to refresh only refetches when the last fetch is 15 minutes old or more. Verify with tests (file system mocked) for the market-data scenarios "Relaunch the same day", "Pull to refresh too soon" and "Pull to refresh later".
- [x] 4.3 Build the company index from `/v1/companies?country_code=BR&limit=100` pages, kept for 7 days. Verify with tests that every page is fetched once, and that no request is made at 3 days old.

## 5. API key screen

- [x] 5.1 Add the key gate in `src/app/_layout.tsx` (D3): the key is read once into a context, and protected routes send users with no key to `key.tsx`. On startup with a key, call `/v1/usage` once to set the queue's per-minute limit (the queue otherwise stays at its default of 10). Verify with RNTL tests that no key opens the key screen and a stored key opens the list.
- [x] 5.2 Complete the key screen:
  - a monospace field with paste, show/hide, and autocorrect and autocapitalize off;
  - Continue, with the checking, 401, 403 and offline states;
  - the sign-up link, opened in an in-app browser.

  Verify with RNTL + MSW tests for each api-key scenario: nothing is stored on any failure, and the stack is replaced on success.
- [x] 5.3 Add the saved-key view (prefix, plan, remaining today, Replace key, Remove key) and the "That key was rejected" path for a 401 from any request. Verify with tests for "Viewing a saved key", "Removing the key", "Replacing the key" and "Key revoked while browsing", and that no log line holds the full key.

## 6. Stock list and search

- [x] 6.1 Validate the starter tickers against the index, using `/v1/tickers/{symbol}` only for a missing one (D8). Order rows by volume as in D9, and let rows fill in as their histories arrive. Verify with tests for "Sorted by volume", "Delisted starter" and "First rows appear early", and that a cold start makes about 5 index requests plus 15 price requests and no starter lookups when the index has every starter.
- [x] 6.2 Build `StockRow`, `Sparkline` and `ChangePill` with the shared pill mode (% → R$ → market cap) and the row's one-element accessibility label. Verify with tests for "Falling stock", "Cycling", "Missing market cap" and the screen-reader label text.
- [x] 6.3 Build the list header: large "Stocks" title, session-date subtitle, key button, the iOS header search bar or a pinned Android field that collapses on scroll, and pull to refresh. Verify with tests for "Header after load" and "Refresh indicator", and on both simulators.
- [x] 6.4 Build search (D10): index search with a 300 ms debounce, server name fallback before the index loads, Cancel to restore the list, and keyboard dismissed on scroll. Verify with tests for "Ticker prefix", "Company name", "Name search on a cold start" and "Cancel".
- [x] 6.5 Add the list states: 8 skeleton rows, empty search echoing the query, an error banner with Retry over cached rows, and offline cached rows with the session date. Verify with tests for "Empty search", "Error with cache" and "Launch offline".
- [x] 6.6 Find out why the API's `image_url` logos don't load on the simulator (log one URL in development and check its status and content type), and fix the cause. Then show a shared `CompanyLogo` in each list row, with the ticker's first two letters in a circle when there's no logo or it fails to load. Verify with tests for "Company with a logo" and "No logo" (stock-list), and a simulator screenshot of the list showing logos.

## 7. Stock details

- [x] 7.1 Add the `/stock/[symbol]` route: header (logo when present, ticker, name), price block, an instant render from cached history, and a single dividends request. Verify with tests for "Price block", "No logo", "From the list" (only a dividends request) and "Back to list".
- [x] 7.2 Build `RangeSelector` (exposed as a tab list) and `PriceChart` (colour by direction, animated range changes, summary accessibility label). Verify with tests for "Switching range" (no request), "Down range" and "Chart label".
- [x] 7.3 Add scrubbing (D12): a cursor that follows the finger, the price block showing the scrubbed day, a haptic on each day change, and the latest close restored on release. Verify with a unit test of the touch-to-day mapping and a device check of "Scrubbing" and "Release" on the iOS simulator and the Android emulator.
- [x] 7.4 Build `StatsGrid` (hides values it can't derive, a dividend skeleton, the 403 "Not included in your plan") and the About section. Verify with tests for "No share count", "Dividends loading", "Plan excludes dividends" and "Full classification".
- [x] 7.5 Add the details states: Retry in the chart area, and not-found with a way back. Verify with tests for "Unknown symbol" and "Chart load failure".
- [x] 7.6 Use `CompanyLogo` in the details header too, with the same initials fallback. Verify with the updated "No logo" test (stock-details) and a simulator screenshot of PETR4's header.

## 8. Device acceptance check

- [x] 8.1 Run the spec's acceptance list on the iOS simulator and the Android emulator (2026-11-26: the person deferred Android to a follow-up change; VoiceOver and haptics need a physical device, since the iOS Simulator has neither, so record those as not verified) (first confirming that `npm run android` builds and boots, the command deferred from 1.2), in light and dark mode, with VoiceOver and TalkBack. Record each item with a screenshot or a note in `openspec/changes/build-stocks-app-v1/acceptance.md`. Verify that every acceptance item has a result.
- [x] 8.2 With the person's key, log request times during a cold start in a development build. Verify that no 60-second window goes over the key's per-minute limit, and record the log summary in `acceptance.md`.
- [x] 8.3 Run the quality gate. Verify that `npm run typecheck && npm run lint && npm test` pass.

## Workflow follow-up

- Review the change against its specs before archive.
- Commit, then archive the change once the review passes.
