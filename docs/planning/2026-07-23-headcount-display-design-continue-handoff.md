# 핸드오프 — 인원카운트 표시 통일 설계 이어가기 (다음 세션 메인 프롬프트)

> 작성 2026-07-23 · 작업 디렉토리 `uniqn-mobile/` · 분석·설계 세션(코드 변경 없음, 스펙 1건만 커밋됨)
> 목적: **인원카운트 표시 방식 최종 결정 → 설계 문서 확정 → `/autoplan` 구현 계획**.
> 진행 스킬: `superpowers:brainstorming` 진행 중이었음(설계 확정 → writing-plans 가 종착).

---

## 0. 지금 상태 한 줄

설계는 **"자리(좌석) 기준 단일 소스"까지 확정**됐고, 마지막으로 **화면 표시 형식(분수 vs 남은자리 vs 요구+남은자리)** 하나만 사용자 선택 대기 중. 그 선택만 정해지면 스펙 갱신 → 구현 계획.

---

## 1. 이번 세션에서 이미 확정된 것 (재논의 불필요)

1. **데이터 = 자리 단일 소스**: 모든 숫자는 `자리 = (날짜·시간슬롯·역할) 한 칸`에서 파생.
   - 필요 자리 = 일정에서 `Σ GREATEST(count, headcount, 0)`
   - 채워진 자리 = `count_posting_confirmed_by_slot` → `usePostingFilledCounts` (cancelled·no_show 제외)
   - `schedule.roles[].filled`(SP3 dead counter, 항상 0)는 **표시·판정 어디서도 읽지 않음** — 3축 발산의 뿌리 차단.
2. **분자는 max(날짜별 확정), min 아님** — 확정됨. 근거: 통지원이라 `추가 수용 = 하루요구 − max(filled)`. min은 (5,1) 케이스에서 `1/5 모집중`으로 거짓말(아무도 확정 못 되는데 모집중). max는 `5/5 마감`으로 정직. min의 정보가치는 "가장 빈 날 경고"로 구인자 화면에서만 별도 활용.
3. **마감이어도 대기 지원 허용**(현행 정책 유지). ⚠️ **자동 승계 기능 없음**(지원상태 = `pending/approved/rejected`뿐, `src/types/application.ts` 확인) → 문구가 자동 배정 암시 금지.
4. **그룹 경계 통일 필수**: 카드(`utils/date/grouping.ts:209`, headcount 비교)와 지원화면(`utils/assignment/selectionUtils.ts` `getRoleStructureKey`, 역할종류만 비교)이 그룹을 다르게 묶음 → 단일 함수로.
5. **DB·서버 가드·저장형식 불변**: 이미 자리 기준 정합(§2.2/2.6 스캔). `get_venue_grid_summary`·`_total_positions_from_schedule`가 `schedule.roles[].count`(하루치)를 SQL에서 직접 파싱하므로 저장형식 **불변 필수**.

---

## 2. 마지막 미결정 (다음 세션 첫 액션) — 표시 형식 3안

사용자에게 물었으나 **답 받기 전 세션 종료**. 사용자가 직전에 "더 쉬운 방법 없나? 기존 설계 바꿔도 됨"이라 해서 **A안(남은 자리만)을 새로 제안**한 상태. 아래 3안 중 택1 받고 스펙 갱신.

예시 기준: 딜러 5명/일, 8/22에 2명·8/23에 1명 확정.

| 안 | 카드/상세 | 구인자 추가 | (5,1) 케이스 | 특징 |
|---|---|---|---|---|
| **A. 남은 자리만** (직전 추천) | `18:00 딜러 3자리 남음` | 없음(상세 `배정 현황 3/10`이 담당) | `5−5=0 → 마감` | 계산식 1개, 분모 없음, 기준혼동 원천소멸, 카드 안 길어짐 |
| **B. 요구 + 남은 자리** | `18:00 딜러 5명 · 3자리 남음` | 없음 | `딜러 5명 · 마감` | 몇 명 뽑는지도 보임, 분수 아님 |
| **C. 분수(현행 설계)** | `18:00 딜러 5명 (2/5)` | `자리 3/10 채움` 병기 | `5명 (5/5) 마감` + `자리 6/10` + `⚠8/23 부족` | 운영자와 동일표현이나 분자의미(가장 찬 날) 설명 필요·카드 길어짐 |

**추천 = A** (사용자가 "더 쉬운" 요청 → 분수 폐기가 가장 큰 단순화). A/B는 분모가 없어 "5명이야 10명이야?" 문제가 구조적으로 발생 불가.

⚠️ A/B 채택 시 스펙(§2.2, §4 예외매트릭스, §5 불변식)을 "남은 자리 = 하루요구 − max" 단일식으로 다시 씀. C 유지면 현행 스펙 그대로.

---

## 3. 산출물 위치

- **스펙(확정, 커밋됨 `c17600635`)**: `uniqn-mobile/docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md`
  - ⚠️ 현재 스펙은 **C안(분수+자리병기)** 기준으로 작성됨. A/B로 확정되면 §2.2·§3·§4·§5·§6·§9 갱신 필요.
- **비개발자 설명 아티팩트**: https://claude.ai/code/artifact/65e8cbe1-e1d9-44b7-aae4-da5bd6e8bdf7 (개념)
- **실제 화면 재현 아티팩트**: https://claude.ai/code/artifact/bbca627c-5e8e-452a-a74f-4cc9a0ff8857 (지금 vs 새 설계, 폰 목업 — 현재 하루기준+자리병기 반영본)

---

## 4. 코드 지도 (이번 세션 실측 — 라인 이동 가능, 스팟검증)

**표시 계층 (바꿀 곳)**
- `src/components/jobs/shared/postingSurfaceModel.ts:319-335` — 그룹 요약 곱셈 지점(`count=perDayCount×dayCount`, `filled=일별 합`). ← 여기를 분모=perDayCount, 분자=max(일별 filled) 또는 남은자리로.
- `src/components/jobs/shared/PostingScheduleContent.tsx:278` — `formatRoleLine` = `` `${role.label} ${role.count}명 (${role.filled}/${role.count})` ``. 표시 문법 진원지.
- `src/components/jobs/JobCard.tsx` · `PostingCardSurface.tsx` — 구직자 카드(hydrate 주입 O).
- `src/components/employer/posting/JobPostingCard.tsx` — 구인자 카드(footer 지원자/QR/마감하기, hydrate 주입 O).
- `app/(employer)/my-postings/[id]/index.tsx:472-486` — 구인자 상세 `배정 현황 filledPositions/totalPositions명`(이미 자리기준, 유지).
- `src/domains/job-posting/facts.ts:57` `buildPostingFacts` — roleAvailability가 dead counter(축C) 사용 → 지원 게이트 canApply 판정. hydrate 미주입.
- `src/domains/job-posting/selectors.ts:54,91` — `aggregateRoleFilledFromSubmap` + `selectPostingRoleAvailability(filledByRole?)` = 축B 주입 게이트.
- **지원화면 hydrate 미주입(핵심 결함)**: `AssignmentSelector.tsx:50` → `useJobSchedule`(축C, totalFilled 항상 0). 확정 집계 주입 필요.
- 그룹 경계: `utils/date/grouping.ts:209` vs `utils/assignment/selectionUtils.ts:22-24 getRoleStructureKey`.
- 통지원 근거: `AssignmentSelector.tsx:102-128`(그룹 선택 시 `group.dates` 전체 일괄 배정).
- stale 주석 정정: `utils/job-posting/dateUtils.ts:215`("역할별 peak의 합" → 실제 좌석 총합).

**안 건드림**: `supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql`(트리거), `20260718100000_grid_auto_sync_required_count.sql:54-69`(SQL이 schedule JSON 직접 파싱), `MAX_CAPACITY_REACHED` 가드(`utils/supabase.ts:105`).

---

## 5. 미검증 가정 (구현 계획에서 코드로 확인)

- **상시(fixed) 공고의 확정 집계 키** — fixed는 날짜 없음 → `count_posting_confirmed_by_slot` 키 구성이 dated와 다를 수 있음. `FIXED_TIME_MARKER` 경로 확인.
- 구인자 카드 높이 증가(자리 병기 채택 시) — 목록 밀도 영향.

---

## 6. 다음 세션 실행 순서

1. 이 문서 정독 → §4 코드 라인 스팟검증(이동 가능).
2. **§2 표시형식 3안 사용자 확정** (AskUserQuestion, 추천=A 남은자리만).
3. 스펙 갱신(A/B면 대폭, C면 유지) → 사용자 검토.
4. `superpowers:writing-plans` 또는 `/autoplan`으로 레이어별 구현 계획.
5. RED 테스트 후보: ①지원화면 확정 5/5 주입→마감+대기지원 활성(현행 실패) ②(2,1)→카드 표시·자리 3/10 ③(5,1)→마감·자리 6/10 ④요약==일별 max 불변식 ⑤그룹경계 headcount 반영 ⑥dayCount==1 회귀.

---

## 7. 금지·주의 (전역 규칙)
- 코드 변경은 계획 승인 후 별도 세션. 이 세션은 설계까지.
- `mcp__supabase__*` 직접 호출·기존 마이그레이션 수정·PROD 우회 금지.
- 판정·계획 서브에이전트는 `model: fable`. 광역 탐색은 Explore(sonnet). 완료 주장 전 실행 증거.
- 병렬 세션 존재(git status에 내가 안 만든 미커밋 다수) → 커밋은 스펙 파일만 스테이징했음. 이어서도 파일 단위 스테이징 엄수.
