# market-data Specification

## Purpose

Fetches B3 company, price and dividend data from InvestingData with the user's key, within that key's rate limits, and keeps it cached on the device so screens load instantly and work offline.

## Requirements

### Requirement: Authenticated requests
Every request to InvestingData SHALL carry the stored key in the `x-api-key` header, and SHALL go to the v1 API.

#### Scenario: Header sent
- **WHEN** the app requests `GET /v1/tickers/PETR4/price` with key `idk_abc`
- **THEN** the request carries the header `x-api-key: idk_abc`

### Requirement: Rate-limited request queue
All requests SHALL pass through one queue that sends no more than the key's per-minute limit, read from the usage endpoint, in any rolling minute. Requests SHALL be served in the order screens ask for them, visible rows first.

#### Scenario: Cold start within the limit
- **GIVEN** a key whose per-minute limit is 25
- **WHEN** a cold start needs the company index pages plus 15 price histories
- **THEN** no rolling 60-second window contains more than 25 requests

#### Scenario: Unknown limit
- **WHEN** the usage response has no per-minute limit
- **THEN** the queue uses a conservative default limit until a limit is known

### Requirement: Pause on 429
When a request returns 429, the queue SHALL pause all requests until the window's reset time, then resume. Cached data SHALL stay on screen while paused.

#### Scenario: Rate limited mid-load
- **WHEN** a request returns 429 with a reset time 20 seconds away
- **THEN** no request is sent for 20 seconds, the failed request is retried after the reset, and cached rows stay visible

### Requirement: Response validation
Responses SHALL be validated against expected shapes and mapped to domain models before any screen uses them. A response that fails validation SHALL be treated as an error, not shown.

#### Scenario: Malformed price bar
- **WHEN** a price history's bars are missing `close`
- **THEN** the request is reported as an error and no partial chart is drawn

#### Scenario: Long history in release builds
- **WHEN** a release build receives a 5,000-bar price history
- **THEN** it validates at least the first and last 50 bars; development builds validate every bar

### Requirement: Error mapping
Errors SHALL map by status: 401 sends the user to the key screen; 403 shows "Not included in your plan" in the affected block; 404 shows ticker not found; 429 waits for the reset; a network failure retries twice with backoff, then shows the screen's error state.

#### Scenario: Network failure
- **WHEN** a request fails with no network three times in a row
- **THEN** it was retried twice with increasing delay, and the screen shows its error state

#### Scenario: Plan excludes dividends
- **WHEN** the dividends request returns 403
- **THEN** the dividend yield stat shows "Not included in your plan" and the rest of the screen works

### Requirement: Company index
The app SHALL build a search index of B3 companies (names, tickers, logos, share counts) by paging the companies endpoint 100 at a time, and SHALL keep it for 7 days before refreshing it on launch.

#### Scenario: Index reused
- **WHEN** the app launches 3 days after the index was fetched
- **THEN** no companies request is made

### Requirement: Price history storage and freshness
Each ticker's full price history, in whatever mix of monthly and daily bars the API returns, SHALL be fetched in one request and stored on the device per ticker. It SHALL refetch on launch when older than 12 hours, and on pull to refresh unless fetched under 15 minutes ago. There SHALL be no timed polling and no refetch on screen focus.

#### Scenario: Relaunch the same day
- **WHEN** the app relaunches 2 hours after histories were fetched
- **THEN** stored histories render and no price request is made

#### Scenario: Pull to refresh too soon
- **WHEN** the user pulls to refresh 5 minutes after the last fetch
- **THEN** no price request is made

#### Scenario: Pull to refresh later
- **WHEN** the user pulls to refresh 20 minutes after the last fetch
- **THEN** the visible tickers' histories are refetched

### Requirement: Dividend and company caching
Dividends per ticker and company records SHALL be cached on the device for 7 days and not refetched before then.

#### Scenario: Reopening details
- **WHEN** the user opens a stock's details twice within 7 days
- **THEN** the dividends request is made only the first time

### Requirement: Offline use
With no network, the app SHALL show the most recent cached data with its session date, and SHALL not clear cached data on a failed request.

#### Scenario: Launch offline
- **WHEN** the app launches offline with cached histories
- **THEN** the list shows the cached rows and their session date
