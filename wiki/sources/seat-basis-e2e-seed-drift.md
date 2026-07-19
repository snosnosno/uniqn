---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/e2e/tests/p0-critical/cancellation-lifecycle.spec.ts
  - uniqn-mobile/e2e/tests/p2-standard/employer-posting-capacity-recovery.spec.ts
  - uniqn-mobile/supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql
  - uniqn-mobile/supabase/tests/seat_basis_filled_positions.test.sql
  - PR#269
  - PR#275
tags: [e2e, seat-basis, filled-positions, test-staleness, vacuous-green, cancellation]
---

# 소스: 좌석 기준 filled_positions 전환 + E2E 시드 낙오 (PR#269 → PR#275)

**한 줄:** 좌석 기준 전환이 `filled_positions` 유지 주체를 이관했는데 E2E 시드 하나가 구 계약에 묶여 남아, P0 취소 플로우가 07-17~07-19 전 브랜치에서 red + vacuous green 동시 상태였다.

## 계약 변경 (PR#269, 검증됨)

`filled_positions` 유지 주체가 이관됐다:

| | 구(person basis) | 신(seat basis, 2026-07-17~) |
|---|---|---|
| filled 유지 | `fn_update_job_posting_stats` (applications 트리거) | `fn_sync_filled_positions_seat` (work_logs 트리거) |
| capacity 전이 | 같은 applications 트리거 | `fn_recalc_total_and_capacity` (job_postings BEFORE 트리거) |
| 카운트 단위 | 사람 | **좌석** (같은 스태프 2일 확정 = 2) |

재작성된 `fn_update_job_posting_stats`는 **더 이상 filled를 쓰지 않는다**(prod `pg_proc.prosrc` 실측: `filled` 등장 1회, 전부 주석). 즉 **confirmed 지원서 INSERT만으로는 filled가 움직이지 않는다.**

좌석 회수 조건 (`cancel_application_atomically`, 검증됨):
```sql
DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
```

## 낙오 (PR#275가 수정)

`cancellation-lifecycle.spec.ts`의 시드는 `applications`만 직접 INSERT하고 `work_logs`를 만들지 않았다(파일 전체 `work_logs` 참조 2회 — 둘 다 cleanup의 delete). 주석은 여전히 구 계약을 서술했고, 반환값에 `initialFilledPositions: 1`이 하드코딩돼 있었다.

- **왜 놓쳤나:** #269는 `employer-posting-capacity-recovery.spec.ts`만 좌석 시딩으로 전환했다. `cancellation-lifecycle.spec.ts`는 PR#196 이후 미변경이라 전환 대상 스캔에 안 걸렸다.
- **회귀 브래킷:** 마지막 E2E 성공 `07-17T12:29Z` → #269 머지 `07-17T16:15Z` → 첫 실패 `07-17T18:08Z`. 사이 성공 런 0건.
- **파급:** master가 E2E 미실행 상태로 #268·#269·#271을 받아, 무관한 브랜치(#273 등)까지 동일 실패를 물려받았다.

## 라이브 결함이 아니었음 (4갈래 확인, 검증됨)

`#269`가 정원 복원을 깨뜨렸다는 가설은 기각됐다:

1. prod `fn_update_job_posting_stats` 본문에 filled 쓰기 없음 — 등장 1회는 주석
2. prod 불변식: 비컨테이너 공고 `filled_positions` vs 활성 좌석수 **mismatch 0건**
3. pgTAP `seat_basis_filled_positions.test.sql` **11/11 통과** — T7-return·T7a·T7b가 취소→좌석 감소→`capacity_full`→`active` 복귀를 커버
4. prod↔로컬 관련 함수 5종(`cancel_application_atomically`·`confirm_application`·`fn_sync_filled_positions_seat`·`fn_recalc_total_and_capacity`·`_total_positions_from_schedule`) 본문 **md5 완전 일치** → 로컬 pgTAP 결과가 prod로 전이

## 수정 (PR#275, master `9cfec82db`)

시드에 좌석 1건 추가. `application_id` + `status='scheduled'` **둘 다 필수** — 위 DELETE 조건 때문에 하나만 어긋나도 취소 후 좌석이 남아 정원이 복원되지 않는다.

> ⚠️ 레퍼런스였던 capacity-recovery 스펙은 좌석을 **수동 삭제**하므로 `application_id` 없이도 동작한다. 취소 스펙은 **RPC가 회수**하므로 반드시 필요하다 — 레퍼런스를 그대로 복사하면 조용히 깨진다.

검증(로컬 Supabase = CI 동일 구성): 수정 전 재현 `1 failed(:493 Expected 1/Received 0)·12 passed·4 did not run`(CI와 동일) → 수정 후 `17 passed` → CI 8/8 pass(E2E 9m50s).

## 교훈

계약 이관 → 시드 낙오 → **red + vacuous green** 재발 클래스는 [[test-seed-contract-drift]]로 정리했다. 요지: 깨진 시드는 빨간 테스트 하나만 만드는 게 아니라, 전제를 못 만들어 `toBe(0)` 류 단언을 영원히 통과시킨다.

## 관련

- [[test-seed-contract-drift]] — 이 사건이 정의한 재발 클래스(계약 소유권 이관 + vacuous green)
- [[capacity-full]] — 전이 규칙 페이지. #269로 전이 주체가 바뀌어 본 ingest에서 교정됨
- [[whitelist-silent-drop]] — 형제 클래스("신규 필드는 전 매핑 지점 전수") — 이쪽은 쓰기 경로, 본 건은 테스트 시드
- [[supabase-write-pitfalls]] — 카운터는 트리거+델타 규율
- [[e2e-cli-grant-drift]] — 같은 "E2E 전면 red" 증상이지만 원인은 환경 드리프트(대조군)
