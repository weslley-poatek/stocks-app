# Stocks App

An iOS and Android app for browsing B3 stocks from the InvestingData API. Built with Expo (managed) and React Native, in TypeScript strict mode. It supports light and dark mode, and screens carry VoiceOver and TalkBack labels.

## Stack

- Navigation: Expo Router on a native stack.
- Server state: TanStack Query, persisted with MMKV. The API key is stored with expo-secure-store.
- HTTP: a typed fetch client that validates responses with zod schemas.
- Lists: FlashList. Charts: victory-native (Skia).
- Tests: Jest and React Native Testing Library, with MSW mocking the API. The pure derivation functions in `src/features/stocks/derive.ts` are unit-tested against fixtures.

## Commands

None yet: the repo has no package.json. When the scripts exist, list each one here with what it does and when to run it locally.

## Layout

- `src/app/`: Expo Router routes.
- `src/features/stocks/`: `api/`, `hooks/`, `components/`, `derive.ts`, `history-store.ts`, `starter.ts`.
- `src/shared/`: `format.ts`, `theme.ts`.
- `openspec/`: OpenSpec specs and changes (spec-driven schema).

Team process: see docs/process.md (sections per concern; recorded via chassis).
