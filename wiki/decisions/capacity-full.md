---
area: decisions
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql
  - memory/project_job_posting_capacity_full_shipped.md
  - memory/pitfall_posting_role_filled_dead_counter.md
  - memory/pitfall_e2e_employer_tab_nonemployer_hydration.md
  - PR#155
  - PR#139
  - PR#161
  - PR#162
  - PR#269
tags: [decisions, capacity-full, posting-status, dead-counter, trigger, enum]
---

# 결정: 공고 자동마감 — capacity_full

**맥락:** 공고 정원 충족 시 `active` 그대로 유지 → 지원 계속 허용 + 카드 역할별 filled 항상 0으로 표시. 두 문제를 DB 레벨에서 해결. (검증됨: PR#155·PR#139)

## 결정 1: posting_status enum `capacity_full` 추가 (Approach B)

주장 (memory/project_job_posting_capacity_full_shipped.md, PR#155 머지 `68252355b`):
- M1: `posting_status` enum에 `capacity_full` 추가
- M2: `active`+filled≥total→`capacity_full`, `capacity_full`+filled<total→`active` (자동 양방향 전이)
- M3: `cancel_application_atomically` reopen 분기 `capacity_full` 포함

Approach A(derived VIEW)는 premature optimization으로 deferred.

> ⚠️ **2026-07-17 좌석 기준 전환(PR#269)으로 M2·M3의 담당 주체가 바뀌었다** — 전이 규칙 자체는 유지되나 실행 지점이 다르다. 아래 절 참조.

## 결정 2: dead counter 제거 — `filled_positions` 단일화

주장 (memory/pitfall_posting_role_filled_dead_counter.md, PR#139 머지 `2f39a3c90`):
- `schedule.requirements[].roles[].filled` = dead counter(confirm/cancel RPC가 갱신 안 함)
- 권위 소스: `job_postings.filled_positions` 컬럼
- 읽기 시 `get_posting_filled_counts` RPC hydrate로 표시

```
JobCard → usePostingFilledCounts → get_posting_filled_counts(SECDEF)
         → work_logs GROUP BY date, time_slot, role → 실제 count
```

## 갱신: 좌석 기준 전환으로 담당 주체 이관 (PR#269, 2026-07-17)

검증됨 (`20260718000000_seat_basis_filled_total_positions.sql`, prod `pg_proc.prosrc` 실측):

| 역할 | 구(~2026-07-17) | 현행 |
|---|---|---|
| `filled_positions` 유지 | `fn_update_job_posting_stats` (applications 트리거) | **`fn_sync_filled_positions_seat`** (work_logs 트리거, 좌석 델타) |
| `capacity_full`↔`active` 전이 | 같은 applications 트리거 | **`fn_recalc_total_and_capacity`** (job_postings BEFORE 트리거 — 전이 **단일 지점**) |
| `total_positions` | 클라 입력 신뢰 | 서버가 `schedule`에서 재계산(`_total_positions_from_schedule`) |
| 카운트 단위 | 사람 | **좌석** — 같은 스태프가 2일 확정이면 2 |

- 재작성된 `fn_update_job_posting_stats`는 **더 이상 filled를 쓰지 않는다**(사람 지표 `confirmedApplicants` 등만 갱신). 따라서 **confirmed 지원서 INSERT만으로는 filled가 움직이지 않는다.**
- M3 정정: `cancel_application_atomically`의 `capacity_full` 재개 분기는 **삭제**됐다. RPC는 좌석 DELETE만 하고 재개 판정은 BEFORE 트리거가 한다. RPC 소관으로 남은 재개는 `closed`(비만료)뿐.
- 이 이관을 반영 못 한 E2E 시드가 P0를 이틀간 깨뜨렸다 → [[seat-basis-e2e-seed-drift]], 재발 방지는 [[test-seed-contract-drift]].

## capacity_full 도입 시 reader 전수 갱신 (교훈)

PR#155 P0 적발: `jobPosting.schema.ts`(읽기 Zod)에 `capacity_full` 누락 → M2 전이 즉시 모든 read 증발([[enum-divergence]] 패턴 재발). → 신규 status 값 추가 = Zod + status 필터 쿼리 전수 갱신 필수.

PR#161 (주장): `getMyJobPostings` includeAll이 `capacity_full` 누락 → 구인자 관리 목록에서 증발.
PR#162 (주장): `getList` default `status=active` → capacity_full 구직자 미노출. fix: `.in('status', ['active', 'capacity_full'])`.

## e2e 파일명 라우팅 교훈

주장 (memory/pitfall_e2e_employer_tab_nonemployer_hydration.md): playwright project 설정이 파일명 정규식으로 storageState 배정. employer UI e2e = 파일명에 `employer-` 접두사 필수, 없으면 staff.json으로 실행 → NonEmployerView.

## 관련

- [[enum-divergence]] — capacity_full 도입이 촉발한 read 증발 패턴(3회 재발)
- [[rls-model]] — 공개 RLS에 capacity_full 포함(M4) 필요
- [[data-flow]] — 자동전이 트리거가 데이터 흐름에 미치는 영향
- [[seat-basis-e2e-seed-drift]] — 좌석 기준 전환(PR#269) 기록 + E2E 시드 낙오 후속(PR#275)
- [[test-seed-contract-drift]] — 계약 소유권 이관 시 테스트 시드 전수 점검 규칙
