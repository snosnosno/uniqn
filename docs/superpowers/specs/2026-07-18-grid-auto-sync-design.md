# 공고 → 근무표 필요인원 자동 동기화 — 설계 스펙

> ## ⚠️ 부분 폐기 (SUPERSEDED) — 2026-07-19
>
> **이 문서의 "대회 제외" 결정(§2 D1 · §3 비목표 "대회 공고의 그리드 편입")은 반전됐다.** 대회도 지점에 연결되어 근무표 필요인원에 산입되는 것이 현행 결정이다.
>
> 현행 문서: [`2026-07-19-grid-tournament-inclusion-design.md`](./2026-07-19-grid-tournament-inclusion-design.md)
>
> 나머지(파생 엔진·좌석 규약·RPC 계약)는 유효하다. D1 관련 서술만 읽지 말 것.

> 작성: 2026-07-18 · 상태: 사용자 검토 대기
> 배경: 세 기능 통합 개선 "다음" 레인 ①(엔진). ②isSolo 사업장 숨김·③홈 스트립이 이 위에 얹힘.
> 실측 근거: 본 세션 자동 파생 엔진 감사(Explore, RPC SQL·serialization·seat-basis 정합 전부 파일:라인 실측).

## 0. 한 줄 목적

일반 공고를 등록하면 그 requirements(날짜×역할×인원)가 근무표(그리드)의 "필요 인원"에 자동으로 반영되게 한다 — 사장이 그리드에 목표를 따로 입력하는 이중 작업을 없앤다.

## 1. 실측이 밝힌 진짜 병목 (설계 전제)

파생 계산은 SQL상 저위험으로 가능하다(`add_direct_staff`·`confirm_application`이 이미 같은 jsonb 3중 순회를 prod에서 사용). **진짜 병목은 연결이다**:

- `get_venue_grid_summary`는 `venue_span_posting_ids`(= `venue_id = 지점 OR id = 지점`, `baseline:9617-9623`)로만 공고를 모은다.
- 일반 "새 공고 작성"은 `venue_id`가 **설계상·테스트로 고정된 채 항상 NULL**(`serialization.ts:328-336`, `serialization.venue.test.ts:52-59`).
- → SQL을 아무리 정교하게 짜도 일반 공고는 스팬에 안 잡혀 파생값이 0. **연결 정책이 선결 조건.**

## 2. 결정

### D1. 연결(linkage) — 단독 자동·멀티 선택
- 공고 등록 시 `venue_id` 설정 규칙:
  - **비-대회 공고 + 활성 워크스페이스 지점 1개(단독)** → 그 기본 지점에 `venue_id` 자동 연결(무프롬프트). 지점이 아직 없으면 `get_or_create_venue_container`(멱등)로 기본 지점 확보 후 연결.
  - **지점 2개+** → 공고 작성 폼에 지점 선택 칩 노출(기존 그리드 "공고 열기"의 `venueId` 프리필 경로와 동일 필드 재사용).
  - **대회(tournament) 공고** → 연결하지 않음(그리드는 홀덤펍 주간 도구, D-7 버스트 대회는 비대상). `venue_id` NULL 유지.
- 이미 그리드 "공고 열기"로 만든 공고는 현행대로 `venueId` 프리필 → 변화 없음.
- 근거: `venue_span_posting_ids`의 `venue_id = :V` 조건은 불변(E1 발산 방지 SSOT). 우리는 그 조건을 바꾸지 않고 **`venue_id`를 채우기만** 한다.

### D2. 파생(derivation) — 읽기 시점, 좌석 합
- `get_venue_grid_summary`를 확장(`DROP FUNCTION` 선행 후 `CREATE` — 반환 타입 변경)해 날짜별 `required_count` 열 추가:
  - 스팬 공고들의 `schedule->'requirements'`를 `req->>'date'`가 `[p_from, p_to]`에 드는 것만, `jsonb_array_elements` 3중 순회로 **Σ count(좌석 합)** 산출.
  - seat-basis의 `_total_positions_from_schedule`(전체 합) + `add_direct_staff`의 날짜 필터(`req->>'date' = a_date`)를 조합한 형태 — 둘 다 이미 검증된 선례.
  - `fixed` 스케줄(date=null 합성)은 날짜 매핑이 불가하므로 파생 제외(수동 목표만). `dated`만 파생 대상.
- 병합: 클라이언트 `buildGridCells`에서 `필요 = max(수동 softTarget, required_count)`. (서버 병합도 가능하나, 수동 목표는 컨테이너 jsonb·파생은 RPC라 클라 병합이 자연스러움.)
- **granularity 정합**: softTarget이 날짜당 단일 정수이므로 파생도 날짜당 단일 합(역할별 분해 안 함). 두 값의 축이 같아 `max` 병합이 깔끔.

### D3. 좌석 컨벤션 통일 + 순서
- 파생 "필요 인원"은 seat-basis의 **Σ count(좌석 합)** 컨벤션을 따른다 — "정원 5명(peak) vs 그리드 필요 8명(좌석)"이 같은 화면에서 다른 기준으로 보이는 혼선 방지.
- 구현 순서: **seat-basis(`feat/seat-basis-posting-count-impl`) 머지·prod 적용 완료 후 착수.** 기술적 강제 의존은 아니나(grid RPC 4종과 직교), 좌석 합 규칙이 전역에 먼저 자리잡은 뒤 같은 규칙으로 얹어야 재작업 리스크가 낮다.

### D4. 파생 방식 = 읽기 시점 (demand 테이블 기각)
- demand 테이블+트리거는 이 프로젝트가 `venue_span_posting_ids` SSOT로 방금 막은 "발산" 패턴 재도입 + requirements 편집 시 재계산 누락 리스크. 읽기 시점 파생이 기존 아키텍처(headcount도 work_logs COUNT 즉시 계산)와 일치하고 저위험.

## 3. 비목표 (Non-goals)

- 역할별/시간대별 필요 인원 분해(날짜당 단일 합만 — softTarget과 축 일치).
- 대회 공고의 그리드 편입.
- demand 테이블 신설·트리거.
- fixed 스케줄(요일 반복)의 파생(수동 목표 유지).
- `venue_span_posting_ids` 조건 변경(불변 SSOT).
- 그리드 표면 승격/홈 스트립(③ 별도).

## 4. 변경 지점

| 레이어 | 파일 | 변경 |
|---|---|---|
| DB | 신규 마이그레이션 | `DROP FUNCTION get_venue_grid_summary` → `CREATE`: 반환에 `required_count int` 추가, 스팬 공고 requirements를 날짜별 Σ count 산출(dated만) |
| 연결(클라) | `src/domains/job-posting/serialization.ts:328-336` + 공고 작성 폼 | 단독=기본 지점 자동 `venue_id`, 멀티=선택 칩. 대회 제외. `get_or_create_venue_container` 재사용 |
| 연결(훅) | 공고 생성 서비스/훅 | 등록 전 활성 워크스페이스 지점 수 판정 → 자동/선택 분기 |
| 클라 타입 | `src/domains/weeklyGrid/buildGridCells.ts:12-20` `GridSummaryRow` | `requiredCount` 필드 추가 |
| 클라 로직 | `buildGridCells.ts:22-54`, `gridSlotState.ts:44-70` | `softTarget = max(manualSoftTarget, requiredCount)` 병합 |
| 리포지토리 | `src/repositories/supabase/WeeklyGridRepository.ts:20-48` | RPC 응답 camelCase 매핑에 `requiredCount` 추가 |
| 캐시 | 이미 충족 | `useJobManagement.ts:126-132`가 공고 생성 시 `weeklyGrid.all` 무효화 |

## 5. 리스크

| 리스크 | 대응 |
|---|---|
| 단독 자동 연결이 그리드 미사용 employer에게도 컨테이너 생성(dormant 데이터) | 비-대회 공고만, 멱등 get_or_create, flag OFF면 비노출. flag ON 시 데이터 이미 준비 — 의도된 부수효과 |
| 반환 타입 변경 → 기존 RPC 호출부 깨짐 | `DROP+CREATE` 마이그, `WeeklyGridRepository` 매핑 동시 갱신, jest로 계약 고정 |
| seat-basis 미머지 상태에서 착수 | D3 순서 준수 — seat-basis prod 적용 후 |
| fixed 스케줄 파생 누락 오해 | 스펙 명시(수동 목표 유지) + UI 툴팁 여지 |
| requirements 중복 role 엔트리 과대/과소 | seat-basis와 동일 SUM 규칙 사용(peak MAX 아님) — 컨벤션 일치 |
| RLS: get_venue_grid_summary는 SECDEF | 기존 인가 게이트(owner 확인) 유지, requirements 읽기는 스팬 내 공고라 추가 노출 없음 |

## 6. 테스트 전략

- DB: pgTAP — 스팬 dated 공고 2건의 날짜별 Σ count 파생 정확성, fixed 제외, 대회 미포함, 반환 계약(required_count 열).
- 연결: `serialization` 단위 — 단독=venue_id 자동, 멀티=선택값, 대회=NULL 유지(기존 `serialization.venue.test.ts` 확장).
- 병합: `buildGridCells`/`gridSlotState` 단위 — `max(수동, 파생)` 및 파생만/수동만 케이스.
- 리포지토리: RPC 매핑 requiredCount.
- Red-Green: 파생 추가 전 "일반 공고가 그리드에 0으로 안 잡힘" 테스트 → 연결+파생 후 반영.

## 7. 공통 제약

- UI 문자열·커밋·주석 한글. camelCase(클라)/snake_case(DB). 불변성.
- 마이그레이션은 MCP `apply_migration` 전용(db push 금지), 기존 마이그 수정 금지.
- SECDEF 하드닝 규칙(anon EXECUTE REVOKE·search_path·NULL fail-closed) 준수.
- **seat-basis 머지 후 착수**(D3).
