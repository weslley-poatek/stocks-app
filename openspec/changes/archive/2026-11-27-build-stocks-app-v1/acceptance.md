# Acceptance record: build-stocks-app-v1

Device: iOS simulator, iPhone 18 Pro (iOS 27.0), development build, 2026-11-26. Screenshots are in `/tmp/stocks-device/` (outside the repo). The source spec file is not in the repo, so the acceptance items below are the scenarios of the five specs under `specs/`. Android and TalkBack were not run.

## 8.1 Acceptance list

"pending — person" means it needs touch, typing, VoiceOver, Android or another thing the shell cannot do. "unit" means covered by tests only, not seen on the device.

### stock-list
| Item | Result |
|---|---|
| Header after load | Re-checked 2026-11-26: Light PASS (`list-light.png`). Dark PASS (`list-dark.png`): the large "Stocks" title is now light on black (navigation theme from the palette). |
| Sorted by volume, Starter tickers | Rows show 14 tickers (`list-light.png`). Order by volume not checked against data. Delisted starter: the cold-start log shows a `/v1/tickers/B3SA3` lookup and no B3SA3 price request, and no B3SA3 row is visible in the first screen; not confirmed further. |
| First rows appear early (cold start) | PASS on the device: all rows loaded within about 2.3 s of the first request (`req.log`, `cold-start.png`, with the dev menu open over it). |
| Row content / Falling stock | PASS: pills now read "+0,98%" and "−2,15%" (explicit sign in `format.ts`, `list-light.png`). A sparkline can differ in colour from its pill (PETR4 red line, green pill; WEGE3 green line, red pill): the sparkline is the last 5 closes and the pill is the last day. Question for the spec owner whether that is intended. |
| Change pill modes: cycling, missing market cap | pending — person (tap) |
| Search: ticker prefix, company name, before the index loads, dismissal, empty search | pending — person (typing). Ticker-shape check unit-tested, including lower case. |
| List navigation: opening a stock | PASS via deep link `stocks-app://stock/PETR4`. Row tap pending — person. |
| Pull to refresh | pending — person (drag) |
| List states: error with cache | unit |
| Dark mode | PASS (`list-dark.png`): title, rows, pills and sparklines read. |
| Screen reader | pending — person (VoiceOver) |

### stock-details
| Item | Result |
|---|---|
| Back to list | PASS visually: back button "Stocks" at top left (`petr4-light.png`). Tap pending — person. |
| Price block | PASS (`petr4-light.png`, `petr4-dark.png`): "R$ 52,71", "+R$ 0,51 (+0,98%)", "At close, 30 Oct". |
| No logo | The header has an empty slot to the left of the ticker and name (no logo on PETR4); the text is indented. Looks acceptable; the spec scenario is unit tested. |
| From the list (only a dividends request) | unit |
| Range selector | Shown, 1W selected, in light and dark. Switching pending — person. |
| Chart: down range | PASS: 1W line is red (`petr4-light.png`); grid lines now visible in dark (`petr4-dark.png`, palette separator colour). The 1W line is red while the day change is green: the chart is the week, the price block is the last day. |
| Scrubbing, Release | pending — person (drag) |
| Key stats grid | Cause found with a temporary `[data]` log (removed). The API's price bars carry only `timestamp` and `close` (0 of 173 bars have open, high, low or volume), and the company record has `summary: null`, so no `total_shares`. The spec hides stats it can't derive, so only the dividend yield shows: left as is. The 0,00% yield was our bug: the API's `ex_date` is Unix seconds as a string (sample "1525143600"); 33 dividends returned and 0 kept. Fixed in `parseExDate`; PETR4 now shows 4,39% (`petr4-light.png`). The dividends cache key was versioned so empty lists cached before the fix are not reused. |
| About | PASS: classification and legal name (`petr4-light.png`). |
| Unknown symbol, chart load failure | unit |
| Chart label (accessibility) | pending — person (VoiceOver) |
| Dark mode | PASS (`petr4-dark.png`): the nav title "PETR4" and the back button are light on black; grid lines visible. |

### api-key
| Item | Result |
|---|---|
| First launch | Not run (needs an empty keychain). unit |
| Later launch with a key | PASS: after uninstall and reinstall the app opened on the list, the keychain item survived. |
| Pasting, valid key, checking state, invalid key, plan without price data, offline, sign-up link | pending — person (needs typing and the paste button) / unit |
| Viewing a saved key | PASS (`key-light.png`): the key row reads "idk_01a2…" (8 characters then an ellipsis, cut in `mapUsage`), plan, requests left. The title and card sit below the native header, clear of the status bar and back button. |
| Removing, replacing the key | pending — person |
| Key revoked while browsing | unit |
| Key not in the data cache, key not logged | The `[req]` log lines hold the path only (unit test added); the key never appears in them. |

### market-data
| Item | Result |
|---|---|
| Header sent | PASS: requests were accepted (no 401). |
| Cold start within the limit, unknown limit | PASS: see 8.2. |
| Pause on 429 | No 429 happened on the device. unit |
| Relaunch the same day, offline, pull to refresh, caching | pending — person / unit |
| Response validation, error mapping, company index | unit |

### stock-metrics
All scenarios are unit tests; on the device the quote, change, session date, sparkline and range slice for PETR4 are shown and look consistent (`petr4-light.png`). The locale in the simulator is Brazilian formatting ("R$ 52,71", "+0,98%"); English locale not checked.

## Hands-on checks by the person (2026-11-26)

These supersede the "pending — person" rows above where they overlap. The person ran them on the iOS simulator and reported that **all worked**:
- **Change pill modes:** tapping a pill cycles every row through %, R$ and market cap. Market cap is empty-styled on this data, since there are no share counts.
- **Search:** "petr" and "petrobras" match, and Cancel restores the starter list.
- **Pull to refresh**, with the 15-minute floor.
- **Range selector:** 1W → 1M → 1Y → ALL switches instantly.
- **Scrubbing and Release** on the 1M chart: the price block follows the finger, then returns to "At close, 30 Oct".
- **Back to list:** returns at the same scroll position.
- **Valid key:** pasted and accepted at task 1.5, so the list loads on the real key.

## Logos (tasks 6.6, 7.6)

- **PASS:** `list-logos-light.png`, `list-logos-dark.png` and `petr4-logo-light.png` show real company logos in list rows (36 px) and the details header (44 px).
- **Cause of the earlier failure:** the API's `image_url`s are public SVGs (`content-type: image/svg+xml`), which React Native's `Image` can't draw. They're now drawn with `expo-image`.
- **Initials fallback:** unit-tested, since every starter has a logo.

## Not verified in this change

- **Android and TalkBack:** this Mac has no Android emulator. The person deferred Android to a follow-up change, so `npm run android` (from 1.2) is also unverified.
- **VoiceOver:** not available in the iOS Simulator. The row and chart labels are unit-tested, and they need a physical iPhone pass.
- **Haptics:** the Simulator has no haptic engine. One tick per day change is unit-tested, and it needs a physical iPhone pass.
- **Key flows not exercised by hand:** first launch with an empty keychain, the 401, 403 and offline messages, the sign-up link, and replacing or removing the key. All are unit-tested.
- **English locale:** not checked on the device. It's unit-tested.

## 8.2 Cold-start request rate

- Date: 2026-11-26.
- Method: uninstalled `com.stocksapp.app` from the simulator (cache empty, keychain item kept) and reinstalled it with `npx expo run:ios`. Started Metro and `xcrun simctl spawn booted log stream --level debug --predicate 'eventMessage CONTAINS "[req]"'` before the launch, opened the app, and waited for all rows to load. The log lines are `[req] <epoch ms> <path>`, path only, written under `__DEV__` by `request()`, and `[req] limit=<n>` by `RequestQueue.configure()`. The app opened on the list, so the key survived.
- Limit the queue was configured with: 25 per minute (`[req] limit=25`, from `/v1/usage`). Before that the queue used its default of 10.
- Total requests: 19 (3 `/v1/companies`, 1 `/v1/usage`, 1 `/v1/tickers/B3SA3`, 14 `/v1/tickers/<symbol>/price`).
- Maximum in any rolling 60-second window: 19, against a limit of 25. All 19 were sent within 2.3 s.
- 429: none. All rows loaded, and the Metro log and the `[req]` log show no rate-limit pause.
- Caveat: the `/v1/usage` check and the first `/v1/companies` request went out before the limit was known; only 2 had been sent, under the default of 10. The `[req]` log did not show a repeated `/v1/companies` page: 3 lines were seen, two at the same millisecond. Check that the index fetch of 3 requests, two of them parallel, is intended.
