# 홈 대시보드 전면 삭제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 대시보드(`/(app)/home`)를 코드째 삭제하고 로그인 착지를 구인구직 탭으로 되돌린다. 전제 조건인 취소요청 알림 딥링크 결함을 선행 수정한다.

**Architecture:** Task 1이 `cancellation_requested` 알림 타입을 클라이언트에 등록해 딥링크를 살린다(삭제의 근거). Task 2~4가 홈으로 향하는 진입점 3개(착지 라우트·로고 탭·프로필 메뉴)를 끊고, Task 5가 고립된 홈 코드를 삭제한다. Task 6이 e2e를 정리하고 Task 7이 실행 관찰로 검증한다.

**Tech Stack:** Expo Router 55 / React Native 0.83.4 / TypeScript strict / Jest / Playwright(e2e)

## Global Constraints

- 모든 주석·커밋 메시지는 **한글**. 코드 식별자만 영문.
- 경로는 `@/` 절대 경로. 시스템 절대 경로 금지.
- 커밋 형식: `<type>(<scope>): <한글>` — feat/fix/refactor/style/docs/test/chore/perf
- 작업 디렉토리는 `uniqn-mobile/`. 모든 npm/jest 명령은 여기서 실행.
- **Task 1은 Task 2~5보다 반드시 먼저 커밋**한다. 순서가 뒤집히면 "알림이 커버한다"는 삭제 근거가 무너진다.
- 삭제 대상이 아닌 훅 2개는 **절대 삭제 금지**: `usePendingReviews`(schedule·reviews/history 사용), `useCurrentWorkStatus`(qr·schedule·ScheduleDetailSheet·WorkTab 사용).
- `e2e/pages/app/tabs/home.page.ts`는 **삭제 금지** — 이름과 달리 구인구직 탭 페이지 오브젝트다.

---

### Task 1: `cancellation_requested` 알림 타입 등록 + 딥링크 배선

DB 트리거 `fn_notify_cancellation_request`가 `'cancellation_requested'` 타입 알림을 발송하지만, 클라이언트 `NotificationType`에 이 타입이 없어 라벨·아이콘·딥링크가 모두 기본값으로 폴백된다. 트리거는 `link` 컬럼을 쓰지 않고 `data`에 `{applicationId, jobPostingId}`를 실어 보내므로, 라우팅은 전적으로 `NOTIFICATION_ROUTE_MAP` 소관이다. 마이그레이션 불필요.

**Files:**
- Modify: `src/shared/deeplink/types.ts` (DeepLinkRoute 유니온)
- Modify: `src/shared/deeplink/RouteMapper.ts:96` 근처
- Modify: `src/types/notification.ts:31-34, 163-171, 239-247, 419-427`
- Modify: `src/shared/deeplink/NotificationRouteMap.ts:32-35, 137-147`
- Modify: `src/constants/notificationTemplates.ts:75-88` 근처
- Modify: `src/components/notifications/NotificationIcon.tsx:46-54` 근처
- Modify: `src/services/observability/internal/deepLinkRouteSerializer.ts:73-74` 근처
- Test: `src/shared/deeplink/__tests__/NotificationRouteMap.test.ts`

**Interfaces:**
- Produces: `NotificationType.CANCELLATION_REQUESTED`(값 `'cancellation_requested'`), `DeepLinkRoute` variant `{ name: 'employer/cancellation-requests'; params: { jobId: string } }`. 이후 태스크는 이것들에 의존하지 않는다(Task 1은 독립).

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/shared/deeplink/__tests__/NotificationRouteMap.test.ts` 파일 끝의 마지막 `});` 앞에 아래 `describe` 블록을 추가한다.

```ts
  describe('CANCELLATION_REQUESTED (취소 요청 — 사장 수신)', () => {
    it('routes to the posting cancellation-requests screen with jobPostingId', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CANCELLATION_REQUESTED]({
        applicationId: 'app-1',
        jobPostingId: 'job-123',
      });
      expect(route).toEqual({
        name: 'employer/cancellation-requests',
        params: { jobId: 'job-123' },
      });
    });

    it('falls back to my-postings when jobPostingId is missing', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CANCELLATION_REQUESTED]({});
      expect(route).toEqual({ name: 'employer/my-postings' });
    });

    it('is classified as an employer-only notification', () => {
      expect(isEmployerOnlyNotification(NotificationType.CANCELLATION_REQUESTED)).toBe(true);
    });
  });
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npx jest src/shared/deeplink/__tests__/NotificationRouteMap.test.ts -t "CANCELLATION_REQUESTED"`
Expected: FAIL — `NotificationType.CANCELLATION_REQUESTED`가 `undefined`이므로 `NOTIFICATION_ROUTE_MAP[undefined] is not a function` 류 에러.

- [ ] **Step 3: `DeepLinkRoute` 유니온에 variant를 추가한다**

`src/shared/deeplink/types.ts`에서 `| { name: 'employer/settlement'; params: { jobId: string } }` 바로 아래에 추가:

```ts
  | { name: 'employer/cancellation-requests'; params: { jobId: string } }
```

- [ ] **Step 4: `RouteMapper`에 경로 매핑을 추가한다**

`src/shared/deeplink/RouteMapper.ts`에서 `case 'employer/settlement':` 블록 바로 아래에 추가:

```ts
      case 'employer/cancellation-requests':
        return EXPO_ROUTES.postingCancellationRequests.replace('[id]', route.params.jobId);
```

`EXPO_ROUTES.postingCancellationRequests`(`= '/(employer)/my-postings/[id]/cancellation-requests'`)와 `EMPLOYER_REQUIRED_ROUTES`의 `'postingCancellationRequests'` 등록은 `RouteRegistry.ts:41,130`에 **이미 존재**한다. 추가하지 말 것.

- [ ] **Step 5: `NotificationType` enum과 3개 맵에 타입을 추가한다**

`src/types/notification.ts` — `CANCELLATION_REJECTED` 정의 바로 아래(34행 근처):

```ts
  /** 취소 요청 접수됨 (사장·워크스페이스 멤버·협업자에게) */
  CANCELLATION_REQUESTED: 'cancellation_requested',
```

`NOTIFICATION_TYPE_TO_CATEGORY`의 `[NotificationType.CANCELLATION_REJECTED]` 줄 아래:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: NotificationCategory.APPLICATION,
```

`NOTIFICATION_DEFAULT_PRIORITY`의 `[NotificationType.CANCELLATION_REJECTED]` 줄 아래 — DB 트리거가 `'high'`로 INSERT하므로 값을 일치시킨다:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: 'high',
```

`NOTIFICATION_TYPE_LABELS`의 `[NotificationType.CANCELLATION_REJECTED]` 줄 아래:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: '취소 요청',
```

- [ ] **Step 6: `NOTIFICATION_ROUTE_MAP`과 employer 분류에 항목을 추가한다**

`src/shared/deeplink/NotificationRouteMap.ts` — `[NotificationType.CANCELLATION_REJECTED]` 블록(32-35행) 바로 아래:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/cancellation-requests', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },
```

같은 파일 `isEmployerOnlyNotification`의 `employerTypes` 배열(138-144행)에 추가:

```ts
    NotificationType.CANCELLATION_REQUESTED,
```

- [ ] **Step 7: 템플릿과 아이콘을 추가한다**

`src/constants/notificationTemplates.ts` — `[NotificationType.CANCELLATION_REJECTED]` 블록 아래:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: {
    title: '취소 요청',
    body: (d) => `"${d.jobTitle}" 취소 요청이 접수되었습니다.`,
    link: (d) => `/employer/my-postings/${d.jobPostingId}/cancellation-requests`,
    icon: '⚠️',
  },
```

`d`의 타입은 이 파일 상단에 정의된 템플릿 데이터 타입을 따른다. `jobTitle`·`jobPostingId`가 그 타입에 없으면 Step 8의 `tsc`가 잡아낸다 — 그때는 타입에 있는 필드만 써서 문구를 맞춘다.

참고: 실제 알림 본문은 DB 트리거가 직접 써 넣으므로(`"○○님이 ... 취소를 요청했습니다"`) 이 템플릿은 클라이언트 생성 경로용 폴백이다. 그래도 타입 맵 정합성을 위해 채운다.

`src/components/notifications/NotificationIcon.tsx` — `typeIcons`의 `[NotificationType.CANCELLATION_REJECTED]` 줄 아래. `UserMinusIcon`은 이 파일이 이미 import 중이다:

```ts
  [NotificationType.CANCELLATION_REQUESTED]: UserMinusIcon,
```

- [ ] **Step 8: 타입 체크로 나머지 exhaustive switch를 찾아 채운다**

Run: `npx tsc --noEmit`

`DeepLinkRoute`/`NotificationType`을 exhaustive하게 다루는 switch·Record가 더 있으면 여기서 에러로 드러난다. 알려진 곳은 `src/services/observability/internal/deepLinkRouteSerializer.ts` — `case 'employer/settlement':` 아래에 추가:

```ts
    case 'employer/cancellation-requests':
      return `employer/cancellation-requests/${route.params.jobId}`;
```

에러가 더 나오면 같은 패턴으로 채운다. Expected(최종): 에러 0.

- [ ] **Step 9: 테스트가 통과하는 것을 확인한다**

Run: `npx jest src/shared/deeplink/__tests__/NotificationRouteMap.test.ts`
Expected: PASS — 신규 3케이스 포함 전체 통과.

- [ ] **Step 10: 커밋한다**

```bash
git add src/shared/deeplink src/types/notification.ts src/constants/notificationTemplates.ts src/components/notifications/NotificationIcon.tsx src/services/observability/internal/deepLinkRouteSerializer.ts
git commit -m "fix(notification): 취소요청 알림 타입 등록 및 딥링크 배선

DB 트리거가 발송하는 cancellation_requested 가 클라이언트 NotificationType 에
없어 라벨·아이콘·딥링크가 기본값으로 폴백되던 결함 수정.
트리거는 link 컬럼 미사용 + data.jobPostingId 제공 → 라우트맵 추가로 해결(마이그 불필요)."
```

---

### Task 2: 로그인 착지 라우트를 구인구직 탭으로 전환

`AUTH_ENTRY_ROUTES.appTabs`(= `/(app)/(tabs)/home-jobs`)가 이미 존재하므로, 플래그 분기 상수 `appHome`을 제거하고 `appTabs`를 반환하도록 바꾼다.

**Files:**
- Modify: `src/shared/navigation/authRedirect.ts:4-19, 126`
- Modify: `app/(app)/_layout.tsx:32-39`
- Test: `src/shared/navigation/__tests__/authRedirect.test.ts:156-178` 외
- Test: `src/hooks/__tests__/useAuthGuard.test.ts`

**Interfaces:**
- Consumes: 없음(Task 1과 독립)
- Produces: `AUTH_ENTRY_ROUTES`에서 `appHome` 키가 사라진다. `getAuthenticatedEntryRoute()`는 정상 사용자에게 `'/(app)/(tabs)/home-jobs'`를 반환한다.

- [ ] **Step 1: 테스트를 새 기대값으로 고친다**

`src/shared/navigation/__tests__/authRedirect.test.ts:156-178`의 `describe('AUTH_ENTRY_ROUTES.appHome with feature flag', ...)` 블록 **전체를 삭제**하고, 그 자리에 아래를 넣는다(플래그가 사라지므로 분기 테스트 자체가 무의미):

```ts
  describe('AUTH_ENTRY_ROUTES.appTabs', () => {
    it('points at the jobs tab', () => {
      expect(AUTH_ENTRY_ROUTES.appTabs).toBe('/(app)/(tabs)/home-jobs');
    });
  });
```

같은 파일에서 `AUTH_ENTRY_ROUTES.appHome`을 기대값으로 쓰는 나머지 `it` 블록(30-38, 40-48, 61-72행 근처)의 `appHome`을 **`appTabs`로 치환**한다.

`src/hooks/__tests__/useAuthGuard.test.ts`에서 `expect(mockReplace).toHaveBeenCalledWith('/(app)/home')`를 쓰는 3개 케이스(`redirects authenticated users away from the public jobs entry route`, `... alias route`, `still redirects authenticated users to home on a true root entry with empty segments`)의 기대값을 모두 아래로 치환한다:

```ts
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/home-jobs');
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npx jest src/shared/navigation/__tests__/authRedirect.test.ts src/hooks/__tests__/useAuthGuard.test.ts`
Expected: FAIL — 기대값 `/(app)/(tabs)/home-jobs` vs 실제 `/(app)/home`.

- [ ] **Step 3: `authRedirect.ts`에서 플래그 분기를 제거한다**

`src/shared/navigation/authRedirect.ts`의 `AUTH_ENTRY_ROUTES`에서 `appHome` 줄 3개를 삭제해 아래 형태로 만든다:

```ts
export const AUTH_ENTRY_ROUTES = {
  appTabs: '/(app)/(tabs)/home-jobs',
  signup: '/(auth)/signup',
  socialSignup: '/(auth)/signup?mode=social',
  identityReverify: '/(auth)/signup?mode=reverify',
  profileSetup: '/(app)/profile-setup',
} as const;
```

파일 상단의 `featureFlags` import가 이 파일에서 더 이상 쓰이지 않으면 **import도 함께 삭제**한다.

`getAuthenticatedEntryRoute()`의 마지막 반환문(126행)을 바꾼다:

```ts
  return AUTH_ENTRY_ROUTES.appTabs;
```

`as AuthEntryRoute` 캐스트는 제거한다 — `appTabs`는 리터럴 타입이라 캐스트 없이 대입된다. `tsc`가 불평하면 유지한다.

- [ ] **Step 4: `_layout.tsx`의 알림 초기화 게이트를 고친다**

`app/(app)/_layout.tsx:32-39`의 비교 대상을 바꾼다:

```ts
  const shouldInitializeNotifications =
    !!profile &&
    getAuthenticatedEntryRoute({
      socialProvider: profile.socialProvider ?? null,
      phoneVerified: profile.phoneVerified ?? null,
      profileCompleted: profile.profileCompleted ?? null,
      identityVerified: profile.identityVerified ?? null,
    }) === AUTH_ENTRY_ROUTES.appTabs;
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `npx jest src/shared/navigation/__tests__/authRedirect.test.ts src/hooks/__tests__/useAuthGuard.test.ts`
Expected: PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add src/shared/navigation app/\(app\)/_layout.tsx src/hooks/__tests__/useAuthGuard.test.ts
git commit -m "refactor(navigation): 로그인 착지를 구인구직 탭으로 전환

AUTH_ENTRY_ROUTES.appHome(플래그 분기) 제거하고 기존 appTabs 사용.
홈 대시보드를 거치지 않고 바로 일하는 화면에 착지한다."
```

---

### Task 3: TabHeader 로고를 비인터랙티브로 전환

로고 탭 = 홈 이동은 비표준 패턴이었고(리뷰어 2인 지적, `TODOS.md:10`) 홈이 사라지므로 목적지가 없다. 로고를 `Pressable` 없는 순수 `Text`로 만든다.

**Files:**
- Modify: `src/components/headers/TabHeader.tsx:2-3, 33, 35-45, 126-159`
- Test: `src/components/headers/__tests__/TabHeader.test.tsx:57-76`

**Interfaces:**
- Consumes: 없음
- Produces: `TabHeader`에 `accessibilityLabel="UNIQN 홈으로 이동"` 버튼이 더 이상 존재하지 않는다.

- [ ] **Step 1: 로고 탭 테스트 3개를 삭제한다**

`src/components/headers/__tests__/TabHeader.test.tsx:57-76`의 아래 3개 `it` 블록을 **통째로 삭제**한다:
- `'navigates to home when logo is tapped'`
- `'does not navigate when already on home screen (grouped path)'`
- `'does not navigate when already on home screen (web path)'`

그 자리에 로고가 여전히 보이되 버튼이 아님을 고정하는 테스트를 넣는다:

```ts
  it('renders the brand mark as non-interactive text', () => {
    const { getByText, queryByRole } = render(<TabHeader title="구인구직" />);
    expect(getByText('UNIQN')).toBeTruthy();
    expect(queryByRole('button', { name: 'UNIQN 홈으로 이동' })).toBeNull();
  });
```

삭제한 테스트가 `mockPathname`·`mockPush`를 쓰던 유일한 곳이면 해당 mock 선언도 정리한다. 다른 테스트가 쓰고 있으면 남긴다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npx jest src/components/headers/__tests__/TabHeader.test.tsx -t "non-interactive"`
Expected: FAIL — 아직 `Pressable`이 있어 `queryByRole('button', ...)`이 요소를 찾는다.

- [ ] **Step 3: `handleLogoPress`를 제거한다**

`src/components/headers/TabHeader.tsx:35-45`의 `handleLogoPress` 함수 전체를 삭제한다. 33행의 `const pathname = usePathname();`도 삭제한다(이 함수에서만 쓰였다).

- [ ] **Step 4: 로고 JSX에서 `Pressable`을 벗겨낸다**

126-159행의 중앙 로고 블록을 아래로 교체한다:

```tsx
      {/* 중앙 로고 (absolute + pointerEvents none — 표시 전용 브랜드 마크) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          className="font-display font-bold px-3 py-1"
          allowFontScaling={false}
          style={{
            color: '#D4AF37',
            // impeccable §27 — 브랜드 마크는 Dynamic Type 영향을 받되 극단 스케일
            // (예: 200%)에서 헤더 레이아웃 붕괴 방지. 기본 + 최대 1.5배까지만 확대.
            fontSize: 18 * Math.min(PixelRatio.getFontScale(), 1.5),
          }}
        >
          UNIQN
        </Text>
      </View>
```

`pointerEvents`를 `box-none` → `none`으로 바꿨다. 더 이상 탭 대상이 없으므로 터치가 이 오버레이를 완전히 통과해야 한다.

- [ ] **Step 5: 미사용 import를 정리한다**

`Pressable`·`usePathname`·`router`가 `TabHeader.tsx`의 다른 곳에서 쓰이는지 확인한다.

Run: `grep -n "Pressable\|usePathname\|router\." src/components/headers/TabHeader.tsx`

쓰이지 않는 것만 2-3행의 import에서 제거한다. (헤더 우측 액션 버튼들이 `Pressable`과 `router`를 쓸 가능성이 높으니 grep 결과로 판단할 것.)

- [ ] **Step 6: 테스트가 통과하는 것을 확인한다**

Run: `npx jest src/components/headers/__tests__/TabHeader.test.tsx`
Expected: PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add src/components/headers
git commit -m "refactor(header): 로고를 표시 전용 브랜드 마크로 전환

로고 탭=홈 이동은 비표준 패턴(plan-eng-review 지적)이었고
홈 대시보드 삭제로 목적지가 사라져 Pressable 제거."
```

---

### Task 4: 프로필 탭의 "대시보드" 메뉴 항목 제거

**Files:**
- Modify: `app/(app)/(tabs)/profile.tsx:21, 203-207`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 메뉴 항목과 구분선을 삭제한다**

`app/(app)/(tabs)/profile.tsx`에서 아래 블록을 삭제한다(`MenuItem` + 바로 뒤 `Divider`):

```tsx
          <MenuItem
            icon={<HomeIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="대시보드"
            onPress={() => router.push('/(app)/home')}
          />
          <Divider spacing="sm" />
```

- [ ] **Step 2: `HomeIcon` import를 정리한다**

Run: `grep -n "HomeIcon" app/\(app\)/\(tabs\)/profile.tsx`

매치가 21행 import 한 줄만 남으면 그 import에서 `HomeIcon`을 제거한다. 다른 곳에서 쓰이면 남긴다.

- [ ] **Step 3: 타입 체크와 관련 테스트를 실행한다**

Run: `npx tsc --noEmit && npx jest app/\(app\)/\(tabs\)/__tests__ --passWithNoTests`
Expected: 타입 에러 0, 테스트 통과.

- [ ] **Step 4: 커밋한다**

```bash
git add app/\(app\)/\(tabs\)/profile.tsx
git commit -m "refactor(profile): 대시보드 메뉴 항목 제거"
```

---

### Task 5: 홈 라우트·컴포넌트·고아 훅 삭제

진입점이 모두 끊긴 상태에서 코드를 제거한다. `src/components/home/**`는 `home.tsx` 외 어디서도 import되지 않는 완전 격리 코드다.

**Files:**
- Delete: `app/(app)/home.tsx`
- Delete: `app/(app)/__tests__/home.test.tsx`
- Delete: `src/components/home/**` (15개 파일 + `__tests__`)
- Modify: `app/(app)/_layout.tsx:128-133`
- Modify: `src/config/featureFlags.ts:10-11`
- Modify: `src/hooks/useWorkLogs.ts`, `src/hooks/useSettlement.ts`, `src/hooks/useSchedules.ts`
- Modify: `src/hooks/index.ts` (배럴 export)

**Interfaces:**
- Consumes: Task 2가 `featureFlags.home_dashboard_enabled` 참조를 이미 제거했어야 한다.
- Produces: 없음

- [ ] **Step 1: 홈 화면과 컴포넌트 디렉터리를 삭제한다**

```bash
git rm app/\(app\)/home.tsx
git rm app/\(app\)/__tests__/home.test.tsx
git rm -r src/components/home
```

- [ ] **Step 2: `_layout.tsx`에서 Stack.Screen 등록을 제거한다**

`app/(app)/_layout.tsx:128-133`의 아래 블록을 삭제한다:

```tsx
          <Stack.Screen
            name="home"
            options={{
              presentation: 'card',
            }}
          />
```

- [ ] **Step 3: 피처 플래그를 제거한다**

`src/config/featureFlags.ts`에서 아래 두 줄(주석 + 키)을 삭제한다:

```ts
  /** 홈 대시보드 활성화. false 시 기존 탭 진입 경로로 fallback. */
  home_dashboard_enabled: true,
```

- [ ] **Step 4: 고아 훅 5개를 삭제한다**

아래 훅 정의를 각 파일에서 삭제하고, `src/hooks/index.ts` 배럴에서도 export를 제거한다:

| 훅 | 파일 |
|---|---|
| `useMonthlyPayroll` | `src/hooks/useWorkLogs.ts` |
| `useSettlementDashboard` | `src/hooks/useSettlement.ts` |
| `useMySettlementSummary` | `src/hooks/useSettlement.ts` |
| `useScheduleStats` | `src/hooks/useSchedules.ts` |
| `useUpcomingSchedules` | `src/hooks/useSchedules.ts` |

삭제한 훅만 쓰던 헬퍼·쿼리키·타입이 같은 파일 안에서 고아가 되면 함께 삭제한다.

**절대 삭제 금지**: `usePendingReviews`, `useCurrentWorkStatus` — 다른 화면이 사용 중이다.

- [ ] **Step 5: 잔존 참조가 0인지 확인한다**

Run: `grep -rn "(app)/home\|components/home\|home_dashboard_enabled\|useMonthlyPayroll\|useSettlementDashboard\|useMySettlementSummary\|useScheduleStats\|useUpcomingSchedules" src app`
Expected: 매치 0건. (e2e는 Task 6에서 처리하므로 여기서 제외한다.)

매치가 남으면 그 지점을 마저 정리한다.

- [ ] **Step 6: 타입 체크와 전체 테스트를 실행한다**

Run: `npx tsc --noEmit`
Expected: 에러 0.

Run: `npx jest`
Expected: 전체 통과. 실패가 있으면 삭제한 홈 코드를 참조하던 테스트이므로 해당 테스트를 정리한다.

- [ ] **Step 7: 커밋한다**

```bash
git add -A src app
git commit -m "refactor(home): 홈 대시보드 삭제 및 고아 훅 정리

컴포넌트 15파일(1291줄)·라우트·피처플래그·전용 훅 5개 제거.
홈 전용 격리 코드로 다른 화면 import 0건이었음."
```

---

### Task 6: e2e 스펙 정리

**Files:**
- Delete: `e2e/tests/p1-important/home-logo-no-stack-accumulation.spec.ts`
- Modify: `e2e/tests/p0-critical/admin-report-resolution.spec.ts:322-323`
- Modify: `e2e/tests/p0-critical/rbac-access.spec.ts` (77-78, 93-94, 136-137)
- Modify: `e2e/tests/p0-critical/e2e-user-journeys.spec.ts` (21-22, 42-43, 65-66, 173, 186-197)
- Modify: `e2e/tests/p0-critical/auth-login.spec.ts:24`
- Modify: `e2e/pages/app/tabs/home.page.ts:23-68`

**Interfaces:**
- Consumes: Task 2의 착지 라우트 변경
- Produces: 없음

- [ ] **Step 1: 로고 스택 누적 스펙을 삭제한다**

로고 탭 동작 자체가 사라졌으므로 검증 대상이 없다.

```bash
git rm e2e/tests/p1-important/home-logo-no-stack-accumulation.spec.ts
```

- [ ] **Step 2: p0 스펙 4개의 goto 경로를 치환한다**

아래 4개 파일에서 `page.goto('/home', ...)`를 모두 `page.goto('/home-jobs', ...)`로 바꾼다. 각 스펙의 검증 대상은 홈이 아니라 "로그인 후 앱 안쪽"이므로 스펙 삭제가 아니라 경로 교체다.

- `e2e/tests/p0-critical/admin-report-resolution.spec.ts` (1곳)
- `e2e/tests/p0-critical/rbac-access.spec.ts` (3곳)
- `e2e/tests/p0-critical/e2e-user-journeys.spec.ts` (5곳)

관련 주석 `// /home으로 직접 이동 (splash 우회)`도 `// /home-jobs로 직접 이동 (splash 우회)`로 함께 고친다.

`e2e-user-journeys.spec.ts:186-197`의 주석 블록은 홈 대시보드 도입(PR #119) 배경을 설명하고 `HomeTabBar`를 언급하므로, 아래로 교체한다:

```ts
  // 홈 대시보드 삭제(2026-07-19) 후 staff entry = (app)/(tabs)/home-jobs.
  // 프로필 탭 → "설정센터" menu item 으로 이동한다.
  //
  // Note: `page.goto('/settings')` 직접 이동은 frame detached + RangeError
  // (wrapApiCall Invalid string length) 회귀가 있어 UI 네비게이션으로 우회한다.
```

`HomeTabBar`의 "프로필 탭으로 이동" 버튼을 셀렉터로 쓰던 부분은 실제 하단 탭바의 프로필 탭을 누르도록 바꿔야 한다. `HomeTabBar`는 Task 5에서 삭제되므로 이 셀렉터는 반드시 죽는다.

먼저 프로젝트에 이미 있는 탭바 셀렉터 관례를 찾는다:

Run: `grep -rn "프로필" e2e/pages e2e/tests --include=*.ts | grep -i "tab\|getByRole"`

찾은 관례와 동일한 방식으로 교체한다. 관례가 없으면 `page.getByRole('button', { name: '프로필' })`로 작성하고, Step 5 이후 해당 스펙을 실제 실행해 셀렉터가 맞는지 확인한다.

- [ ] **Step 3: `auth-login.spec.ts`의 착지 경로 기대값을 고친다**

`e2e/tests/p0-critical/auth-login.spec.ts:24`:

```ts
    expect(loginPage.getCurrentPath()).toBe('/home-jobs');
```

- [ ] **Step 4: `home.page.ts`의 리다이렉트 전제를 제거한다**

⚠️ 이 파일은 **삭제하지 않는다**. 이름과 달리 구인구직 탭 페이지 오브젝트이며 `e2e/tests/p2-standard/jobs-home.spec.ts:6`이 사용 중이다.

파일 23-68행의 `goto()`를 읽고, `featureFlags.home_dashboard_enabled` 참조와 `/home` → 탭 리다이렉트 대기 로직을 제거해 `/home-jobs`로 바로 이동하고 헤더(`구인구직`)를 기다리는 형태로 단순화한다. `searchInput`·`header` 등 나머지 로케이터는 그대로 둔다.

- [ ] **Step 5: 잔존 참조가 0인지 확인한다**

Run: `grep -rn "'/home'\|home_dashboard_enabled\|HomeTabBar" e2e`
Expected: 매치 0건.

- [ ] **Step 6: 커밋한다**

```bash
git add -A e2e
git commit -m "test(e2e): 홈 대시보드 삭제에 맞춰 스펙 정리

로고 스택 누적 스펙 삭제, p0 4종 goto 경로를 home-jobs로 치환,
home.page.ts(구인구직 탭 오브젝트)의 리다이렉트 전제 제거."
```

---

### Task 7: 최종 검증

정적 검사만으로는 라우팅 변경을 증명할 수 없다. 실행 관찰 2건이 필수다.

**Files:** 없음(검증 전용)

- [ ] **Step 1: 품질 게이트를 실행한다**

Run: `npm run quality`
Expected: type-check + lint + format 모두 0 오류.

- [ ] **Step 2: 전체 테스트를 실행한다**

Run: `npm test`
Expected: 전체 통과. 실패 건수와 스위트 수를 기록한다.

- [ ] **Step 3: 잔존 참조를 전수 확인한다**

Run: `grep -rn "(app)/home\|components/home\|home_dashboard_enabled" src app e2e`
Expected: 매치 0건.

- [ ] **Step 4: knip 래칫을 재측정한다**

Run: `npx knip`

미사용 export 수가 기존 래칫(2209)보다 줄었으면 `package.json`의 `knip:gate` 값을 실측치로 낮춘다. 늘었으면 새로 생긴 미사용 export를 정리한다.

- [ ] **Step 5: 로그인 착지를 실행 관찰한다**

앱을 띄우고(`npm start` → 웹 또는 실기기) 로그인한다.

Expected: 대시보드를 거치지 않고 **구인구직 탭에 바로 착지**. 헤더의 UNIQN 로고를 탭해도 아무 일도 일어나지 않는다.

관찰 결과를 그대로 기록한다. 정적 검사 통과는 이 항목의 증거가 되지 않는다.

- [ ] **Step 6: 취소요청 알림 딥링크를 실행 관찰한다**

스태프 계정으로 확정된 근무의 취소를 요청하고, 사장 계정에서 도착한 알림을 탭한다.

Expected: 해당 공고의 `cancellation-requests` 화면에 도달. 알림 목록에서 라벨이 '취소 요청', 아이콘이 기본값 폴백이 아님.

로컬에서 두 계정을 오가기 어려우면, 최소한 알림 목록에서 라벨·아이콘이 올바르게 렌더되는지와 탭 시 이동 경로를 확인한다. 확인하지 못한 부분은 **갭으로 명시 보고**한다.

- [ ] **Step 7: 검증 결과를 보고한다**

Step 1~6의 실제 출력(테스트 통과 수, grep 결과, 관찰 내용)을 근거로 완료를 보고한다. 실행하지 못한 검증이 있으면 숨기지 말고 갭으로 명시한다.

---

## 참고: 의도적으로 하지 않는 것

- 사장 횡단 집계(새 지원자 합계·정산 합계·주간 요일별 분포)와 스태프 월별 정산을 **다른 탭으로 이식하지 않는다.** 실사용자 0 + YAGNI. 실제 요구 발생 시 별건으로 설계한다.
- 로고 탭 → "현재 탭 최상단 스크롤" 동작을 만들지 않는다. 전 탭 scroll ref 배선이 필요해 과하다.
- `NotificationType.APPLICATION_CANCELLED`(어떤 트리거도 INSERT하지 않는 dead 타입) 정리는 무관한 별건이다.
