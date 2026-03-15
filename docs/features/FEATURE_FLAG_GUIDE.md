# Feature Flag 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 코드 기준

이 문서는 `uniqn-mobile/`의 실제 Feature Flag 구현만 설명합니다. 과거 웹앱의 조건부 라우팅 패턴은 현재 기준이 아닙니다.

## 기준 파일

- `uniqn-mobile/src/services/observability/featureFlagService.ts`
- `uniqn-mobile/src/hooks/useFeatureFlag.ts`
- `uniqn-mobile/src/lib/firebase.ts`
- `uniqn-mobile/app/(admin)/settings.tsx`

## 현재 동작 방식

- Feature Flag는 `featureFlagService` 싱글톤이 관리합니다.
- 웹에서는 Firebase Remote Config 값을 읽습니다.
- 네이티브에서는 Remote Config가 없으면 기본값으로 폴백합니다.
- 캐시 유효시간은 12시간입니다.
- 관리자 화면에서는 `/(admin)/settings`에서 현재 플래그 상태를 읽기 전용으로 확인하고 캐시 새로고침만 할 수 있습니다.

## 현재 플래그 목록

`FeatureFlags` 인터페이스 기준:

- `maintenance_mode`
- `enable_social_login`
- `enable_biometric`
- `enable_push_notifications`
- `enable_qr_checkin`
- `enable_location_search`
- `enable_new_design`
- `enable_debug_mode`
- `enable_offline_mode`
- `enable_settlement`
- `enable_advanced_filters`
- `enable_notification_grouping`

기본값은 `featureFlagService.ts`의 `DEFAULT_FEATURE_FLAGS`가 소스 오브 트루스입니다.

## 사용 방법

단일 플래그:

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const isSettlementEnabled = useFeatureFlag('enable_settlement');
```

상태 포함:

```tsx
import { useFeatureFlagWithStatus } from '@/hooks/useFeatureFlag';

const { isEnabled, isLoading, refresh } = useFeatureFlagWithStatus('maintenance_mode');
```

복수 조회:

```tsx
import { useFeatureFlags } from '@/hooks/useFeatureFlag';

const flags = useFeatureFlags(['enable_social_login', 'enable_biometric']);
```

서비스 직접 사용:

```ts
import { featureFlagService } from '@/services/observability';

await featureFlagService.initialize();
const enabled = featureFlagService.isEnabled('enable_qr_checkin');
```

## 관리자 확인 경로

관리자는 `uniqn-mobile/app/(admin)/settings.tsx`에서 다음 항목을 확인할 수 있습니다.

- 점검 모드 상태
- 전체 Feature Flag ON/OFF 상태
- 앱 버전 / 빌드 번호 / 플랫폼
- 캐시 새로고침

주의:

- 관리자 화면은 플래그 값을 직접 수정하지 않습니다.
- 점검 모드 및 Remote Config 값 변경은 Firebase 콘솔 기준입니다.

## 새 플래그 추가 절차

1. `FeatureFlags` 인터페이스에 키를 추가합니다.
2. `DEFAULT_FEATURE_FLAGS`에 기본값을 추가합니다.
3. 필요하면 `app/(admin)/settings.tsx`의 `FLAG_METADATA`에 라벨과 설명을 추가합니다.
4. UI에서는 `useFeatureFlag` 또는 `featureFlagService.isEnabled()`로 분기합니다.
5. 테스트가 필요하면 `src/services/observability/__tests__/featureFlagService.test.ts`와 `src/hooks/useFeatureFlag.ts` 사용부를 함께 검토합니다.

## 운영 메모

- 네이티브 앱은 현재 코드상 Remote Config 미사용 시 기본값으로 안전하게 동작합니다.
- `maintenance_mode`는 운영 영향이 크므로 관리자 화면에서 먼저 확인하고 배포합니다.
- 플래그 문서에 과거 웹 전용 예시를 다시 넣으면 현재 코드와 어긋납니다.
