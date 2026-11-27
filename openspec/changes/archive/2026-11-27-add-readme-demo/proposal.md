# Proposal

## Why

**Rigor:** orchestrated. **Oversight:** autonomous. **Delivery:** merged.
**Branch:** `docs/readme-demo`.

The repo has no README, so someone opening it on GitHub sees no description of the app, no way to run it and no picture of it. This change adds a README with a short demo GIF. It was first made as a quick build, and is captured here so it can go to `main`.

## What Changes

- Add `README.md`. It covers what the app does, its features, getting started (an InvestingData key, `npm install`, `npm run ios`, `npm start`), the commands and quality gate, the stack, the project layout, and the current limits.
- Add `docs/media/demo.gif` (540×1174 px, 0.7 MB, about 17 s), shown in the README at 270 px wide. It was recorded on the iOS simulator against the real API, driven by deep links only:
  - the stock list in light and dark mode;
  - PETR4's details in dark and light;
  - VALE3's details.
  The status bar is overridden to 9:41, and the dev Tools button was hidden for the recording. The key screen is never shown.
- **Deliberate exception to the team's docs practice.** `docs/process.md` § Docs (TELUS Digital default) says to avoid checked-in binaries. The person chose to commit the GIF anyway: it's a recording with no text form, and it's small.

No app behaviour changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- None. This change is docs only, so `.openspec.yaml` sets `skip_specs: true`.

## Impact

- **New files:** `README.md` and `docs/media/demo.gif`. No source, config or dependency changes.
- **Not shown in the GIF:** search typing, chart scrubbing and range taps. They need touch input, and this Mac has no simulator touch driver (idb, Maestro or cliclick). The GIF can be re-recorded once one is installed.
