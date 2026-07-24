# 핸드오프 — 정산 근무시간 음수 `work_duration` 최종 클램프 (다음 세션 메인 프롬프트)

> 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣으면 된다.

---

정산 저장 경로에서 음수 `work_duration`이 기록되는 **기존 결함**을 근본 처리한다.

## 무엇을 / 왜
정산 실측시간 수정 화면에서 출근시간을 "미정"(startTime: null)으로 저장하면, repo가 기존 DB check-in을 지우지 않고(null-skip 패턴) 새 same-day checkout과 결합해 **음수 `work_duration`**을 기록할 수 있다. `work_duration`은 급여 직결 값이라 "조용한 음수"는 정산 오기록이 된다. 이 구멍은 자정 근무 통일 PR(#271) **이전부터 존재**했고, #271은 정상(출근·퇴근 모두 존재) 흐름만 안전하게 만들었으며(입력계층 `endTimeForSave`) 이 null-start 경로는 그대로 남아 있다. 마지막 기록 지점(서버/repo)에 방어가 필요하다.

## 착수 전 필수 로드
1. `/investigate` 또는 `superpowers:systematic-debugging` — **먼저 재현**(투기 금지).
2. 참고 맥락: 메모리 `project_overnight_worktime_20260718`(#271, Task 4 리뷰가 이 구멍을 영속경로까지 실측). 병렬 세션 있으면 `/guard` + 워크트리 격리(전역 git-workflow 규칙).

## 조사 순서 (근본원인 — 인과사슬 끝까지)
1. **재현**: 정산 실측시간 수정에서 "출근 미정" + 기존 DB checkout 존재 케이스 → 저장 → `work_duration` 부호 확인(음수 재현).
2. **`work_duration`이 어디서 권위 있게 계산되는지 확정**(⚠️ 아래 라인번호는 대략치 — 반드시 함수명으로 재확인):
   - 클라 repo 후보: `WorkLogRepositoryTransactions.ts`(≈:94-97 계산·음수 클램프 부재, :74-76 raw `toISOString()` 저장) ← `workLogService.ts`(≈:204-225 passthrough) ← `useStaffSettlementsHandlers.ts`(≈:208-222) ← `StaffManagementTab.tsx`(≈:130-147).
   - 서버 후보: work_logs는 timestamptz + RPC/트리거로 재계산될 수 있음(메모리 `project_worklog_timestamptz_migration`·`project_schedule_counter_unification_sp2_sp3`). 트리거/RPC가 `work_duration`을 계산하면 클라 클램프만으론 부족.
3. **클램프 위치 결정**: 실제 계산 지점에 둔다. 클라 계산이면 repo, 서버 계산이면 RPC/트리거. 둘 다면 **서버가 최종 방어**.

## 구현 (TDD)
- 규칙: `finalCheckOut <= finalCheckIn`이면 (a) 익일 +24h 보정, 또는 (b) 저장 거부(명시 오류) 중 택1.
  - **권고**: 자정 근무(18:00~02:00)가 정당하므로 무조건 거부보다 **익일 보정 우선**. 단 아래 제품 결정 확인.
- ⚠️ **제품 결정 필요**: `startTime: null`(미정) + 기존 DB check-in 존재 시 의미는?
  - (i) "미정=출근시간 지움" → check-in도 **삭제**해야 함(현재 repo는 null-skip으로 안 지움 = 진짜 버그) → repo가 null을 실제 삭제로 반영하도록 고치는 게 정답일 수 있음.
  - (ii) "미정=변경 안 함" → 기존 check-in 유지, checkout만 갱신 → 이때 음수면 익일 보정/거부.
  - 어느 의미인지 먼저 확정하고 그에 맞게 고칠 것(단순 클램프가 진짜 결함을 가릴 수 있음 — 증상≠원인).
- Red-Green: 음수 재현 테스트 먼저(FAIL) → 수정 → 양수/거부/삭제 확인(PASS). 기존 정산 테스트 회귀 유지.
- 서버 변경이면: `/guard` 먼저 · 마이그레이션은 `mcp__supabase__apply_migration` 전용(db push 금지) · pgTAP red-green · prod 적용 전 프로브 SQL.

## 완료 정의 (exit proof)
- 재현 케이스가 더는 음수 `work_duration`을 만들지 않음(보정/거부/삭제 중 확정된 방식) + Red-Green 증거.
- `cd uniqn-mobile && npm run quality` GREEN + 관련 jest(+서버 변경 시 pgTAP) GREEN.
- 정상 흐름·자정 근무(18:00~02:00) 무회귀 확인.

## 완료 후 (사용자 게이트)
- push/PR은 **명시 요청 시에만**. PR 전 최신 master 재통합(squash 저장소 → merge) + 재검증.
- 머지 후 `/ingest`로 wiki 졸업 + 메모리 갱신.

## 참고
- 출처: 자정 근무시간 통일 PR #271(master 32ac45040) Task 4 리뷰의 Important(기존결함·무회귀) 지적.
- 규율: 전역 verification(완료 주장 전 실행 증거)·fablize investigation-protocol(재현→가설3+→인과추적).
