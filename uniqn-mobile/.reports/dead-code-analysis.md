# Dead Code Analysis Report

> 날짜: 2026-03-05 (갱신)
> 도구: knip v5.85.0, depcheck v1.4.7, ts-prune
> 프로젝트: uniqn-mobile

---

## 요약

| 항목 | 수량 | 상태 |
|------|------|------|
| 미사용 파일 | 5개 (knip) | 모두 오탐 - 삭제 불가 |
| 미사용 dependencies | 3개 (knip) | 모두 오탐 - 유지 필요 |
| 미사용 devDependencies | 3개 (knip) | 모두 오탐 - 유지 필요 |
| 미사용 exports | 1,682개 | barrel 위주, 일부 정리 가능 |
| 미사용 exported types | 996개 | barrel 위주, 일부 정리 가능 |
| 이전 SAFE 파일 (10개) | 삭제 완료 | git status `D` 확인 |

---

## 1. 파일/Dependencies: 오탐 확인 (삭제 불가)

### 미사용 파일 (5개) - 모두 FALSE POSITIVE

| 파일 | 오탐 이유 |
|------|-----------|
| `babel.config.js` | Metro 번들러 자동 발견, Expo 빌드 필수 |
| `metro.config.js` | NativeWind + Firebase 웹 번들링 설정 |
| `plugins/withNonModularHeaders.js` | `app.config.ts:226`에서 명시적 참조 |
| `functions/jobs/[id].ts` | Cloudflare Pages Function 동적 라우트 |
| `src/components/qr/QRCodeScanner.web.tsx` | `.web.tsx` 플랫폼 파일, Metro 자동 선택 |

### 미사용 Dependencies (3개) - 모두 FALSE POSITIVE

| 패키지 | 오탐 이유 |
|--------|-----------|
| `jsqr` | `QRCodeScanner.web.tsx:10`에서 import |
| `react-native-mmkv` | `mmkvStorage.ts:152`에서 require, cacheService 등 활발히 사용 |
| `react-native-nitro-modules` | react-native-mmkv의 peerDependency |

### 미사용 devDependencies (3개) - 모두 FALSE POSITIVE

| 패키지 | 오탐 이유 |
|--------|-----------|
| `@cloudflare/workers-types` | `functions/jobs/[id].ts` 타입 |
| `babel-preset-expo` | `babel.config.js`에서 사용 |
| `react-refresh` | Metro dev server 내부 의존성 |

> knip의 한계: Expo 플러그인, Cloudflare Pages 라우팅, `.web.tsx` 플랫폼 파일, peerDependency, 빌드 설정 자동 발견을 추적 못함

---

## 2. 이전 정리 완료 (10개 파일 삭제됨)

| 파일 | 상태 |
|------|------|
| `src/components/admin/UserCard.tsx` | 삭제 완료 |
| `src/components/admin/UserDetail.tsx` | 삭제 완료 |
| `src/components/admin/UserList.tsx` | 삭제 완료 |
| `src/components/lazy/index.tsx` | 삭제 완료 |
| `src/components/review/BubbleScoreDisplay.tsx` | 삭제 완료 |
| `src/components/review/ReviewList.tsx` | 삭제 완료 |
| `src/__tests__/mocks/firebase.ts` | 삭제 완료 |
| `src/__tests__/mocks/index.ts` | 삭제 완료 |
| `src/__tests__/utils/index.ts` | 삭제 완료 |
| `src/__tests__/utils/testUtils.tsx` | 삭제 완료 |

---

## 3. 미사용 Exports - 정리 가능 영역 (Phase 2)

### 3.1 완전 미사용 모듈 (모든 export가 미사용) - SAFE

아래 파일의 모든 named export가 프로젝트 어디서도 import되지 않음:

| 파일 | 미사용 항목 수 | 예시 |
|------|---------------|------|
| `src/utils/platform.ts` | 12 | isIOS, isAndroid, platformSelect 등 |
| `src/hooks/useFeatureFlag.ts` | 6 | useFeatureFlag, useFeatureFlags 등 |
| `src/hooks/useDeepLink.ts` | 4 | useNotificationNavigation 등 |
| `src/hooks/useNavigationTracking.ts` | 3 | useCurrentScreen 등 |
| `src/hooks/useAdminDashboard.ts` | 3 | useAdminDashboardStats 등 |
| `src/services/tokenRefreshService.ts` | 4 | getState, updateConfig 등 |
| `src/services/featureFlagService.ts` | default | 전체 서비스 미사용 |

### 3.2 부분 미사용 - 개별 export 정리 대상

| 파일 | 미사용 항목 |
|------|------------|
| `src/stores/authStore.ts` | selectAuthStatus, selectAuthError, useIsAuthenticated, useUser, useProfile, useHasHydrated |
| `src/stores/notificationStore.ts` | useNotifications, useNotificationSettings, useUnreadByCategory + 9개 selector |
| `src/constants/colors.ts` | getSurfaceColor, getChartColors, getPlaceholderColor, getLoadingColor + 15개 상수 |
| `src/services/authService.ts` | markOrphanAccount, reauthenticate, onAuthStateChanged |
| `src/hooks/useAuthGuard.ts` | useHasPermission, useIsAdmin, useIsEmployer, useIsStaff |
| `src/components/icons/index.tsx` | CopyIcon, ImageIcon, UnlockIcon, ArrowLeftIcon + 10개 아이콘 |

### 3.3 Barrel 파일 미사용 re-exports (대량)

| Barrel 파일 | 미사용 re-export 수 |
|-------------|---------------------|
| `src/services/index.ts` | ~200+ |
| `src/schemas/index.ts` | ~70+ |
| `src/errors/index.ts` | ~50+ |
| `src/components/ui/index.ts` | ~50+ |

> 참고: Barrel re-export 정리는 대규모 변경이므로 별도 세션에서 `/plan` 실행 후 진행 권장

---

## 4. 권장 조치

### 즉시 가능 (이번 세션)
- 없음 - 파일/의존성 오탐 확인, 이전 정리 이미 완료

### Phase 2 (별도 세션 권장)
1. **완전 미사용 모듈 7개** 삭제 (Section 3.1)
2. **부분 미사용 export** 개별 정리 (Section 3.2)

### Phase 3 (대규모 리팩토링)
1. Barrel 파일 re-export 정리 → `/plan` 필수
2. 미사용 아이콘 컴포넌트 정리

---

*분석 도구: knip 5.85.0, depcheck 1.4.7, ts-prune*
*이전 보고서 대비 변경: 파일/의존성 오탐 검증 추가, 이전 SAFE 파일 삭제 반영*
