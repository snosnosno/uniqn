# Android 15/16 Compliance Checklist

Last updated: 2026-03-30  
Source of truth: `uniqn-mobile/app.config.ts`, `uniqn-mobile/app/_layout.tsx`, `uniqn-mobile/src/hooks/useAndroidOrientationPolicy.ts`, `uniqn-mobile/src/components/ui/Modal.tsx`

This checklist tracks the current shipping posture for Android 15 edge-to-edge and Android 16 large-screen orientation handling.

## Scope

- Phase 1 is already reflected in the current app code and Expo config.
- Phase 2 remains a future Expo SDK 55 follow-up and is not part of the current release baseline.

## Applied app changes

- Removed the global Expo `orientation: 'portrait'` setting from `app.config.ts`.
- Kept iOS portrait behavior through `UISupportedInterfaceOrientations` in `app.config.ts`.
- Added Android-only runtime orientation handling in `src/hooks/useAndroidOrientationPolicy.ts`.
- Replaced mounted `expo-status-bar` component usage with imperative status bar updates in `app/_layout.tsx`.
- Updated QR, notice image viewer, and admin image picker flows to react to window-size changes.
- Added safe-area wrapping in the shared native modal component.

## Android 15 edge-to-edge notes

- Safe area handling remains app-managed through `SafeAreaProvider`, `SafeAreaView`, and `useSafeAreaInsets`.
- The app no longer mounts the React `expo-status-bar` component globally.
- Remaining Play Console warnings may still come from upstream React Native or `react-native-screens`.

## Android 16 large-screen policy

- `window width < 600dp`: lock portrait on Android at runtime
- `window width >= 600dp`: unlock orientation on Android
- Re-evaluate on resize, fold or unfold, and multi-window changes

## Manual QA checklist

- Login and signup remain readable with system bars and insets applied.
- Main tabs, settings, and notices do not clip behind the navigation bar.
- QR scanner and employer QR modal remain usable on phones in portrait.
- Notice image viewer keeps selection and layout through rotation and split-screen resize.
- Admin announcement image picker keeps usable thumbnail sizing on tablets.
- Android 16 phones preserve portrait UX.
- Android 16 tablets and foldables can rotate without layout breakage.

## Excluded from current release baseline

- Expo SDK 55 migration
- Upstream library warning elimination that requires dependency upgrades

## Related documents

- `docs/guides/DEPLOYMENT.md`
- `docs/core/TESTING_GUIDE.md`
- `uniqn-mobile/docs/EAS_BUILD_GUIDE.md`
