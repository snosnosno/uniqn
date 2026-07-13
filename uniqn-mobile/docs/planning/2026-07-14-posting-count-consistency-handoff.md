# 공고 인원카운트 불일치 전수 수정 — 설계+핸드오프 (2026-07-14)

> 브랜치 `fix/posting-count-consistency-20260714` (베이스 origin/master `20f043bd2`, 워크트리 `.claude/worktrees/count-consistency`).
> 전수 분석(2026-07-14 세션)에서 확인된 카운트 불일치 위험 6건 중 4건(S1~S4)을 이 브랜치에서 수정, 2건(S5·S6)은 하단 보류.

## 배경 — 카운트 아키텍처 (분석 확정본)

- **진실원 2개**: `job_postings.filled_positions`(사람 단위 총계, `fn_update_job_posting_stats` 트리거가 유일 갱신) + `work_logs`(슬롯·역할별 세부, `get_posting_filled_counts` RPC로 집계 노출).
- **키 계약(불변)**: DB `_posting_slot_key`/`_posting_role_key` ↔ 클라 슬롯키(startTime 우선, TBA→'미정')·역할키(`other:<custom>` 우선). 전역맵 키 = `${postingId}__${date}__${slot}__${role}`, 서브맵 = `extractPostingFilledSubmap`으로 접두 제거한 `${date}__${slot}__${role}`.
- **SP3 이후 dead counter**: `schedule.requirements[].roles[].filled`은 항상 0 (DB에서 strip). `getPostingRoleStats()`(`src/domains/job-posting/core.ts:117-142`)도 filled=0 고정.
- 서버 overfill 최종 권위 = `confirm_application()` H1 가드. 클라는 표시 정확성만 담당.

## 수정 슬라이스

### S1 — 브라우즈 상태 필터 상수 단일화 (기계적)

- **문제**: `IN ('active','capacity_full')` 기본 필터가 `src/repositories/supabase/JobPostingRepository.ts`의 `getList()`(~:121)와 `getTypeCounts()`(~:228) 두 곳에 각각 하드코딩 — 상태 추가 시 한쪽만 갱신되는 enum 발산 재발 위험(wiki `decisions/enum-divergence` 계보).
- **수정**: 도메인 레이어(`src/domains/job-posting/` 내 적절한 기존 파일 또는 신규 상수 파일)에 `BROWSABLE_POSTING_STATUSES = ['active','capacity_full'] as const` 신설, 두 함수가 이를 import. 의미 주석: "정원마감(capacity_full)도 브라우즈에 노출하는 정책의 단일 소스".
- **검증**: 기존 `JobPostingRepository.getList.capacity.test.ts` / `getTypeCounts.capacity.test.ts` 무수정 pass.

### S2 — PostingCardSurface 이중 모델 통일 (기계적)

- **문제**: `src/components/jobs/shared/PostingCardSurface.tsx` ~:44에서 a11y label용 `buildPostingScheduleModel(card)`(filledCounts 미주입=항상 0 fallback)를 별도 생성하고, ~:112 `PostingScheduleContent`는 hydrate 모델을 따로 생성 — 모델 이원화. 향후 label에 확정 수를 쓰는 순간 0/N 드리프트 재발 소지.
- **수정**: hydrate 모델을 **한 번만** 생성해 a11y label과 콘텐츠 렌더 양쪽에 공유(상위에서 생성해 prop으로 내리거나 useMemo 공유). **현재 a11y 텍스트·렌더 결과는 불변**이어야 함.
- **검증**: 기존 `postingSurfaceModel*.test.ts` 3종 + 카드 관련 테스트 무수정 pass.

### S3 — 역할별 remaining 실카운트 hydrate (핵심)

- **문제**: `selectPostingRoleAvailability()`(`src/domains/job-posting/selectors.ts:62-89`)가 dead counter 기반이라 역할별 remaining이 사실상 항상 "여유 있음". 소비자 `RoleChangeModal.tsx:138-139`(employer 역할 변경 옵션)가 마감 역할도 선택 가능하게 표시 → confirm 시 서버 H1에서야 실패하는 막다른 UX.
- **수정**:
  1. 순수 함수 `aggregateRoleFilledFromSubmap(submap): Record<roleKey, number>` 신설 — 서브맵 키 `${date}__${slot}__${role}`을 파싱(`split('__')` 후 `slice(2).join('__')`이 role)해 역할별 합산.
  2. `selectPostingRoleAvailability`에 옵션 파라미터(`filledByRole?`) 추가 — 주입 시 실카운트로 remaining/isFull 계산(`max(0, capacity-filled)`), 미주입 시 **기존 동작 완전 보존**(기존 소비자 무영향).
  3. RoleChangeModal 흐름에 배선: 해당 스크린에서 `usePostingFilledCounts([postingId])` + `extractPostingFilledSubmap` → aggregate → 모달 전달. 마감 역할은 비활성+“(마감)” 표기하되, **지원자의 현재 역할은 항상 선택 유지 허용**.
  4. 역할키 매칭은 기존 클라 헬퍼(`other:<custom>` 우선 정규화 — buildSlotRoleKey/roleMatchKey 계열) **재사용**. 새 키 함수 발명 금지(3면 키 계약 유지).
  5. **지원(apply) 플로우 canApply 게이트는 변경 금지** — 마감 역할 지원 허용은 의도(대기 성격, 서버 H1 권위). selectors에 이 의도를 한글 주석으로 남길 것.
- **검증**: aggregate 단위테스트(빈맵/복수 슬롯 합산/`other:` 커스텀 역할), selector hydrate 유/무 분기 테스트, RoleChangeModal 마감 표시 회귀 테스트.

### S4 — WeeklyStaffWidget top-3 과소집계 제거

- **문제**: `src/components/home/widgets/WeeklyStaffWidget.tsx`가 활성 공고 **상위 3건만**(slice(0,3)) `getConfirmedStaff`를 공고별 반복 호출해 요일별 confirmed 계산 — 활성 공고 4건 이상이면 조용한 과소집계 + N+1 쿼리.
- **수정**: `jobPostingRepository.getPostingFilledCounts(활성공고 전체 id)` **배치 1회**(또는 `usePostingFilledCounts` 훅)로 전역맵을 받아, 키의 date 세그먼트로 요일별 confirmed 합산. capacity 쪽 의미(공고 totalPositions 합)는 유지하되 전체 활성 공고로 확장. 로딩/빈 데이터 폴백은 기존 UX 유지.
- **검증**: 활성 공고 4+건 시 전체 합산되는 회귀 테스트(과소집계 재발 방지), date 파싱 단위 테스트.

## 공통 규칙 (에이전트 필수)

- 한글 주석·`logger` 사용(console.log 금지)·`@/` 절대경로·immutability·파일<800줄.
- **금지**: supabase 마이그레이션 파일 수정, `mcp__supabase__*` 호출, 스코프 밖 리팩터링, git commit/push(중앙에서 수행).
- 기존 테스트를 깨지 말 것. 변경 후 관련 jest를 직접 실행해 출력 확인.

## 검증 게이트 (exit proof)

1. `npx tsc --noEmit` exit 0
2. 변경 관련 jest 스위트 전부 pass
3. code-reviewer(fable) CRITICAL/HIGH 0
4. diff 실측 확인 후 커밋 (push/PR은 사용자 요청 시)

## 보류 (다음 세션 핸드오프)

- **S5**: `person_basis_filled_positions.test.sql` DISABLED(type mismatch) 재활성 — 로컬 Docker 스택(`npm run db:start`) 필요. 사람 단위 정책의 DB 회귀 가드 복구.
- **S6**: `applicants.tsx` 정원 스트립(사람 단위 filled_positions) vs 역할별 상세(work_logs row 단위) — 그룹일정에서 두 숫자가 다를 수 있는 **의미 차이**. 코드 결함 아님. 라벨에 "명(사람 기준)" 명시 여부 = 제품 결정.
- 진행 상태·잔여는 이 문서 하단 "진행 로그"에 추가 기록.

## 진행 로그

- 2026-07-14: 설계 확정, S1~S4 구현 착수.
- 2026-07-14: **S1~S4 전부 구현·검증 완료** (opus 3기 병렬 + 메인 중앙 검증).
  - 검증 실측: `tsc --noEmit` exit 0 · `npm run quality` exit 0 · jest **418스위트/5134 전부 pass** · knip 카운트 베이스라인 동일(1333/966 — 순증 0).
  - code-reviewer(fable) 판정: CRITICAL/HIGH 0, MEDIUM 3 → **전부 반영**: ①bare other 역할키 콜론 정합(`other:`) ②custom 역할 스태프 현재역할 예외(currentRoleKey 정규화) ③역할변경/확정해제 시 `postingFilledCounts` 캐시 무효화. LOW 4 → 배지 warning 시인성·집계 경계 주석·knip 순증 제거·fail-open 의도 기록(아래).
  - 부수 결함 2건 추가 수정: ⓐ 신설 constants.ts 의 `STATUS.*` 모듈 초기화 순환(settlement 임포트 체인 실측) → 리터럴+`satisfies` ⓑ 쿼리키 상수를 훅 파일에 두면 hooks→repositories→utils/supabase→errors 순환(useConfirmedStaff.test 실측) → 의존성 0 단독 모듈 `src/hooks/postingFilledCountsKey.ts` 분리.
  - 드라이브바이: `useJobPostings.test.tsx` 정렬 테스트가 UTC 날짜(toISOString) 생성이라 KST 00~09시 매일 플레이크(베이스라인에서 재현 실측, 정렬 유틸은 로컬 기준으로 정상) → 로컬 날짜 생성으로 교정.
  - 의도 기록: settlements 화면의 filledByRole 은 로딩/RPC 실패 시 빈 객체 = 전 역할 여유 표시(fail-open). 서버 confirm H1 권위 정책과 일치하는 의도적 설계.
- 잔여: 상단 "보류(S5·S6)" + RoleChangeModal 마감 표시 실기기 QA(다크 disabled 대비).
