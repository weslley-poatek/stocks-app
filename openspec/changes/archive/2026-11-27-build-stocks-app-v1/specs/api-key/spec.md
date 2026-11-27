# Spec Delta

## Purpose

Lets each user connect their own InvestingData API key, so the app can load B3 data without shipping a key, and keeps that key secret on the device.

## ADDED Requirements

### Requirement: Key gate on launch
The app SHALL open the API key screen on launch when no key is stored, and SHALL open the stock list when a key is stored. No API key SHALL ship inside the app.

#### Scenario: First launch
- **WHEN** the app launches with no stored key
- **THEN** the API key screen is shown, titled "Connect InvestingData", with the line "Paste your API key to load B3 prices."

#### Scenario: Later launch with a key
- **WHEN** the app launches with a stored key
- **THEN** the stock list is shown, with no visit to the API key screen

### Requirement: Key entry field
The key field SHALL use a monospace font, turn off autocorrect and autocapitalize, offer a paste button, and offer a show/hide toggle that hides the key by default.

#### Scenario: Pasting a key
- **WHEN** the user taps the paste button with `idk_01a2b3c4` on the clipboard
- **THEN** the field holds `idk_01a2b3c4` and it is masked until the user taps show

### Requirement: Key check before saving
Tapping "Continue" SHALL check the key against the usage endpoint before saving. A key SHALL be saved only when the check succeeds. On success, the app SHALL replace the navigation stack with the stock list.

#### Scenario: Valid key
- **WHEN** the user enters a key and taps Continue, and the usage check succeeds
- **THEN** the key is saved and the stock list replaces the key screen, with no back navigation to it

#### Scenario: Checking state
- **WHEN** the usage check is in flight
- **THEN** the Continue button shows a spinner and the field is disabled

### Requirement: Key check failures
A failed check SHALL show an inline message under the field and SHALL save nothing: 401 shows "That key wasn't accepted"; 403 shows "This key's plan doesn't include price data"; a network failure shows "Can't check the key right now" with a Retry action.

#### Scenario: Invalid key
- **WHEN** the usage check returns 401
- **THEN** "That key wasn't accepted" shows under the field and no key is stored

#### Scenario: Plan without price data
- **WHEN** the usage check returns 403
- **THEN** "This key's plan doesn't include price data" shows and no key is stored

#### Scenario: Offline
- **WHEN** the usage check fails with no network
- **THEN** "Can't check the key right now" shows with Retry, and no key is stored

### Requirement: Sign-up link
The key screen SHALL offer "Don't have a key? Get one", which opens https://www.investingdata.com.br/dashboard in an in-app browser.

#### Scenario: Opening the dashboard
- **WHEN** the user taps "Don't have a key? Get one"
- **THEN** the InvestingData dashboard opens in an in-app browser, and closing it returns to the key screen

### Requirement: Saved key status and management
With a key saved, the key screen SHALL show the key prefix, the plan, and today's remaining requests, and SHALL offer Replace key and Remove key. It SHALL open from a key button in the stock list header.

#### Scenario: Viewing a saved key
- **WHEN** the user opens the key screen from the list header with a saved `pro` key
- **THEN** it shows a prefix such as `idk_01a2…`, the plan "pro", and today's remaining requests, never the full key

#### Scenario: Removing the key
- **WHEN** the user taps Remove key
- **THEN** the stored key is deleted and the app returns to the empty key screen

#### Scenario: Replacing the key
- **WHEN** the user taps Replace key, enters a new key and it passes the check
- **THEN** the new key replaces the old one; if it fails the check, the old key stays stored

### Requirement: Rejected key returns to the key screen
When any data request is rejected with 401, the app SHALL return the user to the key screen with the message "That key was rejected".

#### Scenario: Key revoked while browsing
- **WHEN** a price request returns 401
- **THEN** the key screen opens showing "That key was rejected"

### Requirement: Key secrecy
The key SHALL be stored only in the device's secure keychain storage. It SHALL never be written to logs or to the general data cache, and SHALL never be shown in full after saving.

#### Scenario: Key not in the data cache
- **WHEN** a key is saved and data has been cached
- **THEN** the persisted data cache contains no copy of the key

#### Scenario: Key not logged
- **WHEN** requests are made in a development build with logging on
- **THEN** no log line contains the full key
