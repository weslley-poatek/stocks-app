# stock-list Specification

## Purpose

The app's main screen: a scannable list of B3 stocks with prices, weekly sparklines and change pills, plus search to find any ticker, in the style of Apple Stocks.

## Requirements

### Requirement: List header
The list SHALL sit under a large "Stocks" title with the session date as subtitle (for example "At close, 25 Nov"), and a key button at the top right that opens the API key screen.

#### Scenario: Header after load
- **WHEN** the list has loaded histories whose last bar is 25 Nov
- **THEN** the header shows "Stocks" and "At close, 25 Nov"

### Requirement: Starter tickers
With no search text, the list SHALL show the 15 starter tickers PETR4, VALE3, ITUB4, BBDC4, BBAS3, ABEV3, WEGE3, B3SA3, ITSA4, BPAC11, SUZB3, PRIO3, RENT3, EQTL3, SBSP3, sorted by last-session volume, highest first. A starter ticker the API reports as not found SHALL be left out.

#### Scenario: Sorted by volume
- **WHEN** all 15 histories have loaded
- **THEN** the rows are ordered by the last bar's volume, highest first

#### Scenario: Delisted starter
- **WHEN** the ticker lookup for RENT3 returns 404
- **THEN** RENT3 is not shown and the other rows are

### Requirement: Progressive cold start
On a cold start the app SHALL load the company index first, then request starter histories in visible order. Rows SHALL fill in as each history arrives rather than waiting for all of them.

#### Scenario: First rows appear early
- **WHEN** 5 of 15 histories have arrived on a cold start
- **THEN** those 5 rows show prices and the rest show skeletons

### Requirement: Row content
Each row SHALL show the ticker over the company name (one line, truncated), a sparkline of the last 5 closes coloured green when up and red when down, and the last close over a change pill, green when change is 0 or more and red otherwise. Change SHALL carry a sign, not only a colour.

#### Scenario: Falling stock
- **WHEN** VALE3 closed down 0.8%
- **THEN** its pill is red and reads "−0,80%" in pt-BR

### Requirement: Row logo
Each row SHALL show the company logo to the left of the ticker. When the company has no logo, or the logo fails to load, the row SHALL show the ticker's first two letters in a circle of the same size, so rows stay aligned.

#### Scenario: Company with a logo
- **WHEN** PETR4's company has a logo that loads
- **THEN** the row shows the logo left of "PETR4"

#### Scenario: No logo
- **WHEN** a row's company has no logo, or its logo fails to load
- **THEN** the row shows the ticker's first two letters, such as "VA" for VALE3, in a circle the logo's size

### Requirement: Change pill modes
Tapping any change pill SHALL cycle every row's pill through % change, R$ change, and approximate market cap, then back to % change.

#### Scenario: Cycling
- **WHEN** the user taps a pill twice from the default
- **THEN** every row's pill shows approximate market cap

#### Scenario: Missing market cap
- **WHEN** a row has no market cap and the mode is market cap
- **THEN** that row's pill is empty-styled and the others show market cap

### Requirement: Search
The header SHALL contain a search field (the native header search bar on iOS, a pinned field on Android) that collapses on scroll. Search SHALL run on the device over the cached company index, matching ticker prefix or company-name substring, case- and accent-insensitive, 300 ms after the last keystroke. Results SHALL replace the list while the field has text.

#### Scenario: Ticker prefix
- **WHEN** the index is cached and the user types "PETR"
- **THEN** within 300 ms of the last keystroke, rows such as PETR3 and PETR4 are listed

#### Scenario: Company name
- **WHEN** the index is cached and the user types "petrobras"
- **THEN** Petrobras tickers are listed

### Requirement: Search before the index loads
Until the company index is cached, name queries SHALL fall back to the server's name search, and ticker-only queries SHALL wait for the index.

#### Scenario: Name search on a cold start
- **WHEN** the index is still loading and the user types "Vale"
- **THEN** results come from the server name search

### Requirement: Search dismissal
Cancel SHALL clear the query and restore the list. Scrolling SHALL dismiss the keyboard.

#### Scenario: Cancel
- **WHEN** the user taps Cancel with "PETR" typed
- **THEN** the field empties and the starter list returns

### Requirement: List navigation
Tapping a row SHALL open that stock's details.

#### Scenario: Opening a stock
- **WHEN** the user taps the PETR4 row
- **THEN** the details screen for PETR4 opens

### Requirement: Pull to refresh
Pulling the list down SHALL refresh the visible histories, following the freshness rules for price data.

#### Scenario: Refresh indicator
- **WHEN** the user pulls to refresh and a refetch is due
- **THEN** a refresh indicator shows until the visible histories have reloaded

### Requirement: List states
The list SHALL show 8 skeleton rows while loading; "No results for "xyz"" for an empty search, echoing the query; an inline banner with Retry on error while keeping cached rows; and, offline, cached rows with their session date.

#### Scenario: Empty search
- **WHEN** the user searches "zzzz" and nothing matches
- **THEN** the list shows: No results for "zzzz"

#### Scenario: Error with cache
- **WHEN** a refresh fails and cached rows exist
- **THEN** a banner with Retry shows above the cached rows

### Requirement: Light and dark appearance
The list, details and key screens SHALL follow the system light or dark appearance, with up and down colours that stay legible in both.

#### Scenario: Dark mode
- **WHEN** the device is in dark mode
- **THEN** every screen uses the dark palette, and green and red pills stay legible

### Requirement: List accessibility
Each row SHALL be one accessibility element read as ticker, name, price and signed change, for example "PETR4, Petrobras, R$ 37,85, up 1,2 percent". Text SHALL scale with the system font size.

#### Scenario: Screen reader
- **WHEN** VoiceOver or TalkBack focuses the PETR4 row
- **THEN** it reads one label with ticker, name, price and "up" or "down" with the percent
