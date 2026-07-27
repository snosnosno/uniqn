# 내 스케줄 탭 완성도 — 다음 세션 핸드오프 (2026-07-27)

## 착수 위치

```
워크트리: C:\Users\user\Desktop\T-HOLDEM-schedule
브랜치:   feat/schedule-completeness
HEAD:     e4b94beed (베이스 f8c3acb11 = master 시점)
상태:     커밋 8개 전부 로컬, push·PR 미실행
```

node_modules 정션은 이미 걸려 있다. 작업 디렉토리는 `uniqn-mobile/`.

## 이번 세션에서 끝낸 것

6렌즈 UX 감사(62건 확증 / 7건 반증 폐기, 41개 실행 항목) 중 **P0 5건 + P1 15건 + P2 11건 = 31건**.

| 커밋 | 내용 |
|---|---|
| `a6138c175` | P0 5종 — 0원 렌더 크래시 · 딥링크 영구 사망 · 월 데이터 소실 · 정반대 안내 · 허구 급여 |
| `8d15a3721` | 오늘 중심 재편 — 다음 근무 히어로 · 시간축 2섹션 · 월 이동 선택일 복구 |
| `9ae052126` | 돈 신뢰 — 통계 단위 통일 · 정산 완료/예정 분리 · 확정 급여 · 지급 상태 |
| `2cbc4e010` | 길찾기 · 토스트 스크린리더 · 에러 표면 · 취소 낙관 갱신 · 그룹 카드 a11y |
| `b515876cd` | 월 경계 연속근무 · 더블부킹 경고 · 캘린더 44px/한국어 a11y |
| `5af7dbc56` | 근무 리마인더 배선 |
| `d7fcde0f6` | P2 퀵윈 9종 |
| `e4b94beed` | 취소 요청 재진입 가드 |

마지막 검증(HEAD 기준): `tsc --noEmit` exit 0 · lint 0 errors(경고 86, 시작 시점 88) ·
prettier clean · jest **550 스위트 / 6129 테스트 전부 통과**.

## 남은 작업 — 이 순서로

선행관계가 있다. **35 → 29 → 41** 은 순서를 지킬 것.

### 1. rank35 (P2/M) 노쇼가 '취소'로 뭉개진다 — 가장 무겁다

구인자가 무단결근으로 처리해도 스태프에겐 "이 일정이 취소되었습니다"만 뜬다.
평판·정산에 불리한 기록이 남은 걸 **본인만 모르고** 이의 제기 기회를 놓친다.
P2 중 유일하게 "사용자가 불이익을 모르는" 축이라 먼저 한다.

- 근인: `src/domains/schedule/StatusMapper.ts:43-45` 가 `CANCELLED` 와 `NO_SHOW` 를
  모두 `SCHEDULE.CANCELLED` 로 접는다.
- 방향: `ScheduleType` 에 `no_show` 를 추가하거나, 최소한 `ScheduleEvent` 에 원본
  workLog status 를 보존한다. 렌더 지점 3곳: `ScheduleCard.tsx`(취소 배너),
  `tabs/WorkTab.tsx`, `tabs/SettlementTab.tsx`.
- ⚠️ `ScheduleType` 을 늘리면 `Record<ScheduleType, …>` 매핑이 여러 곳에 있다
  (`CalendarView.SCHEDULE_DOT_COLORS` / `DOT_PRIORITY` / `countSchedulesByType` /
  `SCHEDULE_STATUS_STRIPE_TONE` / `SCHEDULE_TYPE_LABELS`). 타입체커가 전부 잡아주니
  `npx tsc --noEmit` 을 나침반으로 쓸 것.

### 2. rank29 (P2/M) 상태 색 언어가 화면마다 다르다

카드 배지가 상태 무관 골드 고정이라 "확정된 게 뭐지"를 글자로 읽어야 하고,
상세로 들어가면 같은 상태가 초록·노랑으로 바뀐다. impeccable §3(골드 화면당 3곳) 위반.

- `ScheduleCard.tsx` / `GroupedScheduleCard.tsx` 의 `<Badge variant="chip">` 을
  `variant={status.variant}` 로 바꿔 상세 모달과 색 언어를 통일.
- 상태→색 매핑을 `constants/statusConfig.ts` 의 `SCHEDULE_STATUS` 한 곳으로 모을 것.
  chip(골드)은 금액·CTA 전용으로 남긴다.

### 3. rank32 (P2/M) 오프라인이 "일정 없음"으로 위장된다

지하 홀덤펍·지하철 콜드스타트에서 확정 근무가 있는데도 "아직 예정된 스케줄이 없어요" +
동작 안 하는 '공고 둘러보기' 버튼이 뜬다.

- ① 스케줄 오프라인 캐시 TTL 을 staleTime(5분)에서 분리해 24시간 이상으로
  (`useSchedules.ts` 의 `useCachedSchedulePayload` ttlMs — 지금은 queryClient
  frequent 정책을 그대로 재사용 중).
- ② `isOffline && schedules.length === 0` 전용 빈 상태 신설.

### 4. rank36 (P2/M) 상세 3탭이 상태 무관 고정

지원 중이면 근무·정산 탭이 안내문뿐이라 헛탭 2번. 완료 건은 정보탭 '정산 현황'(확정액)과
정산탭 '총 정산'(재계산액)이 **서로 다른 숫자**로 병렬 노출돼 어느 게 받을 돈인지 모른다.

- `ScheduleDetailModal.tsx` tabs 배열을 `schedule.type` 기반으로 계산:
  applied/cancelled = 탭바 숨김 + 정보 단일, confirmed = 정보+근무, completed = 3탭.
- 금액은 **정산 탭을 단일 소스로**, InfoTab 의 '정산 현황'은 배지 + 안내로 축소.

### 5. rank31 (P2/M) 캘린더 모드 스켈레톤 부재

기본 뷰인데 로딩 중 빈 격자만 뜬다. 리스트 모드는 같은 순간 `ScreenSkeleton` 4행.
impeccable §16 위반. `CalendarView` 에 `isLoading` prop 추가.

### 6. rank37 (P2/M) 취소 다이얼로그에서 '아니오' → 상세로 못 돌아감

시트를 닫고 300ms 뒤 다이얼로그를 띄우는 `closeSheetThen` 체이닝 탓.
**근본 개선**: 시트 내부 인라인 2단 확인으로 바꾸면 체이닝 자체가 사라진다
(체이닝의 목적이 iOS 중첩 Modal 회피였으므로 인라인이면 제약이 없어진다).

### 7. rank40 (P2/S) 두 달력의 햅틱 규칙이 두 벌

규칙(impeccable §17: 일반 탭·리스트 선택·네비게이션 햅틱 금지) 기준으로
**스케줄 탭이 준수, 공고 달력이 위반**이다. 고칠 곳은 스케줄 탭 밖:
`CalendarHeader.tsx:40/46/51/102` · `CalendarCell.tsx:71` · `CollapsedHeader.tsx:33/38`.
이번 세션에서 "범위 밖"으로 남겨둔 항목 — 착수 전에 공고 달력 담당 변경과 겹치는지 확인.

### 8. rank41 (P2/S) 죽은 자산 3종 제거 — **반드시 마지막**

`ScheduleDetailSheet.tsx` · `WorkLogList.tsx` (둘 다 배럴에서만 export, 소비처 0 — 실측
확인함) · `getCalendarMarkedDates` 파이프라인(매 payload 계산 + MMKV 캐시까지 되는데 소비자 0).

- ⚠️ **선행조건**: 28(익일 표기)·14(지급 배지)는 이번 세션에 이식 완료. **35(노쇼)·29(색 SSOT)
  가 아직**이라 지금 지우면 참조가 사라진다. 위 1·2를 끝낸 뒤에 착수할 것.
- 코드 삭제는 고위험이라 `refactor-cleaner`(opus 고정) 경유 권장.

## 하지 말 것 (감사가 기각한 것 + 이번 세션 판정)

- **기기 캘린더 내보내기(expo-calendar)** — 네이티브 의존성 + 권한 + 양방향 동기화 비용이
  기능 가치를 넘는다. 리마인더 배선(완료)이 같은 문제를 훨씬 싸게 푼다.
- **취소 요청 철회 RPC** — 정원 재확보 경합·구인자 상태머신·알림까지 번지는 L 작업인데
  실제 빈도가 낮다. rank34(전화 CTA, 완료)로 막다른 길만 없앤 상태를 유지.
- **`realtime: true` 끄기** — 감사의 P0#3 1차 처방이었으나 **기각했다**. 실측 결과
  `WorkLogRepository.subscribeByStaffId` 만 noop shim 이고
  `subscribeByApplicantIdWithStatuses` 는 진짜 실시간이라, 끄면 구인자 확정의 라이브
  반영을 잃는다. 대신 `utils/scheduleRealtimePreference.ts` 가드로 해결했다.
- **주소 클립보드 복사** — `expo-clipboard` 미설치. 심사 중 네이티브 의존성 추가는
  리빌드를 유발하므로 보류(길찾기는 expo-linking 만으로 구현 완료).
- **timeSlot 정규화 강화·그룹 카드 진행 바·스태프 전용 정산 화면** — 감사 `notRecommended`.

## 이번 세션에서 배운 것 (다음 세션도 그대로 밟는다)

- **타입체커를 설계 검증으로 쓸 것.** `ScheduleEvent.status` 는 `WorkLogStatus` 가 아니라
  `AttendanceStatus`(`not_started|checked_in|checked_out`)다. `'scheduled'` 로 판정하면
  영원히 매치되지 않는다. `startTime` 은 `Date` 라 문자열 비교 정렬이 조용히 깨진다.
  둘 다 `tsc` 가 잡았다.
- **기존 테스트가 결함 동작을 고정하고 있을 수 있다.** 이번에 8건을 갱신했다
  ("월을 옮겨도 선택일이 이전 달에 남는다" 등). 테스트가 빨개지면 먼저
  "이 테스트가 지키는 게 사용자에게 좋은 동작인가"를 물을 것.
- **부분 mock 은 새 export 를 놓친다.** `src/__tests__/hooks/useSchedules.test.ts` 가
  `@/utils/scheduleGrouping` 을 부분 mock 해서, 새 순수 함수를 훅에 배선하자마자
  "is not a function" 으로 5건이 터졌다. 그룹핑/시간 유틸에 함수를 추가하면 이 mock 부터 볼 것.
- **python heredoc 치환 주의.** `\n` 이스케이프가 실제 개행으로 바뀌어 TS 문자열이 깨졌다.
  줄바꿈이 들어가는 문자열은 Edit 도구로 직접 고칠 것. 치환 대상이 여러 번 등장하면
  라인 인덱스로 특정할 것(테스트 파일에서 한 번 잘못 짚었다).

## 사람이 해야 하는 게이트 🔴

1. **실기기 QA** — 로컬 알림 실제 발사(Jest 는 예약 *계획* 로직까지만 검증) · 캘린더 44px
   터치 · iOS VoiceOver 토스트 낭독 · 지도 앱 연동(네이버/카카오 폴백) · 월 경계 그룹 표기
2. **push / PR** — 커밋 8개 전부 로컬
3. **머지 후 정리** — `GroupedScheduleCard` 의 reduce motion 을 애니메이션 브랜치
   (`ab097c0fc`)의 공용 `useReduceMotion` 훅으로 교체. 지금은 중복 훅 생성을 피하려고
   `AccessibilityInfo` 를 직접 읽는다.

## 참고

- 감사 원본 41개 항목 전문:
  `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-T-HOLDEM\c1ed9b9b-c306-4816-8452-49a9d6173637\scratchpad\schedule-ranked.md`
  (세션 스크래치패드 — 사라졌으면 이 문서의 요약으로 충분하다)
- 검증 명령: `cd uniqn-mobile && npm run quality && npx jest --no-coverage`
