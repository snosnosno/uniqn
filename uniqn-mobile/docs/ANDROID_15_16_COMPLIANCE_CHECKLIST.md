# Android 15/16 Compliance Checklist

Last updated: 2026-04-13  
Source of truth: `uniqn-mobile/app.config.ts`, `uniqn-mobile/app/_layout.tsx`, `uniqn-mobile/src/hooks/useAndroidOrientationPolicy.ts`, `uniqn-mobile/src/components/ui/Modal.tsx`

This checklist tracks the current shipping posture for Android 15 edge-to-edge and Android 16 large-screen orientation handling.

## Scope

- 현재 저장소: Expo SDK 55 / React Native 0.83.4 기준
- 이 문서는 Expo 55 이후에도 유지해야 하는 Android 15 edge-to-edge와 Android 16 대화면 대응 상태를 점검합니다.

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

- 추가 네이티브 의존성 업그레이드가 필요한 upstream warning 제거
- Play Console 경고의 원인이 앱 코드가 아닌 RN 내부 구현인지 더 깊게 추적하는 작업

## Related documents

- `docs/guides/DEPLOYMENT.md`
- `docs/core/TESTING_GUIDE.md`
- `uniqn-mobile/docs/EAS_BUILD_GUIDE.md`
