# stock-metrics Specification

## Purpose

Derives the quote, chart ranges and key stats on the device from InvestingData's raw price, dividend and company data, since the API has no quote, ranking or stats endpoints.

## Requirements

### Requirement: Timestamp unit detection
A price bar's timestamp SHALL be read as milliseconds when it is above 1e12, and as seconds otherwise.

#### Scenario: Seconds
- **WHEN** a bar's timestamp is 1764028800
- **THEN** it is read as 2025-11-25 (UTC)

#### Scenario: Milliseconds
- **WHEN** a bar's timestamp is 1764028800000
- **THEN** it is read as the same date

### Requirement: Quote and change
Last close SHALL be the last bar's close. Change SHALL be last close minus the previous bar's close, and change % SHALL be change divided by the previous close. The session date SHALL be the last bar's date.

#### Scenario: Up day
- **WHEN** the last two closes are 36.61 then 37.05
- **THEN** close is 37.05, change is +0.44, change % is about +1.20%

#### Scenario: Single bar
- **WHEN** the history has one bar
- **THEN** close is shown and change and change % are absent

### Requirement: Sparkline
The sparkline SHALL use the last 5 daily closes, and SHALL be marked up when the last of them is at or above the first, and down otherwise.

#### Scenario: Down week
- **WHEN** the last 5 closes fall from 38.00 to 36.50
- **THEN** the sparkline has 5 points and is marked down

### Requirement: Range slices
Ranges 1W, 1M, 3M, 6M, YTD, 1Y, 5Y and ALL SHALL be slices of the same history by date, ending at the last bar. YTD SHALL start at the first bar of the last bar's calendar year. A range SHALL be up when its last close is at or above its first close.

#### Scenario: One month
- **WHEN** the last bar is 2025-11-25 and the range is 1M
- **THEN** the slice holds the bars from 2025-10-25 onward

#### Scenario: Range longer than history
- **WHEN** the history spans 2 years and the range is 5Y
- **THEN** the slice is the whole history

### Requirement: Long-range downsampling
5Y and ALL SHALL be downsampled to at most 500 points by keeping the last close of each week, or of a wider equal bucket when weekly points would exceed 500. Shorter ranges SHALL keep every bar. The last point SHALL always equal the last close.

#### Scenario: Five years
- **WHEN** 5Y is drawn for a history longer than 5 years
- **THEN** the chart has one point per week (about 260) and its last point equals the last close

#### Scenario: Twenty years
- **WHEN** ALL is drawn for a 5,000-bar history
- **THEN** the chart has at most 500 points and its last point equals the last close

### Requirement: Session stats
Open, high, low and volume SHALL come from the last bar. Average volume SHALL be the mean volume of the last 30 daily bars, where a daily bar is at most 5 days after the bar before it. 52-week high and low SHALL be the maximum high and minimum low over the bars dated within 365 days before the last bar. A stat whose inputs are missing SHALL be absent, not zero.

#### Scenario: Short history
- **WHEN** the history has 100 daily bars
- **THEN** 52W high and low use all 100 bars, and average volume uses the last 30

#### Scenario: Monthly then daily history
- **WHEN** the history has monthly bars until July 2026, daily bars from 3 August 2026, and its last bar on 30 October 2026
- **THEN** 52W high and low use only the bars dated from 30 October 2025 on, and average volume uses only daily bars, never a monthly one

#### Scenario: Missing volume
- **WHEN** the last bar has no volume
- **THEN** volume is absent

### Requirement: Approximate market cap
Market cap SHALL be last close times the company's total shares, and SHALL be labelled approximate because total shares mixes share classes.

#### Scenario: Known shares
- **WHEN** close is 37.85 and total shares is 13,044,496,930
- **THEN** market cap is about R$ 493.7 billion, labelled approximate

#### Scenario: Unknown shares
- **WHEN** the company has no share count
- **THEN** market cap is absent

### Requirement: Trailing dividend yield
Dividend yield SHALL be the sum of dividend amounts with an ex-date in the 12 months before the last bar's date, divided by the last close.

#### Scenario: Four payouts
- **WHEN** payouts in the last 12 months total R$ 3.70 and close is 37.00
- **THEN** dividend yield is 10.0%

#### Scenario: No payouts
- **WHEN** there are no payouts in the last 12 months
- **THEN** dividend yield is 0%

### Requirement: Locale formatting
Prices SHALL be formatted as BRL in the device locale, percentages with sign, large numbers in compact form, and dates as short day and month.

#### Scenario: Brazilian locale
- **WHEN** the device locale is pt-BR and close is 37.85
- **THEN** it shows "R$ 37,85"

#### Scenario: English locale
- **WHEN** the device locale is en-US and change % is 0.012
- **THEN** it shows "+1.20%"
