# 근무표 대회(tournament) 포함 — 설계 (2026-07-19)

> 성격: `2026-07-18-grid-auto-sync-design.md` §2 D1·§3의 **"대회 제외(venue_id NULL 유지)" 결정을 반전**하는 후속 설계.
> 배치: `feat/team-rename-grid-autosync`에 **폴드인**(별도 PR 아님).

## 1. 배경 — 요구사항이 원 스펙을 뒤집었다

도메인 오너 확정: **"대회도 근무표에 껴도 된다 — 대회 기간 동안 몇 명 구했고 몇 명 부족한지 알아야 한다."**

두 케이스 모두 실재한다.
- **(A) 사장이 자기 가게에서 여는 대회** — 그 가게 근무표에 넣으면 자연스럽다.
- **(B) 대회사가 가게 없이 여는 독립 대회** — 붙일 venue 컨테이너가 없다.

## 2. 실측 — 대회 배제는 "설계"가 아니라 클라이언트 가드 2줄이었다

| 층 | 대회를 막나 | 근거 |
|---|---|---|
| DB 제약 | ❌ 없음 | `venue_id`에 posting_type CHECK 제약 전무(전 마이그 grep) |
| 스팬 SSOT | ❌ 안 가림 | `venue_span_posting_ids` = `WHERE venue_id = p_venue OR id = p_venue` (baseline 9617-9623) |
| 파생 계산 | ❌ 안 가림 | `required` CTE에 `posting_type`·`status` 필터 전무 (20260718100000:54-69) |
| 좌석 규약 | ❌ 동일 | 대회 requirements = `PostingDatedSchedule` (jobPosting.ts:109-114), 일반 공고와 동일 |
| **클라 가드** | ✅ **여기만** | `jobManagementService.ts:104`, `venueSelection.ts:35` |

### 2.1 불변식은 이미 새고 있었다

`gridParamsToValues`가 라우트 `venueId`를 폼 값에 넣고(`mappers.ts:492-501`), `valuesToCreateInput`이 `values.venueId`를 **postingType 검사 없이** 통과시킨다(`mappers.ts:157`).

→ **현행 코드에서도** 그리드 "공고 열기"로 진입해 타입을 대회로 바꾸면 그 대회는 `venue_id`를 갖는다. "대회 = venue_id NULL" 불변식은 자동연결·칩 두 경로에만 걸려 있었고 라우트 경로로는 이미 통과하고 있었다.

이 사실이 **"대회면 venueId strip" 하드닝 폐기**를 뒷받침한다. 가드를 제거하면 세 경로가 비로소 일관된다.

### 2.2 좌석 합산식은 SSOT와 표현식 단위로 동일 (검증 완료)

`required` CTE(20260718100000:58,68)와 `_total_positions_from_schedule`(20260718000000:22-29)을 직접 대조:
- count→headcount COALESCE: `COALESCE((r->>'count')::int, (r->>'headcount')::int, 0)` — 동일
- 음수 clamp: `GREATEST(..., 0)` — 동일
- 빈 role 스킵: `COALESCE(NULLIF(btrim(r->>'role'), ''), NULLIF(btrim(r->>'name'), '')) IS NOT NULL` — 동일
- 차이: `GROUP BY (req->>'date')` 날짜 파티션 + `req->>'date' IS NOT NULL`(dated only)

→ **대회 좌석 규약 정합에 필요한 작업 없음.**

### 2.3 승인 상태는 `status`가 아니라 JSONB에 산다

- 대회 생성 시 `job_postings.status = 'active'` **고정**, 승인은 `tournament_config.approvalStatus`('pending'|'approved'|'rejected')에서 별도 진행 (`JobPostingRepository.ts:487-496`, `approvalGate.ts:9-11`).
- 승인/거절/재제출 Edge Function 3종은 `status`를 **한 번도 건드리지 않는다** — `tournament_config`만 UPDATE.
- `required` CTE는 `approvalStatus`를 보지 않는다.

→ ⚠️ **가드를 푸는 순간 활성화되는 결함**: 관리자가 **거절한** 대회의 requirements가 필요인원에 영구 산입된다. 제품 판단 이전의 버그이므로 같은 PR에서 함께 고친다.

## 3. 설계질문 판단

| # | 질문 | 판단 | 근거 |
|---|---|---|---|
| 1 | 근무표가 대회 인원 추적의 옳은 표면인가 | **예** | 그리드는 주간 표가 아니라 **월 캘린더**(셀=날짜 1개, `CalendarGrid.tsx:55-57`). 대회는 기간 이벤트가 아니라 **개별 날짜 목록**(`allDates: string[]`, startDate/endDate 필드 없음). 개념 충돌 없음 |
| 2 | (A) 가게 대회 자동연결 | **자동연결** | B4 가드만 제거. 지점 1개→그 지점, 2개+→칩이 결정 |
| 3 | (B) 독립 대회 | **팀 기본 지점을 그릇으로** | 지점 0개면 `resolveDefaultVenueId`가 기본 지점을 자동 생성 → (A)와 같은 코드 경로. 신규 DB 개념 0 |
| 4 | 승인 상호작용 | **pending 산입 / rejected 배제** | pending은 지원이 막혀 '현재 0'이지만, 그 부족 표시가 계획 정보이자 승인 병목 신호. D-7 버스트에서 승인 대기로 하루 버리는 걸 드러냄 |
| 5 | 좌석 규약 정합 | **이미 정합** | §2.2 |
| 6 | 폴드인 vs 별도 PR | **폴드인** | 이번 배치의 `f25234c91`·`5f132d9a8`가 뒤집힐 불변식을 주석으로 못박고 있음. 아직 push/PR 전이라 외부 계약 없음. 마이그 배포 1회·재검증 1회 |

## 4. 변경 — 3곳

### ① 자동 연결 가드 제거 — `src/services/jobs/jobManagementService.ts:104`

```diff
- if (getCanonicalPostingType(input.postingType) !== 'tournament' && !resolvedVenueId) {
+ if (!resolvedVenueId) {
```

`getCanonicalPostingType` import가 이 파일에서 죽으면 함께 정리한다.

### ② 칩 적용 가드 제거 — `src/utils/order-sheet/venueSelection.ts:35`

```diff
- if (selectedVenueId && postingType !== 'tournament') {
+ if (selectedVenueId) {
```

`postingType` 파라미터가 죽으므로 시그니처에서 제거하고 호출부(`app/(employer)/my-postings/create.tsx:153`)와 테스트를 동반 수정한다. 파일 상단 JSDoc의 "대회 가드 필수" 주석 블록(25-28행)도 새 규약으로 교체한다.

`shouldShowVenueChips`는 `postingType`을 보지 않으므로(지점 2개+ && 라우트 venueId 없음) 대회 선택 시에도 칩은 이미 렌더된다 — 지금은 고르면 조용히 증발한다(`whitelist-silent-drop` 재발 클래스). 가드 제거로 함께 해소된다.

### ③ 거절 대회 배제 — 신규 마이그레이션

기존 마이그(20260718100000) **수정 금지**. 새 파일에서 `get_venue_grid_summary`를 `CREATE OR REPLACE`하고 `required` CTE에 한 줄 추가:

```sql
AND NOT (jp.posting_type = 'tournament'
         AND COALESCE(jp.tournament_config->>'approvalStatus', '') = 'rejected')
```

> ⚠️ **`COALESCE` 필수 (2026-07-19 구현 중 실측 교정)**: 이 문서 초안은 `COALESCE` 없이 `jp.tournament_config->>'approvalStatus' = 'rejected'`를 제시했으나 **결함이다**. `tournament_config`는 nullable이고 CHECK 제약도 default도 없어서, NULL이면 `NOT (true AND NULL)` = `NULL`이 되어 WHERE가 false로 취급 → **거절되지 않은 대회가 통째로 집계에서 탈락**한다(과소집계).
>
> 라이브 실측으로 확인된 탈락 상태는 4가지다: `tournament_config` IS NULL · `{}`(키 부재) · `{"approvalStatus":null}` · `posting_type` NULL + config NULL. 방향이 "필요 인원이 조용히 줄어드는" 쪽이라 발견이 어렵다.
>
> pgTAP 9번이 이 회귀를 잡는다. 이 SQL을 어디선가 재작성하게 되면 `COALESCE`를 반드시 유지하라.

나머지 CTE 본문·시그니처·`search_path`·GRANT는 원본과 바이트 동일하게 유지한다.

## 5. 손대지 않는 것

좌석 합산식 · 스팬 SSOT · 그리드 UI · `max(수동 목표, 파생 좌석합)` 병합(`buildGridCells.ts:35-37`) · RPC 응답 컬럼 · 대회 승인 흐름 자체. **신규 DB 개념 0, RPC 시그니처 변경 0.**

## 6. 검증 계획 (exit proof)

| 항목 | 명령/방법 | 통과 기준 |
|---|---|---|
| 칩 가드 반전 | `venueSelection.test.ts` 대회 케이스 반전 | **red-green 실측** — 수정 전 기존 테스트가 먼저 깨지는 것을 확인 |
| 자동연결 | `resolveDefaultVenueId` 대회 케이스 jest 신규 | 대회가 기본 지점에 연결됨 |
| 거절 배제 | pgTAP 신규 | rejected 미산입 / pending·approved 산입 / 비대회 무회귀 |
| 전체 | `npm run quality` | exit 0 |
| 전체 | 전체 jest | 0 failure (기준선: 499스위트/5645 pass) |
| DB | `npm run test:db:helpers && npx supabase test db` | `grid_auto_sync` ok |

## 7. 범위 밖 — 이월 (추적만)

### 7.1 `required` CTE에 `job_postings.status` 필터가 전무

**취소된(`cancelled`) 일반 공고의 requirements도 필요인원에 계속 산입된다.** 대회와 무관하게 현재 배치에 이미 존재하는 동작이다.

`closed`는 만석 마감(capacity_full→closed)일 수 있어 배제하면 required가 떨어지고 headcount는 남아 셀이 왜곡되므로, 상태별 구분 판단이 필요하다. 이번 범위에 넣지 않고 TODOS로 이월한다.

### 7.2 캘린더 셀의 "대회 있는 날" 표식 — 제외

설계 목업(2026-07-19)에서 셀에 대회 표식(골드 점)을 그려봤으나 **이번 범위에서 제외**한다.

이유: 셀에 표식을 그리려면 `get_venue_grid_summary`가 날짜별 "대회 포함 여부"를 반환해야 하고, 이는 §5의 **"RPC 응답 컬럼 변경 0"과 충돌**한다.

> ⚠️ **초안의 완화 근거는 거짓이었다 (2026-07-19 최종 리뷰 실측 교정)**: 초안은 "날짜를 탭하면 상세 패널의 슬롯 행에 `대회` 배지가 이미 뜨므로 정보는 한 탭 거리에 있다"고 적었으나 **그런 배지는 존재하지 않는다.**
>
> 실측: `대회` 문자열이 `src/components/weeklyGrid/`·`src/domains/weeklyGrid/`·`src/hooks/weeklyGrid/` 전체에 **0건**. 원인은 `venueDayDetailMapping.ts:30-44` 의 `mapVenueDaySlotToConfirmedStaff` 가 RPC 가 반환하는 `job_posting_id`·`is_container` 를 **투영에서 떨구기** 때문이다. `ConfirmedStaff` 에 공고 정체성 필드가 없어 `VenueDayDetail` 은 이름·역할·시간·상태만 렌더한다.
>
> **따라서 완화책은 전무하다.** 이 배치로 대회 좌석이 `required_count` 를 올려 셀의 필요/부족이 커지는데, 운영자는 그 수요가 대회에서 왔다는 사실을 그리드 **어느 깊이에서도** 확인할 수 없다.

재검토 조건 → **선행 과제로 격상**: "평소 운영 vs 대회" 구분은 실사용 확인을 기다릴 사안이 아니라, 이 배치가 만든 정보 격차다. 두 갈래 중 하나를 택해야 한다.
- (a) **상세 패널 먼저**(저비용): `mapVenueDaySlotToConfirmedStaff` 투영에 공고 정체성을 살리고 슬롯 행에 배지를 단다. RPC 응답 변경 불필요 — `get_venue_day_slots` 는 이미 `job_posting_id` 를 반환한다.
- (b) **셀 표식까지**(고비용): `get_venue_grid_summary` 에 날짜별 대회 포함 여부 컬럼 추가.

(a)가 초안이 이미 있다고 착각했던 바로 그 기능이며, 비용이 낮고 RPC 계약도 안 건드린다. 우선순위 **P3 → P2**.

### 7.3 대회사에게 "지점" 라벨 — 현행 유지

대회사에게 "지점"은 장소가 아니라 대회를 담는 서랍이라 어색할 수 있으나, **구조가 아니라 문구만의 문제**다. 실사용 피드백 후 라벨만 조정한다. 이번 범위에서 변경하지 않는다.

## 8. 배포 순서 (변경 없음)

prod 마이그(20260718100000 + 이번 신규, flag OFF라 안전) → OTA → `weekly_grid_enabled` ON(맨 마지막).

**머지·push/PR·prod 마이그·OTA·flag ON은 전부 사용자 게이트.**
