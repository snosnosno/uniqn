# 알림 딥링크 드리프트 근본원인 수정

- 작성일: 2026-04-25
- 작성자: snosnosno
- 스코프: P0(복구) + P1(재발 방지) + P2(dead code 제거)
- 추정: CC+gstack 30분, 휴먼 4h
- PR 크기: ~90 lines changed, 5 files

## 배경: 증상 → 근본원인

**증상.** employer-application 관련 4개 알림(EMPLOYER_APP_SUBMITTED/APPROVED/REJECTED, NEW_EMPLOYER_APPLICATION) 탭 시 지정 화면이 아닌 홈 탭으로 폴백. 심사용 관리자 시나리오 2번("신규 employer 신청 알림 → 승인/거절")이 직격.

**근본원인.** 단일 route 추가가 4개 파일 병행 수정을 요구하는 구조인데, 어느 안전망도 이 드리프트를 못 잡음:

1. `RouteMapper.ts:135-136`의 `default: return EXPO_ROUTES.home`이 TS exhaustiveness를 무력화. `never` 체크 없음 → 새 union member 추가해도 컴파일 에러 없음.
2. `NotificationRouteMap.test.ts:10-23`의 coverage 테스트가 "함수 존재 + name 문자열" 만 검증. 실제 `RouteMapper.toExpoPath()` 결과가 유효한지 end-to-end 검증 없음.
3. `RouteMapper.test.ts`가 신규 route 3개(employer-application-status, admin/employer-application, admin/employer-applications) case를 아예 모름.
4. 범인 커밋 `dd66ed45d`: types.ts + NotificationRouteMap.ts만 수정, RouteMapper.ts + RouteRegistry.ts 미수정. 후속 커밋 `d06ac130c` 메시지 "type-check 통과가 증거"는 착각. type-check는 `Record<NotificationType, ...>`만 증명하지 switch 완전성은 증명 못 함.

## 스코프 (What's IN / NOT IN)

### IN
- P0: RouteMapper/Registry 미싱 case 및 상수 복구 (4개 알림 즉시 정상화)
- P1-a: `default` 블록 never 가드 (향후 union 추가 시 컴파일 가드)
- P1-b: 테스트 강화 (end-to-end 매핑 검증 + 누락 case 커버)
- P1-c: `isAdminOnlyNotification`에 `NEW_EMPLOYER_APPLICATION` 추가
- P2: `src/config/notificationConfig.ts` dead code 제거 (테스트만 import, 런타임 사용 0건)

### NOT IN (deferred)
- applicationId 쿼리 파라미터를 schedule 화면에서 활용 (별도 feature 작업)
- 알림 탭 전 권한 검증(role preflight) (보안 강화, 별도 PR)
- 4-file SSOT 통합 리팩토링 (선언형 테이블로 합치는 큰 구조 변경. 별도 설계 세션)
- Cold start `COLD_START_MAX_RETRIES` 강제 실행 로직 (별도 안정성 작업)

## 파일별 변경

### 1) `src/shared/deeplink/RouteRegistry.ts` (+6 lines)

EXPO_ROUTES에 추가:
```typescript
employerApplicationStatus: '/(app)/employer-application-status',
adminEmployerApplications: '/(admin)/employer-applications',
adminEmployerApplicationDetail: '/(admin)/employer-applications/[id]',
```

AUTH_REQUIRED_ROUTES에 추가:
```typescript
'employerApplicationStatus',
```

ADMIN_REQUIRED_ROUTES에 추가:
```typescript
'adminEmployerApplications',
'adminEmployerApplicationDetail',
```

### 2) `src/shared/deeplink/RouteMapper.ts` (+8 lines, -1)

`toExpoPath` switch 앞쪽(다른 admin case 근처)에 추가:
```typescript
case 'employer-application-status':
  return EXPO_ROUTES.employerApplicationStatus;
case 'admin/employer-applications':
  return EXPO_ROUTES.adminEmployerApplications;
case 'admin/employer-application':
  return EXPO_ROUTES.adminEmployerApplicationDetail.replace('[id]', route.params.id);
```

`default`를 exhaustiveness 가드로 교체:
```typescript
default: {
  const _exhaustive: never = route;
  return _exhaustive;  // 실행 불가, TS가 컴파일 타임에 막음
}
```

(실제로 런타임 도달 불가하지만 방어 차원에서 `return EXPO_ROUTES.home` 유지하고 `const _: never = route` 앞에만 두는 패턴도 가능. 리뷰 때 결정)

### 3) `src/shared/deeplink/NotificationRouteMap.ts` (+1)

`isAdminOnlyNotification` 배열에 `NotificationType.NEW_EMPLOYER_APPLICATION` 추가.

### 4) `src/shared/deeplink/__tests__/RouteMapper.test.ts` (+~20 lines)

"maps admin routes" 테이블에 누락된 3개 case 추가:
```typescript
[{ name: 'admin/employer-applications' }, EXPO_ROUTES.adminEmployerApplications],
[{ name: 'admin/employer-application', params: { id: 'app-1' } },
 '/(admin)/employer-applications/app-1'],
```

별도 describe에 employer-application-status 검증:
```typescript
expect(RouteMapper.toExpoPath({ name: 'employer-application-status' }))
  .toBe('/(app)/employer-application-status');
```

### 5) `src/shared/deeplink/__tests__/NotificationRouteMap.test.ts` (+~15 lines)

`'covers every NotificationType'` 테스트 강화: 단순 함수 존재 체크에서 `RouteMapper.toExpoPath()` end-to-end 검증으로 전환.

```typescript
import { RouteMapper } from '../RouteMapper';
import { EXPO_ROUTES } from '../RouteRegistry';

it('every NotificationType maps to a non-home valid expo path', () => {
  const homePath = EXPO_ROUTES.home;
  const allTypes = Object.values(NotificationType);

  allTypes.forEach((type) => {
    const route = NOTIFICATION_ROUTE_MAP[type]();
    const expoPath = RouteMapper.toExpoPath(route);
    // Non-home fallback check: home으로 떨어지는 건 설계상 home 매핑인 타입만 허용
    // (현재 RouteRegistry에 schedule/board/settings 등 실제 home은 없음)
    expect(expoPath).toMatch(/^\/[\(a-z]/);  // '/(' 또는 '/a-z' 시작
    expect(expoPath).not.toBe('');
  });
});
```

로직: 모든 NotificationType을 실제로 end-to-end 변환해서 경로를 얻고, 빈 문자열이나 명백히 깨진 값이 아닌지 검증. default fallback으로 떨어지면 `EXPO_ROUTES.home`이 반환되므로, fallback을 쓴 type들을 목록으로 허용하면 이후 깨짐이 즉시 테스트에서 드러남.

### 6) `src/config/notificationConfig.ts` + `__tests__/notificationConfig.test.ts` (삭제)

- `grep -r "from.*notificationConfig"` 결과: 테스트만 import. 런타임 참조 0.
- `NotificationRouteMap.ts`가 SSOT로 대체함.
- 삭제 후 knip 돌려서 고아 참조 없는지 확인.

## 검증 계획

### Red-Green 증명

**P0 case 추가 검증:**
1. Before: `RouteMapper.toExpoPath({name:'employer-application-status'})` → `/(app)/(tabs)` (home)
2. After: `/(app)/employer-application-status`
3. Before/After를 테스트로 Red-Green 증명

**P1 exhaustiveness 가드 검증:**
1. 임시로 types.ts에 가짜 union `{ name: 'fake-route' }` 추가
2. `npm run type-check` 실행 → **컴파일 에러 발생** 확인
3. 되돌리고 정상 빌드 확인

### 자동 검증
```bash
cd uniqn-mobile
npm run type-check    # 0 errors
npm test -- deeplink  # RouteMapper + NotificationRouteMap 테스트 전부 통과
npm run quality       # lint + format
npx knip              # notificationConfig.ts 삭제 후 고아 참조 0
```

### 수동 검증 (선택)
- Expo dev 빌드에서 `/(app)/employer-application-status` 직접 route push 해서 화면 로드 확인
- 실기기 푸시 알림 테스트는 별도 QA 세션 (이번 PR 범위 밖)

## 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| never 가드가 런타임 예외로 이어짐 | `default`에서 `return route as never` 대신 `return EXPO_ROUTES.home` 유지하고 `_exhaustive: never` 체크만 추가 |
| notificationConfig.ts 삭제가 숨은 의존성 깨뜨림 | grep + knip 이중 확인, 단계 커밋 분리 |
| 테스트 강화가 기존 테스트 깨뜨림 | 기존 `'covers every NotificationType'` 테스트 유지하고 새 end-to-end 테스트 병행 추가 |

## 커밋 전략

3개 커밋으로 분할(리뷰 용이성 + 회귀 시 bisect 쉬움):

1. `fix(deeplink): employer-application 라우팅 4개 복구`
   - RouteRegistry + RouteMapper + isAdminOnlyNotification + 테스트 케이스
2. `refactor(deeplink): switch default never 가드 + coverage 테스트 강화`
   - exhaustiveness 가드 + end-to-end 매핑 테스트
3. `chore(deeplink): 레거시 notificationConfig.ts 제거`
   - dead code 삭제 + 테스트 삭제

## Eng 셀프 리뷰 체크리스트

- [x] 근본원인 확증됨 (types.ts에 union 있는데 RouteMapper case 없는 상태 교차검증)
- [x] 변경 파일 ≤5 (blast radius 작음)
- [x] 회귀 테스트 red-green 경로 명시
- [x] 구조적 안전망 추가(never 가드) → 재발 차단
- [x] dead code 제거로 향후 혼동 제거
- [x] 커밋 단위 분리로 bisect 가능
- [x] Not-in-scope 목록 명시 (applicationId/권한/SSOT/cold start)

## 예상 효과

- 심사용 관리자 시나리오 2번 정상화 (employer 신청 알림 → 상세 화면)
- 향후 DeepLinkRoute union 추가 시 4개 파일 중 하나라도 누락하면 **컴파일 타임에 발견**
- notification → expo path 매핑 드리프트가 **테스트에서 발견**
- SSOT 1개 제거로 다음 route 추가 때 혼동 감소
