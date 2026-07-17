# 핸드오프 — 좌석 기준 인원카운트 통일: 독립 리뷰 (다음 세션 메인 프롬프트)

> 사용법: 새 세션에서 아래 "메인 프롬프트" 블록을 그대로 붙여넣는다.
> 목적: SDD로 구현·자체리뷰까지 끝난 브랜치를 **머지/prod 적용 전 신선한 눈으로 독립 검증**한다.

## 메인 프롬프트

```
좌석 기준 인원카운트 통일 구현 브랜치를 머지 전 독립 리뷰해줘.

작업물: 워크트리 C:/Users/user/Desktop/T-HOLDEM-seat
       브랜치 feat/seat-basis-posting-count-impl
       리뷰 범위 = fab03004a..d11f0f3a (구현 6커밋; HEAD의 이 핸드오프 doc 커밋은 제외)

먼저 읽어:
1. 이 문서 (docs/planning/2026-07-17-seat-basis-review-handoff.md)
2. 스펙: uniqn-mobile/docs/superpowers/specs/2026-07-17-seat-basis-posting-count-design.md
3. 계획: uniqn-mobile/docs/superpowers/plans/2026-07-17-seat-basis-posting-count.md
4. SDD 원장·리포트: .superpowers/sdd/progress.md, .superpowers/sdd/task-*-report.md

DB 변경이 핵심이라 database-reviewer(fable)+security-reviewer(fable) 병렬 디스패치 권장.
발견 이슈는 심각도별로 정리하고, "머지 차단 vs prod-적용 게이트 vs 후속 백로그"로 분류해줘.
prod 적용·OTA·push는 절대 하지 말 것(사용자 게이트). mcp__supabase__* 직접호출·기존 마이그 수정 금지.
```

## 무엇이 구현됐나 (리뷰 대상)

좌석(seat) 기준 단일화: **정원 = 모든 날짜×슬롯×역할 count 총합**, **확정 = 활성 work_logs 행 수**, **전이 = job_postings BEFORE 트리거 단일 지점**.

| 커밋 | 레이어 | 요지 |
|------|--------|------|
| `9eb41e35d` | 클라 | `stats.ts` calculateTotalPositionsFromSchedule peak→좌석합 |
| `b57d98d5d` | 클라 | `postingSurfaceModel.ts` 그룹 날짜별 전개(`days[]`), `sumHydrateForRange`·range hydrate 제거 |
| `420cd0668` | 클라 | `PostingScheduleContent.tsx` 그룹 일별 렌더 + 8일↑ 접힘(GroupedDaysBlock) |
| `a8a0bd5a1` | DB | 마이그 `20260718000000`: work_logs 좌석 델타 트리거 + BEFORE 전이 단일화 + RPC 3종(add/remove/cancel) 재작성 + 백필 · pgTAP 재작성 |
| `94ba7974c`+`d11f0f3a` | E2E | 정원마감 회복 E2E를 work_logs 좌석 시딩으로 정렬 |

## 로컬 검증 재현 (리뷰어가 직접 돌릴 것)

```bash
cd C:/Users/user/Desktop/T-HOLDEM-seat/uniqn-mobile
npx jest 2>&1 | tail -8            # 기대: 482 스위트 / 5583 테스트 PASS
npm run quality 2>&1 | tail -6     # 기대: exit 0 (0 error, 사전존재 warning 60)
```

pgTAP (psql 미설치 → docker 경유, MSYS 경로변환 끄기 필수):
```bash
cd C:/Users/user/Desktop/T-HOLDEM-seat/uniqn-mobile
MSYS_NO_PATHCONV=1 docker cp supabase/tests/seat_basis_filled_positions.test.sql supabase_db_uniqn:/tmp/t.sql
MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -f /tmp/t.sql 2>&1 | grep -E '^ ok|^ not ok'
# 기대: ok 11 / not ok 0. capacity_full_transition.test.sql 도 동일 방식(ok 1 PASS)
```
> ⚠️ 공유 Docker 스택(6 워크트리 공유·11h+ UP). `db:reset` 전 `npm run db:status`. 스택이 다른 세션 마이그로 리셋됐으면 seat 마이그 재적용 필요.

## 리뷰 집중 포인트

1. **DB 마이그(`20260718000000`) 정합성** — secdef search_path(pg_temp) 보존, 트리거 상호작용(BEFORE recalc ↔ seat 델타 ↔ 백필 이중카운트 없음), 백필 원자성, cancel DELETE-먼저 재배열, 컨테이너 SKIP.
2. **클라↔DB 좌석합 동치** — `stats.ts` vs SQL `_total_positions_from_schedule`. 레거시 형상(`name`/`headcount`) 갭이 서버 권위로 흡수되는지.
3. **판단 2건이 옳은지 재확인** — (a) add/remove/cancel을 baseline 아닌 최신 마이그(093000/020000)에서 재작성(=grid 하드닝 보존) (b) 그룹 per-day `filled:0` 억제(=SP3 과다집계 차단).
4. **후속 백로그가 실제 머지 차단인지 판정**:
   - 슬롯 정원가드 `MAX((r->>'count'))` vs 좌석 total `SUM` 불일치 → 한 슬롯 내 동일 role key 2개면 capacity_full 영구 미달(기존 동작, 회귀 아님).
   - `confirm_application` owner_id NULL fail-open 잔존(#267이 타 3종엔 COALESCE 넣음, confirm엔 없음 — 계획이 "무변경" 명시).
   - 그룹 summary role key = index-0(동일 keySource+count 중복시 React key 충돌).
5. **사전존재 실패 확인**(이 브랜치 무관) — `jpc_job_postings_rls` pgTAP 5/6/7 red(grid owner_id 계약 미반영), `notify_on_job_posting_update` malformed array WARNING(swallowed).

## 잔여 = 사용자 게이트 (리뷰 후)

1. push/PR (명시 요청 시) → 2. **prod 마이그 적용 전 비정수 count 프로브 필수**(백필 `(r->>'count')::int` 하드캐스트) → 3. OTA(마이그→OTA 순서) → 4. iOS/실기기 QA → 5. impl 브랜치를 named `feat/seat-basis-posting-count`에 ff/머지.

## 스펙 성공 기준 (§8 — 리뷰 체크리스트)

- "14일 딜러3 / 15일 딜러4·플로어1" → total=8, 8명 확정 전까지 마감 안 됨.
- "14~15일 딜러3"(그룹) → total=6, 14일 3명 확정 시 "14일 3/3, 15일 0/3"(오도 없음).
- 같은 사람 14·15일 확정 → filled 2 증가.
- 구인자 직접추가 스태프 → 좌석 카운트 포함(컨테이너 0 유지).
