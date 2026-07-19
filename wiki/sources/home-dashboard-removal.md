---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/src/types/notification.ts
  - uniqn-mobile/src/shared/deeplink/types.ts
  - uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts
  - uniqn-mobile/src/services/work/scheduleService.ts
  - uniqn-mobile/src/components/headers/TabHeader.tsx
  - uniqn-mobile/src/hooks/useAuthGuard.ts
  - uniqn-mobile/package.json
  - uniqn-mobile/supabase/migrations/20260711030000_notify_cancellation_request_recipients.sql
  - PR#276
  - memory/project_home_dashboard_removal_20260719
tags: [home, dashboard, deletion, deeplink, notification, knip, e2e, navigation]
---

# 소스: 홈 대시보드 전면 삭제 + 취소요청 딥링크 선행 수정 (PR #276, 2026-07-19)

머지 커밋 `e12f17fe1`. 88파일 `+1,154/−4,712`. **DB 마이그레이션 0건**(클라 전용, OTA 가능).

## 왜 지웠나 (PR#276 본문)

- **동선**: 로그인 착지가 홈 → 일하러 온 사장·스태프가 대시보드를 한 번 경유.
- **중복**: 스태프 위젯이 스케줄 탭과 어휘 중복. 코드 주석이 자백 상태였음(`app/(app)/(tabs)/schedule.tsx`).
- **비용**: 홈 전용 15파일 1,291줄 + 진입 시 위젯 6개 동시 로딩(Realtime 구독·4-fan out·InfiniteQuery).
- `TODOS.md`(2026-04-16 plan-eng-review)가 발견성 문제와 lazy 로딩 필요성을 이미 지적했으나 둘 다 미구현 방치. 실사용자 0 → YAGNI 판정.

**의도적 손실**(재제기 방지): 사장 횡단 집계 3종(새 지원자 합계·정산 합계·주간 요일별) + 스태프 월별 정산. 기존 결정 "홈 스트립은 사용 신호 후로 유예"와 일치. 요구가 실제로 오면 `employer.tsx`에 신축한다.

## ★ 핵심 교훈 1 — 위젯이 결함을 가리고 있었다

**삭제 작업이 라이브 결함을 드러냈다.** DB 트리거 `fn_notify_cancellation_request`(`uniqn-mobile/supabase/migrations/20260711030000_notify_cancellation_request_recipients.sql`)가 사장에게 쏘는 `'cancellation_requested'` 타입이 클라이언트 `NotificationType`에 **미등록** → **푸시는 도착하는데 탭하면 딥링크가 죽는** 상태였다. 홈의 취소요청 위젯이 이 경로를 덮어 증상을 은폐하고 있었다.

삭제의 근거 자체가 *"알림이 커버하니 위젯을 지운다"*였으므로 **선행 BLOCKING 수정**으로 최선두 커밋에 배치했다. 트리거가 `link` 컬럼을 쓰지 않고 `data.jobPostingId`를 제공함을 확인 → **클라 라우트맵 추가만으로 해결, 마이그 0건**.

**코드로 검증됨**(머지 후 실측):
- `uniqn-mobile/src/types/notification.ts:36` — `CANCELLATION_REQUESTED: 'cancellation_requested'`
- `uniqn-mobile/src/shared/deeplink/types.ts:36` — `DeepLinkRoute` 유니온에 `employer/cancellation-requests` variant **신규**(아예 없었음 → types + RouteMapper + serializer 동반 추가 필요)
- `uniqn-mobile/src/shared/deeplink/RouteMapper.ts:98` · `NotificationRouteMap.ts:38`(`data.jobPostingId` 소비)

> **클래스 귀속**: 이건 [[enum-divergence]]의 새 인스턴스다 — 서버가 생산하는 값이 클라 유니온에 없어 조용히 증발. 기존 인스턴스와 다른 점은 **UI 위젯이 우회 경로로 증상을 마스킹**해 발견이 늦었다는 것. 삭제·정리 작업은 이런 마스킹을 걷어내는 부수 효과가 있다.

## ★ 핵심 교훈 2 — 리뷰 도중 base가 낡아졌다 (stale-base)

5축 최종 리뷰 진행 중 master가 **#273(닉네임 검색 통일)로 전진**해 이 브랜치의 base가 낡았다. **낡은 base 위의 green을 그대로 승인할 뻔했다.**

재통합 후 실제로 게이트가 깨졌다 — knip 래칫이 red. 즉 stale-base green은 **거짓 green이었다**:
- 래칫 이력: `2209`(master 기준 이미 red, 실측 2213) → PR 내 정합 `2210` → **#273 재통합 후 `2214`**(2213 red / 2214 green red-green 실측). 현행 **코드로 검증됨**: `uniqn-mobile/package.json:16` = `knip --max-issues=2214`.
- 텍스트 충돌 0, `tsc --noEmit` exit 0(의미적 충돌 없음)이었으나 게이트만 red — **타입 체크 통과가 base 신선도를 보증하지 않는다**.

또한 squash 저장소 특유의 merge-base 함정: 재통합 전 PR diff가 101파일 `+3,218`로 부풀어 있었다(이미 머지된 #268/#269 내용 재포함). `git merge origin/master` 후 정상화. 충돌 9건은 지시서 예상(5건)을 초과했는데, 원인은 우리 삭제 vs master의 *다른* 死코드 삭제(`updateWorkTime` 체인)가 꼬리를 공유한 교차였다.

> [[knip-signal-hygiene]]의 stale-base 안전망 조항이 여기서 실효를 입증했다. 규율: **머지 직전 master 재통합 + 게이트 재실행**은 선택이 아니다.

## ★ 핵심 교훈 3 — 회귀 가드가 삭제된 래퍼에 얹혀 함께 소실

`calculateScheduleStats`는 **보호 대상으로 명시 보존**된 실로직인데(스케줄 탭에 라이브 렌더), 그 회귀 가드 2건이 삭제된 래퍼 `getScheduleStats`의 `describe` 블록 안에 얹혀 있어 **래퍼와 함께 조용히 소실**됐다 → 실로직 커버리지 0. 리뷰가 검거해 **순수 함수 직접 호출로 이식 + red-green 검증**.

**코드로 검증됨**: 실로직 `uniqn-mobile/src/services/work/scheduleService.ts:225` 생존, 가드는 `src/services/work/__tests__/scheduleService.test.ts:884` `describe('scheduleService - calculateScheduleStats')`로 독립 이관(:892·:905에서 순수함수 직접 호출).

> **일반 규칙**: 래퍼를 지울 때 **그 래퍼의 describe 안에 보호 대상 실로직의 단언이 살고 있는지** 확인하라. 테스트 파일 삭제/축소는 커버리지 이동을 동반해야 하며, 이건 [[test-seed-contract-drift]]의 *vacuous green* 과 형제 관계다 — 저쪽은 시드가 죽어 조용, 이쪽은 가드 자체가 증발해 조용.

## 계획이 틀렸던 곳 (SDD가 잡음)

- e2e 파손이 계획 예상(1스펙)보다 훨씬 넓었음 — 로고 셀렉터 5파일 8곳 + 홈 렌더 전제 7파일 + `내 지원 현황` 셀렉터 사멸(hard 단언 4곳).
- **삭제한 테스트 9개 중 1개는 오답**: `home-navigation-staff`의 "앱 진입 시 홈 대시보드 표시"는 이름과 달리 **살아있는 동작**(`uniqn-mobile/src/hooks/useAuthGuard.ts` `/` 부팅 착지 = 이 PR이 바꾼 바로 그 대상)을 검증하고 있었다. 대체 커버리지 0 → `uniqn-mobile/e2e/tests/p1-important/root-boot-landing.spec.ts` 신설로 복원(**파일 실재 확인됨**).
- `appHome` 참조가 계획 지목 2곳 외 2곳 더(`appendRedirectToRoute` 도달불가 분기 + `AppLayout.test.tsx` mock — 타입에러 없이 조용히 깨지는 자리).

## 검증 (전부 메인 세션 직접 실행)

정적: `npm run quality` exit 0 · `npx jest` **485 스위트 / 5,550~5,561 테스트 전량** · `npm run knip:gate` exit 0 · 잔존 참조 grep 0.
실행 관찰(로컬 웹 + playwright 실브라우저): 로그인 → **URL `/home-jobs`** 착지 · 헤더 로고가 접근성 트리에서 `generic`(버튼 아님, QR·알림만 `button`) · 프로필에 "대시보드" 없음 · 콘솔 에러 0.
최종 5축 리뷰(pointerEvents 회귀·과잉삭제·머지 무결성·e2e 커버리지·딥링크 배선) **BLOCKING 0 · HIGH 0**.

**머지 후 잔존 상태 코드 실측**(본 위키 작성 시점): `app/(app)/home` 디렉토리 부재 · `expo-linear-gradient` package.json 부재 · `appHome` 참조 0 · `home_dashboard_enabled` 참조 0.

## ⚠️ 배포 제약 — OTA 롤백이 단방향

`home_dashboard_enabled` **플래그가 삭제되면서 롤백 수단도 사라졌다**. `weekly_grid_enabled`·`ops_hub_enabled`와 달리 원격 `app_config` 백업이 없어 revert+OTA만 가능. 여기에 `expo-linear-gradient` **네이티브 의존성 제거**가 겹쳐, 이 커밋 이후 새 네이티브 빌드가 나가면 **이전 번들로 롤백 시 크래시**한다 → **OTA 확산 전 착지 실측 필수**.

**Edge Function 재배포는 갭을 해소하는 게 아니라 만든다**(반직관): `send-push-notification`의 소비부가 fail-open(`if (!category) return false`)이라 **재배포 전이 오히려 취소요청 푸시에 관대**하고, 재배포 후에야 카테고리 음소거를 존중한다. BLOCKING 아님, 연기 가능.

## 잔여 (사용자 게이트 — 주장, 미검증)

- 실기기 QA: 헤더 우측 액션 4종 터치(`TabHeader.tsx:113-115` `pointerEvents` `box-none`→`none`, TabHeader는 거의 모든 탭에 렌더) · **취소요청 알림 딥링크 실도달**(프로덕션 쓰기 필요해 미검증) · 고정공고 취소요청 케이스.
- p0 e2e 미실행 — `e2e/.env.test`가 **프로덕션 Supabase**를 가리켜 로컬 실행 보류, CI에서 확인.
- 후속 별건: 딥링크 **인바운드** 파서에 `cancellation-requests` variant 미등록(생산자 3곳 모두 프로덕션 호출자 0 → 현재 라이브 영향 0) · `home.page.ts` rename(구인구직 탭 오브젝트인데 이름이 Home — **삭제 금지**) · 알림 템플릿 `undefined` 삽입(호출자 0).

## 관련

- [[enum-divergence]] — `cancellation_requested` 미등록이 이 클래스의 신규 인스턴스(위젯 마스킹 변종)
- [[knip-signal-hygiene]] — 래칫 2209→2214 재정합 + stale-base 안전망 실증
- [[test-seed-contract-drift]] — "조용한 커버리지 상실" 형제 클래스(vacuous green vs 가드 증발)
- [[layers]] — 삭제된 홈 위젯이 살던 Presentation 레이어 + Service(`scheduleService`) 경계
- [[roles]] — 사장/스태프 위젯 분기(집계 3종은 employer, 월별 정산은 staff)
- [[codebase-cleanup-2026-07]] — 같은 분기의 선행 정리(死코드 −3,464줄, "호출 0" 전수 grep 프로토콜)
