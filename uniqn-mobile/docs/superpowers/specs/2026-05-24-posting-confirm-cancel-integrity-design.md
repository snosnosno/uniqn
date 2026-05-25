# 공고 확정/취소 정합성 강화 — 설계 문서

- **작성일**: 2026-05-24
- **브랜치**: `fix/posting-confirm-cancel-integrity`
- **상태**: 설계 승인 완료 → 구현 계획 대기
- **선행 분석**: 공고 전체 워크플로우 5도메인 병렬 매핑 + 핵심 주장 4건 실DB/소스 직접 검증

## 1. 배경 & 문제

공고 워크플로우(지원→확정→취소→정산) 전체 분석 중 사용자 재현 버그가 발견됐다: **1명 모집 공고에 1명이 확정됐는데도 공고 카드의 역할별 카운트가 `(0/1)`로 표시**된다(인천 루원시티 텍사스, 5/23 미정 딜러).

근본 원인은 코드로 확정됐다. `serialization.ts:202-204`가 명시적으로 선언하듯 `schedule.requirements[].roles[].filled`는 **dead counter**(confirm/cancel RPC가 절대 갱신하지 않음)인데, 카드/상세의 역할별 표시 `formatRoleLine`(`PostingScheduleContent.tsx:189`)과 `toRoleModels`(`postingSurfaceModel.ts:288`)가 이 dead counter를 그대로 읽는다. 따라서 dated/일반 공고는 확정 인원과 무관하게 항상 `(0/N)`을 표시한다(TBA 특유가 아닌 보편 버그). 집계 `filled_positions` 컬럼은 정상이라 "모집 마감" 판정(`postingFull`, `facts.ts:57`)은 맞지만, 화면에 보이는 역할별 숫자가 틀리다.

함께 같은 RPC 표면에 존재하는 정합성 빈틈도 같이 처리한다.

## 2. 검증으로 정정한 거짓 경보 (구현 금지 항목)

탐색 과정에서 "위험"으로 보고됐으나 실DB/소스 확인 결과 문제 없음. 재조사 방지를 위해 기록한다.

| 주장 | 검증 결과 |
|---|---|
| 중복지원 race — `(applicant_id, job_posting_id)` UNIQUE 없음 | **거짓.** `applications_job_posting_id_applicant_id_key` UNIQUE 인덱스 실존(실DB `pg_indexes` 확인) |
| 개보법 §17 동의 컬럼이 DB에 없음 | **거짓.** `applicant_provision_consent_at/version`이 프로덕션 `applications`에 실존(`information_schema` 확인). 로컬 마이그레이션 파일만 부재(MCP 적용분) |
| 취소요청이 상태검증 없이 임의 UPDATE 가능 | **부분 거짓.** `ApplicationRepository.ts:597-623`이 상태/본인/고정공고/중복요청 검증 + 낙관락 적용. 단 RPC가 아니라 DB 원자성·서버측 상태머신 가드는 없음(별도 부채, 본 작업 범위 밖) |

## 3. 범위 & 단계

| 단계 | 이슈 | 성격 |
|---|---|---|
| **Phase A** (본 spec) | H0(역할별 표시 dead counter), H1(정원 가드), H4(협업자 권한), H5(체크인 후 취소 차단) | 같은 RPC 표면 + 표시 경로, 응집 |
| **Phase B** (별도 spec) | H2(`filled_positions` 단일 소스화) | 트리거 재설계 + 전수 백필, 리스크 성격 상이 |

핵심 시너지: **H0의 "슬롯/역할별 확정 수 집계"와 H1의 "정원 가드"는 동일 계산** → 공유 SQL 헬퍼 하나로 둘 다 충족.

## 4. 컴포넌트 설계

### 4.1 공유 SQL 헬퍼 — `count_posting_confirmed_by_slot`
- `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `STABLE`.
- 입력 `p_job_posting_ids uuid[]`, 출력 `(job_posting_id, work_date, time_slot, role_key, confirmed_count)`.
- **dated/일반**: `work_logs WHERE job_posting_id = ANY($1) AND status NOT IN ('cancelled','no_show') GROUP BY date, time_slot, role`.
- **fixed**: 확정 `applications`의 roleRequirements 기준 역할별 집계(work_log 미생성 케이스). 이 경우 `work_date`/`time_slot`은 `FIXED_DATE_MARKER('FIXED_SCHEDULE')` / `FIXED_TIME_MARKER('NEGOTIABLE')`로 고정 반환하여 클라가 fixed variant 키와 매칭.
- **PII 미반환(카운트만)** → 공개 카드도 호출 가능. `GRANT EXECUTE ... TO authenticated`, `REVOKE ... FROM PUBLIC, anon`.
- `role_key` 정규화: `role = 'other'`이면 `'other:' || customRole`, 그 외 `role` 그대로. `time_slot`은 TBA 시 `TBA_TIME_MARKER('미정')`로 통일.

### 4.2 H0 — 역할별 표시를 권위 집계로 교체
- 읽기 배치 RPC `get_posting_filled_counts(p_job_posting_ids uuid[])` = 4.1 헬퍼 래핑.
- 공고 리스트/상세 조회 훅에서 가시 공고들에 대해 **1회 배치 호출**(N+1 회피) → `(work_date, time_slot, role_key)` map 구성.
- `postingSurfaceModel.toRoleModels`가 `role.filled ?? 0`(dead) 대신 **map에서 hydrate**. 키 정규화를 표시 경로(`formatTimeLabel`, `getRoleDisplayName`)와 **동일하게** 통일(PR #126 TBA 키 불일치 교훈 적용).
- `schedule...role.filled` 의존 제거(점진: 표시 경로부터). `serialization.ts`의 dead counter 주석 갱신.

### 4.3 H1 — confirm RPC 역할/슬롯별 정원 가드
- `confirm_application` 내 `FOR UPDATE` 직후, work_logs INSERT 전: 각 신규 assignment `(date, slot, role_key)`에 대해 4.1 헬퍼로 현재 확정 수 집계.
- `confirmed + 신규요청 > role.count`면 `RAISE EXCEPTION 'MAX_CAPACITY_REACHED'`(역할/슬롯 식별 정보 포함).
- 클라는 기존 `MaxCapacityReachedError`(E6 비즈니스) 매핑 재사용.

### 4.4 H4 — RPC 권한을 RLS와 정렬
- `confirm_application` / `cancel_application_atomically`의 `owner_id == p_owner_id` 등식을 술어로 교체:
  `v_job.owner_id = actor OR is_workspace_member(ws, actor) OR is_posting_collaborator(jp, actor) OR is_admin()`.
- 기존 SECDEF 헬퍼 재사용. JPC는 role 컬럼 없는 "풀 관리권"(D2) 설계이므로 협업자에게 확정/취소승인 권한 부여가 의도와 일치.

### 4.5 H5 — 체크인 후 취소 차단
- `cancel_application_atomically`의 work_log DELETE 전:
  `EXISTS(work_logs WHERE application_id = X AND status IN ('checked_in','checked_out'))`면 `RAISE EXCEPTION 'STAFF_ALREADY_CHECKED_IN'`.
- 클라 메시지: "이미 출근한 스태프예요. 정산 처리 후 취소할 수 있어요."(에러 공식 무엇+왜+어떻게).
- 방어선: `isVisibleConfirmedStaffWorkLog`(`confirmedStaffService.ts:50-52`)에 application.status 연동 추가(취소된 application의 잔존 work_log 숨김).

## 5. 데이터 흐름

```
[공개 카드/상세 조회]
 useJobs/useJobDetail → jobPostingRepo.getByIdBatch (기존)
                      └→ get_posting_filled_counts([...ids])  ← 신규 배치 RPC
   → map{(date,slot,roleKey)→count}
   → postingSurfaceModel.toRoleModels(hydrate)
   → PostingScheduleContent (1/1 정확 표시)

[확정] confirm_application RPC
   FOR UPDATE → count_posting_confirmed_by_slot (가드 H1) → 권한술어(H4)
   → work_logs INSERT → applications/job_postings UPDATE

[취소] cancel_application_atomically RPC
   FOR UPDATE → 권한술어(H4) → checked_in/out 존재 검사(H5 RAISE)
   → work_logs DELETE(scheduled) → 카운터 롤백
```

## 6. 에러 처리

| 코드(RPC) | 클라 매핑 | 사용자 메시지 |
|---|---|---|
| `MAX_CAPACITY_REACHED` | `MaxCapacityReachedError`(E6) | "해당 역할 정원이 가득 찼어요." |
| `STAFF_ALREADY_CHECKED_IN` | `BusinessError`(E6) | "이미 출근한 스태프예요. 정산 처리 후 취소할 수 있어요." |
| `PERMISSION_DENIED` | `PermissionError`(E2) | "이 공고를 관리할 권한이 없어요." |
| 집계 RPC 실패 | logger.warn + fallback | 역할별 카운트 미표시(0 노출 대신 숫자 생략), 화면 차단 안 함 |

## 7. 테스트 전략

- **pgTAP**: H1 정원 초과 RAISE(역할/슬롯별), H4 협업자 확정 성공 + 비협업자 차단, H5 체크인 후 취소 차단, 4.1 헬퍼의 TBA/그룹/멀티역할/fixed 정확성.
- **단위(Jest)**: `toRoleModels` hydrate(맵 적중/미스/TBA 키/`other` 역할), `formatRoleLine` 표시.
- **Red-Green(H0 회귀)**: "확정 1건 → (1/1)" — 수정 전 `(0/1)` fail 확인 후 green.
- **검증**: 실DB read-only로 헬퍼 집계가 실제 확정 행과 일치하는지 대조.

## 8. 의존성 & 리스크

- 마이그레이션은 MCP `apply_migration` 전용(`supabase db push` 금지). dry-run 시 `SELECT * FROM rpc() LIMIT 0`로 schema-mismatch 사전 검출(plpgsql lazy 컴파일 회피).
- `confirm_application` / `cancel_application_atomically` 재정의 시 **최신 버전 기준 전체 본문 교체**(부분 수정 시 이전 정의 회귀). 현행 최신: `20260418005000` 계열 + `20260421040000`(stats 트리거).
- 키 정규화 불일치(TBA/`other`)가 H0의 단일 최대 리스크 → 표시 경로와 헬퍼가 같은 상수/함수 사용하도록 강제.
- 배치 RPC 호출이 리스트 성능에 주는 영향: 가시 공고 한정 1회 호출로 제한.

## 9. Phase B 예고 (본 spec 범위 밖)
H0 도입으로 역할별 카운트는 derived가 되므로, 남은 H2는 `filled_positions` 컬럼 vs `stats.filledPositions` 정합. B1(트리거+delta 단일화, `pitfall_denormalized_counter_drift` 표준) 또는 장기적으로 컬럼 제거 후 집계 derive까지 별도 spec에서 검토. Phase A 안정화 후 착수.
