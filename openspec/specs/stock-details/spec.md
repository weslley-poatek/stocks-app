# stock-details Specification

## Purpose

Shows one stock's move over time: its last close and change, a scrubbable chart over selectable ranges, key stats and company details, rendered instantly from cached history.

## Requirements

### Requirement: Details route
The details screen SHALL open at `/stock/[symbol]` as a pushed screen on the native stack, with a back action to the list.

#### Scenario: Back to list
- **WHEN** the user opens PETR4 and goes back
- **THEN** the list is shown at the same scroll position

### Requirement: Header and price block
The screen SHALL show the company logo, or the ticker's first two letters in a circle when there is no logo or it fails to load, the ticker large and bold, and the company name; then the last close, change and change % against the previous close in green or red, and "At close, <date>".

#### Scenario: Price block
- **WHEN** PETR4 closed at 37,85, up 0,45 (1,20%) on 25 Nov
- **THEN** it shows "R$ 37,85", "+R$ 0,45 (+1,20%)" in green, and "At close, 25 Nov" in pt-BR

#### Scenario: No logo
- **WHEN** the company has no logo, or its logo fails to load
- **THEN** the header shows "PE" in a circle in place of the logo for PETR4, with no empty image space

### Requirement: Instant render from cache
When the stock's history is cached, the header, price block, chart and price stats SHALL render without waiting for any request. Opening details SHALL make at most one request, for dividends, when they are not cached.

#### Scenario: From the list
- **WHEN** the user opens a stock whose history the list already loaded
- **THEN** close, change and the 1W chart show on the first frame, and only a dividends request is made

### Requirement: Range selector
A segmented control SHALL offer 1W, 1M, 3M, 6M, YTD, 1Y, 5Y and ALL, defaulting to 1W. Switching range SHALL redraw from the cached history with no network request, animating the line between ranges.

#### Scenario: Switching range
- **WHEN** the user switches from 1W to 1Y
- **THEN** the chart shows one year of closes and no request is made

### Requirement: Chart
The chart SHALL draw a line of daily closes for the selected range, green when the range ends at or above its start and red otherwise.

#### Scenario: Down range
- **WHEN** the 3M range ends below where it started
- **THEN** the line is red

### Requirement: Chart scrubbing
Pressing and dragging on the chart SHALL show a vertical cursor that follows the finger, and the price block SHALL show that day's close and date. A light haptic tick SHALL fire each time the cursor moves to another day. Releasing SHALL restore the latest close.

#### Scenario: Scrubbing
- **WHEN** the user drags across three days on the 1M chart
- **THEN** the price block shows each day's close and date in turn, with a haptic tick per day

#### Scenario: Release
- **WHEN** the user lifts their finger
- **THEN** the price block shows the latest close and "At close" date again

### Requirement: Key stats grid
A two-column grid SHALL show Open, High, Low, Volume (last session), Avg volume (30 sessions), 52W high, 52W low, Market cap (approx.) and Dividend yield (TTM). A stat that can't be derived SHALL be hidden, not shown as a placeholder.

#### Scenario: No share count
- **WHEN** the company has no share count
- **THEN** the grid has no Market cap cell and no "—"

#### Scenario: Dividends loading
- **WHEN** dividends are not yet loaded
- **THEN** the Dividend yield cell shows a skeleton until they arrive

### Requirement: About section
An About section SHALL show sector › subsector › segment and the legal name from the company record, leaving out any part that is missing.

#### Scenario: Full classification
- **WHEN** the company record has sector, subsector and segment
- **THEN** About shows them joined by "›", followed by the legal name

### Requirement: Details states
A chart error SHALL show Retry inside the chart area while the rest of the screen stays usable. A symbol not found SHALL show a message with a way back to the list.

#### Scenario: Unknown symbol
- **WHEN** the screen opens for a symbol that returns 404
- **THEN** it shows that the ticker wasn't found and offers a way back to the list

#### Scenario: Chart load failure
- **WHEN** the history fails to load and none is cached
- **THEN** the chart area shows Retry and the header and About still show

### Requirement: Details accessibility
The chart SHALL expose a summary label with range, direction, percent and start and end prices, for example "1 month, up 4,3 percent, from R$ 35,10 to R$ 36,61". The range selector SHALL be exposed as a tab list.

#### Scenario: Chart label
- **WHEN** a screen reader focuses the 1M chart
- **THEN** it reads the range, direction, percent and start and end prices
