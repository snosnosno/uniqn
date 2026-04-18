# Repository Guidelines

## Project Structure & Module Organization
Primary development happens in `uniqn-mobile/`. `app/` holds Expo Router groups: `(public)`, `(auth)`, `(app)`, `(employer)`, and `(admin)`. Keep UI in `src/components/`, hooks in `src/hooks/`, business logic in `src/services/`, Supabase access in `src/repositories/`, and errors in `src/errors/`. Supabase Edge Functions live in `uniqn-mobile/supabase/functions/`; DB migrations in `uniqn-mobile/supabase/migrations/`; docs live in `docs/`; `functions/` (Firebase Functions) is legacy and no longer deployed.

## Build, Test, and Development Commands
Run mobile commands from `uniqn-mobile/`: `npm start` starts Expo, `npm run android` and `npm run ios` build locally, `npm run quality` runs `type-check + lint + format:check`, `npm test` runs Jest, and `npm run e2e` runs Playwright. For Supabase Edge Functions use `npx supabase functions serve`; for DB migrations use `npx supabase db push`. Run `npm run quality` before release.

## Coding Style & Naming Conventions
Use strict TypeScript, explicit types, 2-space indentation, and existing Prettier rules. Prefer `@/` imports inside `uniqn-mobile/src`; use `./` only for same-folder files. Keep fields in camelCase, components in PascalCase, and route or asset filenames in kebab-case. In runtime code, use `logger.info()` instead of `console.log()`; console output is only for CLI scripts. Prefer `toast.success()` for status feedback, but use `Alert.alert` or `window.confirm` for confirm dialogs. Use `expo-image`, apply `dark:` styles for new UI, and prefer `FlashList` for large lists while allowing `FlatList` for pickers or fixed grids.

## Testing Guidelines
Jest with `jest-expo` is the main app test framework. Place tests as `*.test.ts(x)` or under `__tests__/`. Coverage thresholds are enforced in `uniqn-mobile/jest.config.js`; shared logic changes should also run `npm run test:coverage`. End-to-end coverage belongs in `uniqn-mobile/e2e/`. Backend tests live in `functions/test/**/*.test.ts` and run with Mocha plus Firebase emulators.

## Commit & Pull Request Guidelines
Follow `<type>(<scope>): <한글 제목>`, for example `fix(mobile): 로그인 예외 처리 수정`. Common types are `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, and `perf`. PRs should include a brief summary, linked issue or spec, impacted areas, and screenshots or recordings for UI changes. Explicitly mention Firebase rules, transactions, or role changes.

## Architecture & Security Notes
Keep the flow `Presentation -> Hooks -> Service -> Repository -> Supabase`. Domain DB reads and writes should go through services and repositories; auth hooks may call `authService` or auth-related hooks directly; TanStack Query read-only hooks may call repository fetchers directly. For multi-document updates, use Supabase RPC functions (never multi-step client mutations). Validate user input with `xssValidation` from `@/utils/security`, and use `AppError` in `src/errors/`. RLS app-role check: `(auth.jwt() -> 'app_metadata' ->> 'role')`, not `auth.jwt() ->> 'role'`.

Canonical ownership inside `uniqn-mobile/src`:
- `@/shared/status`: canonical status types, labels, flows, and mappers
- `@/constants/statusConfig`: UI status variants, colors, and display config
- `@/domains/settlement`: settlement calculators plus default salary/tax constants
- `@/shared/realtime`: supported realtime surface (`RealtimeManager`, `useRealtimeSubscription`)
- `@/types`: type-only barrel; import runtime helpers, functions, and constants from their source modules instead

Supabase layout:
- Edge Functions: `uniqn-mobile/supabase/functions/`
- Migrations: `uniqn-mobile/supabase/migrations/`
- DB types: `uniqn-mobile/src/lib/database.types.ts` (regenerate with `npx supabase gen types typescript`)
- `functions/` at repo root is legacy Firebase Functions — do not add new work there
