# Tasks

## Agents

- `developer`: Build. Any fix the review asks for. Tasks 1.1–1.3 were done inline as a quick build before this change was captured. Its description covers changes in this repo.
- `reviewer`: Review. The review step's base reviewer.

## 1. README and demo

- [x] 1.1 Record the demo on the iOS simulator with deep links only: the list in light and dark mode, PETR4 in dark and light, then VALE3. Use a 9:41 status bar and hide the dev Tools button. Never open the key screen.
- [x] 1.2 Build `docs/media/demo.gif` (540×1174 px, 0.7 MB) from the recording, and check that every frame keeps the status bar.
- [x] 1.3 Write `README.md`: overview with the GIF, features, getting started, commands and quality gate, stack, project layout and limits.

## 2. Check

- [x] 2.1 Check the README: every relative path and link target exists, every `npm` command it names is a `package.json` script, and the quality gate passes.
