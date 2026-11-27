# Stocks App

An iOS and Android app for browsing B3 stocks from the InvestingData API. Built with Expo (managed) and React Native, in TypeScript strict mode. It supports light and dark mode, and screens carry VoiceOver and TalkBack labels.

## Stack

- Navigation: Expo Router on a native stack.
- Server state: TanStack Query, persisted with MMKV. The API key is stored with expo-secure-store.
- HTTP: a typed fetch client that validates responses with zod schemas.
- Lists: FlashList. Charts: victory-native (Skia).
- Tests: Jest and React Native Testing Library, with MSW mocking the API. The pure derivation functions in `src/features/stocks/derive.ts` are unit-tested against fixtures.

## Commands

Run everything from the repo root with npm.

- `npm run typecheck`: `tsc --noEmit` in strict mode. Run it after any code change.
- `npm run lint`: `expo lint` (ESLint with `eslint-config-expo`). Run it before handing work over.
- `npm test`: Jest with the `jest-expo` preset and React Native Testing Library. Run it after any code change.
- Quality gate: `npm run typecheck && npm run lint && npm test`. Run it before every commit.
- `npm run ios`: `expo run:ios`. Generates `ios/` (gitignored), builds the development build and installs it on a simulator. Needs Xcode. Run it on the first setup and after adding or upgrading a native dependency.
- `npm run android`: `expo run:android`. The same for Android. Needs the Android SDK and an emulator or device.
- `npm start`: `expo start --dev-client`. Starts Metro for an installed development build. Run it day to day, since JS changes reload without a native rebuild. Press `i` or `a` to open the build, or use the `exp+stocks-app://` link.

The app is a development build, not Expo Go, because react-native-mmkv is native. `ios/` and `android/` are generated: never edit them by hand, and delete them to regenerate.

## Layout

- `src/app/`: Expo Router routes.
- `src/features/stocks/`: `api/`, `hooks/`, `components/`, `derive.ts`, `history-store.ts`, `starter.ts`.
- `src/shared/`: `format.ts`, `theme.ts`.
- `openspec/`: OpenSpec specs and changes (spec-driven schema).

Team process: see docs/process.md (sections per concern; recorded via chassis).
