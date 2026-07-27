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

## 남은 작업 — ✅ 전부 완료 (2026-07-27 후속 세션)

P2 8건을 문서에 적힌 순서(35→29→32→36→31→37→40→41)대로 전부 처리했다.

> ⚠️ **작업 위치가 바뀌었다.** 착수 시점에 `T-HOLDEM-schedule` 워크트리에서 다른 세션이
> `weeklyGrid → workSchedule` 전면 리네임(131파일)을 미커밋 상태로 진행 중이었다.
> 커밋이 섞이지 않도록 `121bc26f9` 에서 분기해 격리했다:
> **워크트리 `C:\Users\user\Desktop\T-HOLDEM-schedule-p2` · 브랜치 `feat/schedule-completeness-p2`**

| 커밋 | 랭크 | 내용 |
|---|---|---|
| `ac23d66c0` | 35 | 노쇼를 취소와 분리 — `ScheduleType` 에 `no_show` 신설, 노쇼 사유 배선 |
| `76ea41a2e` | 29 | 상태 색을 `SCHEDULE_STATUS` 단일 소스로 (카드·JobCard·캘린더 점) |
| `bd379a5c6` | 32 | 오프라인 캐시 TTL 분리(24h) + 오프라인 전용 빈 상태 |
| `4d65679fc` | 36 | 상세 탭 상태별 구성 + 금액 정산 탭 단일화 |
| `9827474f0` | 31 | 캘린더 로딩 스켈레톤 |
| `fcdaaa23d` | 37 | 취소 확인을 시트 안 인라인 2단으로 |
| `d6a6e6a3d` | 40 | 공고 달력 햅틱 7곳 제거 (impeccable §17) |
| `c761a1c94` | 41 | 죽은 자산 3종 제거 |

최종 검증(HEAD 기준): `npm run quality` green(0 errors, 경고 86 — 시작 시점과 동일) ·
jest **549 스위트 / 6140 테스트 전부 통과**(스위트 −2·테스트 −12 는 rank41 이 지운 죽은 코드의 자체 테스트).

### 착수 전 문서와 실제가 달랐던 것

- `StatusMapper` 경로는 `src/domains/schedule/` 이 아니라 **`src/shared/status/StatusMapper.ts`**.
- rank35 의 진짜 사각지대는 `Record<ScheduleType,…>` 8곳이 아니라 **타입체커가 대조하지
  않는 런타임 경계**였다: `schemas/schedule.schema.ts` 의 zod enum 이 하드코딩 4값이라
  신규 상태가 파싱에서 조용히 drop 될 수 있었다. `SCHEDULE_TYPE_LABELS` 에서 파생시켜
  드리프트를 성립 불가로 만들었다. 테스트 픽스처(`MockScheduleEvent.type`)도 같은 사본이었다.
- rank35 는 **노쇼 사유까지 살릴 수 있었다.** `work_logs.no_show_reason` 은
  `workLogColumns`·`workLog.schema` 를 거쳐 스태프 조회 경로까지 이미 내려오는데
  `ScheduleConverter` 에서 버려지고 있었다. 사유 없이는 이의 제기 근거를 잡을 수 없다.
- rank41 의 `getCalendarMarkedDates` 는 "배럴만 죽은" 자산이 아니라 **쓰기는 살아있고
  읽기만 죽은** 파이프라인이었다(매 payload 계산 + MMKV 저장). 파일 삭제가 아니라
  4개 훅·payload 타입·테스트 3파일을 가로지르는 절개가 필요했다.
- rank41 의 `WorkLogList` 에는 2026-07-11 핸드오프에 **"삭제하지 말 것"** 이라는 반대
  결정이 있었다. 그 근거(M1 부활 후보)가 무효가 된 것을 확인하고 그 문서를 갱신했다.

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
   - P2 추가분: **노쇼 건 실제 렌더**(카드 배너·근무 탭 사유·정산 0원 도달) ·
     **기내모드 콜드스타트**(오프라인 빈 상태 + 24h 캐시 생존) · 상태별 탭 노출 ·
     취소 확인 '아니오' 복귀 · 캘린더 월 이동 스켈레톤 · 공고 달력 무진동
2. **push / PR** — 로컬 커밋 **16개**(기존 8 + P2 8). 두 브랜치가 갈렸다:
   `feat/schedule-completeness`(기존 8, 단 다른 세션의 리네임 작업이 얹혀 있음) ·
   `feat/schedule-completeness-p2`(P2 8, `121bc26f9` 분기). 머지 순서·합류 방식은 사람 판단.
3. **머지 후 정리** — `GroupedScheduleCard` 의 reduce motion 을 애니메이션 브랜치
   (`ab097c0fc`)의 공용 `useReduceMotion` 훅으로 교체. 지금은 중복 훅 생성을 피하려고
   `AccessibilityInfo` 를 직접 읽는다.

## 참고

- 감사 원본 41개 항목 전문:
  `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-T-HOLDEM\c1ed9b9b-c306-4816-8452-49a9d6173637\scratchpad\schedule-ranked.md`
  (세션 스크래치패드 — 사라졌으면 이 문서의 요약으로 충분하다)
- 검증 명령: `cd uniqn-mobile && npm run quality && npx jest --no-coverage`
