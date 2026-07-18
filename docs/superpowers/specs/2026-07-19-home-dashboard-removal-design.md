# 홈 대시보드 전면 삭제 — 설계 (2026-07-19)

> 결정: 홈 대시보드(`/(app)/home`)를 코드째 삭제하고, 로그인 착지를 구인구직 탭으로 되돌린다.
> 전제 조건인 취소요청 알림 딥링크 결함을 **선행 수정**한다.

## 1. 배경

홈 대시보드는 2026-04 도입 이후 다음 문제를 안고 있었다.

- **동선 비용**: 로그인 착지가 `/(app)/home`(역할 무관, `authRedirect.ts:126`). 사장이든 스태프든 일하러 오면 대시보드를 한 번 거쳐야 한다.
- **중복**: 스태프 위젯은 스케줄 탭과 어휘·데이터가 겹친다. 코드 주석이 이미 자백 — `schedule.tsx:210` *"홈 ApplicationStatusWidget과 동일 어휘 사용"*. 최근 공지는 게시판 `PinnedNoticeBanner`와 중복.
- **유지보수 비용**: `src/components/home/` 15파일 1,291줄이 홈 전용으로 격리되어 있고, 홈 진입 시 위젯 6개가 동시 로딩된다(Realtime 구독 + 4-fan out + InfiniteQuery 포함).
- **미해결 채로 남은 지적**: `TODOS.md:5-25`(2026-04-16 plan-eng-review)에 발견성 문제(리뷰어 2인 지적)와 lazy 로딩 필요성이 기록되어 있으나 대응책 모두 **미구현**.

실사용자 0인 현 시점에서, 사용 신호 없이 유지할 근거가 없다.

## 2. 목표 / 비목표

**목표**
- 로그인 착지를 `/(app)/(tabs)/home-jobs`로 고정.
- 홈 전용 코드(라우트·컴포넌트·고아 훅·테스트) 완전 제거.
- 삭제의 전제인 `cancellation_requested` 알림 딥링크 결함 수정.

**비목표 (이번 스코프 밖)**
- 사장용 횡단 집계를 다른 탭으로 이식하는 작업. 실사용자 요구 발생 시 별건으로 설계한다(기존 결정 *"홈 스트립은 사용 신호 후로 유예"* 와 일치).
- 로고 탭 → "현재 탭 최상단 스크롤" 동작. 전 탭 scroll ref 배선이 필요해 과하다.
- `APPLICATION_CANCELLED` dead 타입 정리(무관한 별건).

## 3. 실측 근거

조사(2026-07-19, 서브에이전트 2인 + 메인 검증)에서 확인된 사실:

| 항목 | 실측 결과 |
|---|---|
| 착지 라우트 | `/(app)/home` — 역할 무관. `authRedirect.ts:4-8,126`, 플래그 `home_dashboard_enabled: true` |
| 플래그 성격 | **빌드타임 전용**. `weekly_grid_enabled`/`ops_hub_enabled`와 달리 원격 `app_config` 백업 없음 → 롤백도 OTA 필요 |
| 딥링크 위험 | **0건**. `NOTIFICATION_ROUTE_MAP`에 `/home`을 가리키는 알림 타입 없음 |
| 코드 격리도 | `src/components/home/**`를 import하는 프로덕션 코드는 `home.tsx` **단 하나** |
| 홈 전용 정보 | 스태프: 월별 정산. 사장: 새 지원자 합계·정산 합계·취소요청 집계·주간 요일별 분포 |
| 취소요청 알림 | **발송됨**. `fn_notify_cancellation_request`(`20260711030000_...sql:32-58`)가 owner ∪ 워크스페이스 owner/멤버 ∪ 협업자에게 priority `high` INSERT → `on_notification_created_send_push` → Expo 푸시. pgTAP `notify_cancellation_recipients.test.sql` 존재 |

**핵심 판정**: 홈 `CancellationWidget`은 푸시가 이미 하는 일을 60초 폴링으로 중복 수행하던 것이다. 삭제해도 사장이 취소 요청을 놓치지 않는다.

## 4. 선행 수정 — `cancellation_requested` 딥링크 (BLOCKING)

**결함**: DB가 쏘는 타입 문자열 `'cancellation_requested'`가 클라이언트 `NotificationType` enum에 없다. 라벨·아이콘·라우트맵 어디에도 매핑이 없어, 푸시는 도착하지만 탭하면 기본값 폴백으로 빠진다.

**왜 BLOCKING인가**: "알림이 커버하므로 위젯을 지운다"가 삭제의 근거다. 딥링크가 죽어 있으면 그 근거가 성립하지 않는다. 홈 위젯이 이 결함을 가려주고 있었다.

**마이그레이션 불필요** — 트리거 INSERT는 `(recipient_id, type, category, title, body, data, priority)`만 채우고 `link` 컬럼을 쓰지 않으므로(`20260711030000_...sql:37`), 라우팅은 전적으로 `NOTIFICATION_ROUTE_MAP` 소관이다. `data`에 `{applicationId, jobPostingId}`가 이미 실려 있다(`:43`).

**변경 지점**
- `src/types/notification.ts` — `NotificationType.CANCELLATION_REQUESTED = 'cancellation_requested'`, `NOTIFICATION_CATEGORY_MAP`(application), `NOTIFICATION_PRIORITY_MAP`(high), `NOTIFICATION_TYPE_LABELS`('취소 요청')
- `src/constants/notificationTemplates.ts` — 템플릿 추가
- `src/components/notifications/NotificationIcon.tsx` — 아이콘 매핑
- `src/shared/deeplink/NotificationRouteMap.ts` — `data.jobPostingId` → `postingCancellationRequests`(`/(employer)/my-postings/[id]/cancellation-requests`), `jobPostingId` 부재 시 `employer/my-postings` 폴백
- `isEmployerOnlyNotification`의 employer 타입 목록에 추가

**주의**: 알림 row의 `link` 필드는 라우트맵보다 **우선**한다(평점/리뷰 기능에서 겪은 함정). 이 트리거는 `link`를 쓰지 않음을 확인했으므로 라우트맵 추가로 충분하다.

## 5. 삭제 인벤토리

| 대상 | 작업 |
|---|---|
| `app/(app)/home.tsx` | 삭제 |
| `src/components/home/**` (15파일 1,291줄 + `__tests__`) | 삭제 |
| `src/config/featureFlags.ts:10-11` | `home_dashboard_enabled` 제거 |
| `src/shared/navigation/authRedirect.ts:4-8,126` | `appHome` → `/(app)/(tabs)/home-jobs` 고정, 플래그 분기 제거 |
| `app/(app)/_layout.tsx:34-39` | 알림 초기화 게이트에서 `appHome` 비교 제거 |
| `app/(app)/_layout.tsx:128-133` | `<Stack.Screen name="home">` 제거 |
| `src/components/headers/TabHeader.tsx:35-45` | `handleLogoPress` 제거, 로고를 비인터랙티브 텍스트로 |
| `app/(app)/(tabs)/profile.tsx:203-207` | "대시보드" 메뉴 항목 제거 |

**고아 훅 5종** (홈 위젯 전용, 삭제 시 dead):
`useMonthlyPayroll`(`useWorkLogs.ts`) · `useSettlementDashboard`·`useMySettlementSummary`(`useSettlement.ts`) · `useScheduleStats`·`useUpcomingSchedules`(`useSchedules.ts`)

**존치 훅** (다른 화면도 사용, 삭제 금지):
`usePendingReviews`(schedule·reviews/history) · `useCurrentWorkStatus`(qr·schedule·ScheduleDetailSheet·WorkTab)

**테스트**
- 유닛: `app/(app)/__tests__/home.test.tsx` 삭제. `TabHeader.test.tsx`·`authRedirect.test.ts`·`useAuthGuard.test.ts` 홈 기대값 수정
- e2e: `e2e/pages/app/tabs/home.page.ts` 삭제, `home-logo-no-stack-accumulation.spec.ts` 삭제(로고 탭 동작 자체가 사라짐), p0 스펙 4건(`admin-report-resolution`·`rbac-access`·`e2e-user-journeys`·`auth-login`)의 `page.goto('/home')`를 `page.goto('/home-jobs')`로 치환(스펙 삭제가 아니라 경로 교체 — 각 스펙의 검증 대상은 홈이 아니다)
- `NotificationRouteMap.test.ts` — 신규 타입 케이스 추가

## 6. 의도적 손실

사장 횡단 집계 3종(새 지원자 합계·정산 합계·주간 요일별 분포)과 스태프 월별 정산을 버린다. 탭에는 공고 단위 상세만 남는다.

근거: 실사용자 0 + YAGNI. 사장이 실제로 요구하면 그때 `employer.tsx`에 짓는다. "탭 상단 요약 스트립"으로 이식하는 것은 결국 홈을 탭 안에 다시 짓는 일이며, 사용 신호 없이 지으면 같은 실수의 반복이다.

취소요청 집계만은 시간 민감(당일 인력 펑크 리스크)이라 예외 검토 대상이었으나, §3에서 푸시 커버리지가 실측 확인되어 버린다.

## 7. 리스크와 완화

| 리스크 | 완화 |
|---|---|
| 딥링크 수정 없이 위젯만 삭제 → 취소요청 인지 경로 실질 단절 | §4를 **선행** 커밋. 순서 역전 금지 |
| 로고 탭 제거로 기존 사용자 혼란 | 실사용자 0이라 영향 없음 |
| 고아 훅 삭제가 knip 래칫(현행 2209)과 충돌 | 삭제 후 래칫 재측정·하향 반영 |
| 롤백 필요 시 플래그가 사라져 되돌릴 수 없음 | git revert로 대응. 플래그도 어차피 빌드타임이라 OTA 필요했음 — 롤백 비용 동일 |

## 8. 검증 계획 (exit proof)

1. `npm run quality` — type-check + lint + format 0 오류
2. `npm test` — 전량 통과, 삭제/수정된 스펙 반영
3. `grep -rn "(app)/home\|components/home" src app e2e` — 잔존 참조 0
4. `npx knip` — 래칫 재측정, 신규 미사용 export 0
5. **로그인 → `home-jobs` 착지 실측** (웹 또는 실기기). 라우팅 변경은 정적 검사로 증명되지 않는다
6. **취소요청 알림 딥링크 실측** — 알림 탭 → `cancellation-requests` 화면 도달 확인

5·6은 실행 관찰이 필수다. 정적 통과만으로 완료를 주장하지 않는다.

## 9. 커밋 순서

1. `fix(notification): 취소요청 알림 타입·딥링크 매핑 추가` — §4 단독. 이 커밋만으로도 독립적 가치가 있다
2. `refactor(home): 홈 대시보드 삭제 및 착지 라우트 전환` — §5
3. `chore(test): 홈 관련 e2e·유닛 스펙 정리` — 필요 시 2와 병합
