# Blocker 4건 — 출시 전 작업 계획 (2026-05-28)

> 컨텍스트: [`docs/analysis/uniqn-pub-tourney-gap-2026-05-28.md`](../analysis/uniqn-pub-tourney-gap-2026-05-28.md) 우선순위 매트릭스 H/S 4건.
> 전제: Expo 55 / RN 0.83.4 / Supabase / 모바일+웹 동시 배포(EAS OTA + Cloudflare Pages).
> **재평가**: 분석 보고서에서 #1·#4를 "Small"로 분류했으나, 실제 grep 결과 #1=22 파일(픽스처 포함), #4=19 파일(소비처)이라 **실 작업 분량은 Medium**. 그래도 mechanical/타입체커가 잡아주므로 각 0.5~1일.

## 머지 순서 요약

```
B1 (취소 사유)   ─┐
B2 (자정 슬롯)   ─┼──> 모두 독립. 병렬 PR 가능.
B3 (포커룸 카피) ─┤
B4 (discriminator)┘
```

**병합 권장 순서**: B4(타입 정합) → B1·B2·B3(병렬). B4 먼저인 이유: schedule 타입에 닿는 파일을 B2도 손대므로 B4 머지 후 B2 베이스를 재정렬하면 충돌 0.

---

## B1. Fixed 공고 취소 차단 사유 노출

### 문제
`app/(app)/jobs/[id]/index.tsx:160–163` `canRequestCancel = !isFixed && status === CONFIRMED && !취소요청`. false면 라인 217–223에서 버튼 자체가 렌더 안 됨 → 사용자는 "왜 못 취소하는가" 정보 0줄. 라인 200–204의 `getApplicationStatusMessage(...)`는 상태만 알려주고 사유는 침묵.

### 영향 파일
- `app/(app)/jobs/[id]/index.tsx` (라인 200–225 alreadyApplied 분기)
- `src/utils/getApplicationStatusMessage.ts` 또는 메시지 상수 위치(확인 필요)
- `src/components/jobs/__tests__/JobDetailScreen.test.tsx` 또는 신규 테스트

### 구현 단계
1. `canRequestCancel` 조건이 false인 사유를 enum/유니온으로 모델링:
   - `fixed_posting` → "장기 근무 공고는 앱에서 취소할 수 없어요. 사업주에게 직접 문의해주세요."
   - `not_confirmed_yet` → 이미 메시지로 노출됨, 추가 안내 불필요
   - `pending_request` → "이미 취소 요청이 접수되어 검토 중입니다."
2. `jobs/[id]/index.tsx:200–225` `alreadyApplied` 분기 안에 `canRequestCancel=false && isFixed`일 때 작은 안내 텍스트 1줄 추가.
3. 카피 작성은 [[impeccable-design]] 룰 10(무엇+왜+어떻게) 준수: "장기 알바는 앱 취소 불가 — 사업주 연락 필요".

### 테스트 방법
- Unit: `JobDetailScreen.test.tsx`에 4가지 분기(`fixed+confirmed`, `dated+confirmed+canCancel`, `confirmed+pendingRequest`, `applied`) 스냅샷/텍스트 매칭.
- 수동: dev 빌드에서 fixed seed 1건 confirmed 상태로 진입 → 안내 텍스트 노출 확인.
- Regression: 기존 `canRequestCancel=true` 경로 "취소 요청" 버튼 노출 유지 확인.

### 리스크
- **낮음**. UI 텍스트 추가만, RPC/DB 무관.
- 다국어 잠재 충돌(현 앱 한글 단일이라 무관).

### 예상 소요
- 코드: 0.5h
- 테스트: 0.5h
- QA: 0.5h
- **합계 1.5h**

### 빌드/배포
- 웹: Cloudflare Pages 자동 배포(push → preview → master merge).
- 모바일: EAS OTA(`eas update --branch production`) — 네이티브 코드 변경 없어 store release 불필요.

---

## B2. 자정 넘는 시간대 표시 (`crossesMidnight`)

### 문제
`src/types/unified/timeSlot.ts:20–41` `startTime`/`endTime` HH:mm 0~23시 가정. 홀덤펍 운영 18:00–익일 04:00가 표준이지만 현 스키마는 자정에서 분단. 표시 헬퍼 `formatTimeSlotDisplay`(라인 100–114)도 단순 `${start} ~ ${end}`만.

### 영향 파일
**Type 정의 & 헬퍼**
- `src/types/unified/timeSlot.ts` (필드 추가 + factory + format)
- `src/types/unified/__tests__/timeSlot.test.ts`(없으면 신규)

**소비처 (자정 인접 슬롯 계산)**
- `src/utils/schedule/*` 시간 차이 계산 유틸(있다면)
- 정산 계산 시급 산출 위치 — `src/utils/settlement/*`, work_log 시간 diff 로직 점검
- `src/components/job/posting/cards/TimeSlotCard.tsx` 입력 UI(옵션 토글 추가)
- `src/components/schedule/ScheduleCard.tsx` 표시(`익일 04:00` 출력)

**DB**
- `job_postings.schedule` jsonb 안 `timeSlots[].crossesMidnight: boolean` 필드 — 마이그레이션 **불필요**(jsonb 자유). 단, 읽기 시 기본값 `false` 흡수.

### 구현 단계
1. `TimeSlotInfo`에 `crossesMidnight?: boolean` 옵셔널 추가(default false).
2. `formatTimeSlotDisplay`에서 `crossesMidnight && endTime`일 때 `"${start} ~ 익일 ${end}"` 출력.
3. `createTimeSlotInfo` factory에 옵션 패스스루.
4. **시급 계산 정합성**: work_log duration 계산 로직 grep(`durationMin|workHours|diffMinutes`), `endTime < startTime`이면 +24h 보정 helper 추가 또는 기존 로직 수정.
5. UI: `TimeSlotCard`에 "자정을 넘어서요" 토글 추가(endTime이 startTime보다 작을 때 자동 제안).
6. Posting 작성 → 저장 → 조회 round-trip 단위 테스트.

### 테스트 방법
- Unit:
  - `formatTimeSlotDisplay({ startTime:'18:00', endTime:'04:00', crossesMidnight:true })` → `"18:00 ~ 익일 04:00"`.
  - 시급 계산: 18:00→익일 04:00 = 10h(현행은 -14h 또는 NaN일 수 있음, Red→Green).
- Integration: 공고 작성 → fetch → 표시까지 jsonb round-trip.
- 수동: dev에서 야간 슬롯 공고 등록 → 스태프 앱 ScheduleCard 표시 확인.

### 리스크
- **중간**. 시급 계산 수정은 **정산 금액에 직접 영향**.
- 마이그레이션: 기존 데이터에 `crossesMidnight` 없음 → 읽기 시 `?? false`로 안전 흡수.
- legacy: 기존 야간 공고가 "다음날 04:00"을 description 자유텍스트로 우회 입력한 경우, 마이그레이션 없이는 자동 변환 불가 — **출시 V1에선 신규 공고만 적용, legacy는 그대로 둠**으로 범위 한정.

### 예상 소요
- Type+포맷터: 1h
- 시급 계산 수정 + 테스트: 2h
- UI 토글: 1h
- E2E 수동 검증: 1h
- **합계 5h** (0.5일+)

### 빌드/배포
- 웹: Cloudflare 자동.
- 모바일: EAS OTA. JS-only 변경(jsonb 스키마 변경 없음).

---

## B3. role.ts "포커룸" 표현 정리 → 타깃 시장 정렬

### 문제
`src/types/role.ts:14, 89` 한글 주석 "포커룸에서의 업무 역할" 표현이 [[project_target_market_pivot]](타깃=홀덤펍+대회사) 와 모순. `grep 포커룸` 결과 **22개 파일** 매치 — 단순 주석 정리가 아닌 카피 마이그레이션.

### 영향 파일 (22건)
**Source**
- `src/types/role.ts:14, 89` (JSDoc/inline 주석)
- `src/hooks/useWorkLogs.ts` (확인 필요)
- `src/repositories/interfaces/IWorkLogRepository.ts`

**Design system**
- `DESIGN.md` (디자인 가이드 카피)

**Test fixtures (10건)**
- `e2e/factories/job.factory.ts`
- `e2e/tests/p0-critical/cancellation-lifecycle.spec.ts`
- `e2e/tests/p0-critical/e2e-user-journeys.spec.ts`
- `e2e/tests/p1-important/public-pages.spec.ts`
- `e2e/tests/p1-important/employer-posting-crud.spec.ts`
- `e2e/tests/p1-important/employer-settlement.spec.ts`
- `e2e/tests/p1-important/job-detail-apply.spec.ts`
- `e2e/tests/p1-important/employer-collaborator-add.spec.ts`
- `e2e/tests/p1-important/collaborator-shared-postings.spec.ts`
- `e2e/tests/p1-important/employer-applicants.spec.ts`
- `e2e/tests/p1-important/collaborator-self-leave.spec.ts`

**Unit test fixtures**
- `src/components/workspace/__tests__/WorkspaceRevocationModal.test.tsx`
- `src/schemas/__tests__/workspace.schema.test.ts`
- `src/components/home/widgets/__tests__/RecentNoticesWidget.test.tsx`
- `src/components/home/widgets/__tests__/NextWorkWidget.test.tsx`
- `src/services/jobs/__tests__/searchService.test.ts`

**DB migration seeds**
- `supabase/migrations/20260525040000_align_applicant_role_to_staff_role.sql`
- `supabase/migrations/20260420142758_qa_fix_ej002_seed_weekend_staff_template.sql`

### 구현 단계
1. **카피 치환 규칙 결정** (문서화):
   - `포커룸` → 컨텍스트별 분기
     - "역할 정의 컨텍스트": **"매장에서의 업무 역할"** (포커룸 → 매장)
     - "사용자 노출 카피": **"홀덤펍·대회"** (예: "홀덤펍 알바 둘러보기")
     - "테스트 fixture name": **"홀덤펍 OO"** 또는 그대로 두되 주석 추가
2. 파일 그룹별 PR 분리 권장:
   - **PR-3a**: source + DESIGN.md (5 파일, 사용자 노출 영향)
   - **PR-3b**: test fixtures (15 파일, 사용자 무관 — review 부담 ↓)
   - **PR-3c**: DB seed migration (2 파일 — 단, **기존 prod 마이그레이션은 수정 금지** [[feedback_supabase_migration_workflow]]. 신규 마이그레이션으로 데이터 update 또는 그대로 둠)
3. `role.ts:14, 89` 주석에 `// v2.2.0 - 매장(홀덤펍/대회장) 업무 역할로 정의 확장` 추가.
4. 카피 변경은 [[project_legal_documents_single_source]] 패턴 참고(약관/정책 단일 소스 모델 확장 검토).

### 테스트 방법
- 자동: `npm test` + `npm run quality` 전 grep `포커룸` 잔존 0건 확인.
- E2E: 픽스처 이름 변경 → review-account 시드 영향 0건 확인(`e2e/factories/job.factory.ts`).
- 수동: 앱 검색·홈·온보딩 화면 텍스트 시각 검수.

### 리스크
- **낮음** (카피 변경) + **중간** (DB seed 마이그레이션 — prod 적용된 파일 수정 금지 룰).
- E2E fixture 변경 시 review-collaborator 시드와 키 매칭 깨질 위험 → 시드 재실행 필요할 수 있음 [[project_e2e_review_accounts]].
- 출시 마케팅 카피와 일치성: 앱 스토어 설명/스크린샷의 한글 카피도 동시 정리(별도 트랙).

### 예상 소요
- PR-3a (source+DESIGN): 1h
- PR-3b (테스트 fixtures): 1h (mechanical sed)
- PR-3c 결정/검토: 0.5h
- 코드 리뷰 응답: 1h
- **합계 3.5h**

### 빌드/배포
- 웹: Cloudflare 자동.
- 모바일: EAS OTA(텍스트 변경).
- 마이그레이션은 prod 미적용분만 신규 작성.

---

## B4. `schedule.kind` ↔ `schedule.type` discriminator 통일

### 문제
- 문서(DB) 레이어: `PostingDatedSchedule.kind: 'dated'` (`src/types/jobPosting.ts:98, 105`)
- 정규화(UI) 레이어: `DatedScheduleInfo.type: 'dated'` (`src/types/unified/schedule.ts:31, 47`)

동일 개념·다른 키 → 신규 개발자 인지 부조화 + 양쪽 동시 사용 시 버그. **`kind`로 통일 권장** (문서가 source of truth, prod DB 컬럼과 일치).

### 영향 파일 (소비처 19건)
**Type 정의**
- `src/types/unified/schedule.ts` (interface + type guards + factories)
- `src/types/unified/index.ts` (re-export)
- `src/types/unified/__tests__/schedule.test.ts` (테스트)

**소비처 (rename 대상 .type → .kind)**
- `src/utils/normalizers/scheduleNormalizer.ts`
- `src/components/schedule/ScheduleCard.tsx`
- `src/hooks/useSchedules.ts`
- `src/components/schedule/tabs/WorkTab.tsx`
- `src/components/schedule/ScheduleDetailModal.tsx`
- `src/components/schedule/tabs/SettlementTab.tsx`
- `src/components/schedule/tabs/InfoTab.tsx`
- `src/components/schedule/ScheduleDetailSheet.tsx`
- `src/utils/assignment/selectionUtils.ts`
- `src/services/work/scheduleService.ts`
- `src/services/work/__tests__/scheduleService.integration.test.ts`
- `src/components/schedule/CalendarView.tsx`
- `src/utils/scheduleGrouping.ts`
- `src/hooks/useJobSchedule.ts`
- `src/domains/schedule/ScheduleMerger.ts`
- `src/domains/application/__tests__/selectionUtils.test.ts`

### 구현 단계
1. **rename 안 결정**:
   - `schedule.type` → `schedule.kind` (DB와 일치, jobPosting.ts와 정합)
   - 단, `NormalizedScheduleList.type` (`unified/schedule.ts:75`)도 `kind`로 일관 변경.
2. **mechanical 전환 작업**:
   - `unified/schedule.ts`에서 interface `DatedScheduleInfo`/`FixedScheduleInfo`/`NormalizedScheduleList`의 `type:` 필드를 `kind:`로 rename.
   - Factory `createDatedSchedule`/`createFixedSchedule` 반환 객체도 `kind`로.
   - Type guard `isDatedSchedule`/`isFixedSchedule` 내부 `schedule.type ===` → `schedule.kind ===`.
3. **소비처 일괄 변경**:
   - TypeScript 컴파일러가 모든 호출처를 빨갛게 잡아줌. `tsc --noEmit`이 마이그레이션 진행률.
   - 17개 소비 파일에서 `.type` 접근을 `.kind`로 일괄 치환(에디터 multi-cursor / `sed`).
4. **테스트 갱신**:
   - `unified/__tests__/schedule.test.ts`, `selectionUtils.test.ts`, `scheduleService.integration.test.ts`.
5. **순서 보장**: 다른 의미의 `.type` 필드(예: `application.type`, `notification.type` 등)와 충돌 없는지 grep으로 확인. `unified/schedule` 모듈 import 위치만 식별.

### 테스트 방법
- 자동:
  - `tsc --noEmit` 0 errors (1차 게이트).
  - `npm test` 전체 pass.
  - `npm run quality` (type-check + lint + format) pass.
- 수동: dev 빌드 → 스케줄 탭 진입 → fixed/dated 양쪽 공고에 confirmed 1건씩 두고 표시 정상.

### 리스크
- **낮음** (mechanical rename, 타입체커가 누락 잡음).
- 잠재 미스: 직렬화된 JSON에 `type:` 키가 있다면(예: 캐시·MMKV) 마이그레이션 필요 — 확인 필요. **현 unified는 in-memory 변환 결과라 DB·캐시 직접 직렬화 없음**으로 추정, grep으로 재확인.
- 외부 의존: jobPosting.ts `kind`는 이미 prod DB와 정합이라 무영향.

### 예상 소요
- Rename: 1h (mechanical)
- 테스트 갱신: 1h
- tsc/quality 통과 보정: 1h
- E2E 수동: 0.5h
- **합계 3.5h**

### 빌드/배포
- 웹: Cloudflare 자동.
- 모바일: EAS OTA(JS-only 타입 변경, 런타임 영향 없음).

---

## 통합 머지·배포 순서

### 1단계 — 로컬 브랜치 4개 생성 (병렬)
```
fix/launch-blocker-b1-fixed-cancel-reason
fix/launch-blocker-b2-crosses-midnight
chore/launch-blocker-b3-target-market-copy
refactor/launch-blocker-b4-schedule-discriminator
```

### 2단계 — PR 머지 순서 권장
1. **B4 먼저** — discriminator 통일. mechanical, 타입체커 게이트.
2. **B1·B2·B3 병렬** — 서로 독립. B2가 schedule.kind 접근하면 B4 머지 후 rebase.

### 3단계 — 통합 검증
- `master`에 4건 머지 완료 → `npm run quality && npm test` 통과.
- 수동 QA(dev 빌드): 공고 작성→지원→확정→스케줄 표시 전 흐름 1회.

### 4단계 — 배포
- **웹**: master push → Cloudflare Pages 자동(2~3분).
- **모바일 EAS OTA**:
  ```
  cd uniqn-mobile
  NODE_ENV=production eas update --branch production --message "출시 전 blocker 4건 반영"
  ```
  ⚠️ [[pitfall_eas_update_shell_env_not_loaded]] 주의 — `NODE_ENV=production` 명시 필수, `android/` 폴더는 OTA 전 임시 mv [[pitfall_fixed_schedule_strict_parse_kills_backcompat]] (메모 발췌).

### 5단계 — 출시 후 모니터링 (24h)
- Sentry: 새 에러 0건 확인(특히 `schedule.type undefined` 같은 잔재 참조).
- 스토어 리뷰: 카피·취소 안내 관련 피드백.
- 정산 정확성: B2 시급 계산 첫 정산 사이클에서 야간 슬롯 결과 spot-check.

---

## 출시 일정 (기준일 2026-05-28 목요일)

| Day | 작업 |
|-----|------|
| D+0 (목) | B4 PR 생성·CI 통과·리뷰 |
| D+1 (금) | B4 머지 → B1/B2/B3 PR 동시 생성 |
| D+2 (토) | B1·B3 머지(주말 저위험), B2 정산 검증 |
| D+3 (일) | B2 머지·통합 QA |
| D+4 (월) | EAS OTA + Cloudflare 배포 + 24h 모니터링 시작 |
| D+5 (화) | 출시 게이트 통과 → V1 정식 출시 |

**총 작업 시간 합계: 13.5h** (B1 1.5 + B2 5 + B3 3.5 + B4 3.5). 1인 풀 점유 시 2 영업일, 다른 작업과 병행 시 3~4일.

---

## 의존성 & 잠재 충돌

- **B2 ↔ B4**: B2가 `TimeSlotInfo` 변경, B4는 `DatedScheduleInfo`. 둘 다 `unified/` 디렉토리지만 다른 파일이라 충돌 없음. B4를 먼저 머지하면 더 안전.
- **B3 ↔ E2E**: B3가 fixture 이름 변경 시 review-account 시드에 영향 가능 [[project_e2e_review_accounts]]. 시드 재실행 또는 fixture만 변경하고 시드는 유지하는 전략 선택.
- **B1 ↔ 다른 PR**: 독립적. 충돌 0.

---

## 체크리스트 (PR 머지 전)

각 PR마다:
- [ ] `tsc --noEmit` 0 errors
- [ ] `npm run quality` 통과
- [ ] `npm test` 통과
- [ ] 수동 QA 1회
- [ ] PR body에 영향 파일·테스트 결과·롤백 방법 명시
- [ ] [[feedback_master_direct_push_bypasses_e2e]] — master 직접 push 금지, PR 경유

배포 직전:
- [ ] master HEAD에 4건 모두 반영 확인
- [ ] Sentry 전일 대비 에러율 비교 베이스라인 캡처
- [ ] EAS OTA 채널=production 명시
- [ ] [[pitfall_eas_update_shell_env_not_loaded]] env 로딩 확인

---

## 출처 인덱스

- 분석 보고서: `docs/analysis/uniqn-pub-tourney-gap-2026-05-28.md`
- 코드 라인: `src/types/role.ts:14,89,100`, `src/types/unified/timeSlot.ts:20–114`, `src/types/unified/schedule.ts:22–148`, `src/types/jobPosting.ts:97–112`, `app/(app)/jobs/[id]/index.tsx:139–225`.
- grep 결과: "포커룸" 22 파일, `schedule.type` 등 19 파일.
- 메모: [[project_target_market_pivot]], [[project_e2e_review_accounts]], [[pitfall_eas_update_shell_env_not_loaded]], [[feedback_master_direct_push_bypasses_e2e]], [[feedback_supabase_migration_workflow]].
