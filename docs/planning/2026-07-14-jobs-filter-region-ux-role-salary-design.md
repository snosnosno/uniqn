# 구인구직 필터 개선 — 지역 UX 분석 + 역할·급여 필터 설계 (2026-07-14)

> 상태: 설계 초안 (구현 전). 대상 화면: `app/(app)/(tabs)/home-jobs.tsx` (구직자 브라우즈).

## 0. 결론 요약

- **지역필터 최대 문제는 "서울 전체/경기 전체"를 고를 수 없다는 것** — 현재 정확히 1개 slug만 eq 매칭. 2-패널 시트 + 그룹 전체 + 멀티선택 + 선택 영속화로 개편.
- **역할 필터는 백엔드가 이미 완성돼 있다** — `role_keys text[]` 컬럼 + `filters.roles` overlaps 쿼리가 레포지토리에 배선됨(`JobPostingRepository.ts:149`). UI만 노출하면 되고, **GIN 인덱스만 신규 마이그레이션 필요**.
- **급여 필터는 비정규화 컬럼이 필요** — 급여가 `compensation jsonb`(shared) + `role_catalog jsonb` 배열(by_role)에 흩어져 있어 서버 범위필터 불가. `role_keys`와 같은 패턴(쓰기 시 클라이언트 계산)으로 `salary_*_max` 컬럼 3개 + 백필.

## 1. 현황 실측 (근거)

| 항목 | 실측 |
|---|---|
| 필터 UI | 지역 pill 1개 → `RegionSelectModal` (바텀시트, 67개 flat 그룹 리스트, 단일선택, 선택 즉시 닫힘) |
| 지역 쿼리 | `eq('location->>region', slug)` — `JobPostingRepository.ts:151`, 인덱스 `idx_job_postings_location_region` 존재 |
| 지역 상수 | `src/constants/regions.ts` — 서울 25구 + 경기 31시군 + 광역 7 + 제주 2 + 기타/해외 = 67 slug, 그룹 5종 |
| 역할 데이터 | `job_postings.role_keys text[]` (base_schema:130), 쓰기 시 `serialization.ts:304` `getRoleKeysFromCatalog`로 항상 채워짐. 커스텀은 `other:커스텀명` |
| 역할 쿼리 | `filters.roles` → `.overlaps('role_keys', ...)` 이미 구현. **GIN 인덱스 없음** (base_schema는 owner/status만) |
| 급여 데이터 | `compensation jsonb` = `{mode:'shared'|'by_role', defaultSalary:{type,amount}}` + by_role은 `role_catalog jsonb` 배열 각 항목 `salary` |
| 급여 타입 | `SalaryType = 'hourly'|'daily'|'monthly'|'other'` (`types/jobPosting.ts:42`) |
| 타입칩 카운트 | `getTypeCounts(status, region)` — region만 반영. 필터 추가 시 정합 확장 필요 (과거 EF-jobsearch-11 카운트-목록 불일치 버그 클래스) |
| 필터 상태 | `useState` 로컬 — 탭 리마운트/앱 재시작 시 초기화, 영속화 없음 |
| 검색 모드 | 필터 전체 무시(안내 카피 존재) — 유지 |

## 2. 지역필터 UX 분석

### 문제점 (심각도순)

1. **그룹 전체 선택 불가** — "서울 아무 데나"가 불가능. 강남구 하나만 고르면 서초 공고가 안 보임. 공고 밀도가 낮은 초기 서비스에서 빈 결과를 양산하는 구조.
2. **67개 flat 스크롤** — max-h 420px 시트에서 서울→경기→광역시 순서로 길게 스크롤. 경기 남부 사용자는 매번 25개 구를 지나야 함.
3. **단일선택** — 강남+서초+송파 같은 인접 생활권 선택 불가.
4. **선택 미영속** — 앱 재시작마다 '지역 전체'로 리셋. 상습 사용자는 매번 재선택.
5. **최근/추천 없음** — 직전 선택·프로필 지역 활용 없음.

### 개선안 (우선순위)

**A. 2-패널 시트 + 그룹 전체 (필수)** — 알바몬/직방 표준 패턴. 시트 높이 ~85%, 3층 구조(①바로가기 ②탐색 ③확인).

> 방식 비교(2026-07-14): **아코디언**은 경기 31개 펼치면 여전히 긴 스크롤 + 펼친 그룹이 다른 그룹 헤더를 화면 밖으로 밀어냄 → 탈락. **드릴다운(시/도→구/시 화면 전환)**은 멀티선택에서 그룹 간 왕복 비용 → 탈락. 2-패널은 "단계"를 화면 전환이 아닌 시선 이동으로 해결하고 그룹 5개가 항상 보임.

```
┌──────────────────────────────────┐
│ 🔍 지역 검색 ("강" → 강남·강동·강북…)  │ ① 바로가기층
│ 최근 [강남구][수원시] · 내지역 [서초구] │
├───────┬──────────────────────────┤
│ 서울 ②│ [✓ 서울 전체]              │
│ 경기   │ ──────────────           │ ② 탐색층
│ 광역시 │ ☐강남구 ☐강동구            │   좌: 그룹탭(+선택수 배지)
│ 제주   │ ☐강북구 ☐강서구            │   우: 2열 칩 그리드, 가나다순
│ 기타   │  …                       │
├───────┴──────────────────────────┤
│ 선택 2: [강남구 ✕][서초구 ✕]  초기화  │ ③ 확인층 (하단 고정 트레이)
│ [ 공고 12건 보기 ]                  │
└──────────────────────────────────┘
```
- "서울 전체" = 그룹 slug 목록으로 확장해 `.in('location->>region', [...25])` — 기존 btree 표현식 인덱스 그대로 사용, DB 변경 0.
- 광역시는 시 단위 slug라 "전체" 불필요(개별=전체).
- **마이크로 규칙**: ⑴ 검색 중엔 패널 대신 플랫 결과 리스트(그룹 병기 "서울 · 강남구") ⑵ 좌측 탭에 그룹별 선택 수 배지 — 안 보이는 그룹의 선택 상태 상시 노출 ⑶ **경기만** `subGroup`(남부/북부) 소섹션 헤더 추가(regions.ts 데이터 필드만, slug 불변) — 서울 25개는 가나다 2열로 충분 ⑷ 전체↔개별 상호배타(전체 선택 시 개별 해제, 전체 상태에서 개별 탭 = 전체 해제+해당 개별만) ⑸ 하단 트레이에 선택 칩+결과 건수 상시 ⑹ single 모드(공고작성)는 전체 옵션·트레이 제외, 탭 즉시 선택·닫힘.

**B. 멀티선택 (필수, 최대 5개)** — `JobPostingFilters.region: string` → `regions: string[]` 추가(기존 region은 하위호환 유지). eq → in. pill 라벨: `강남구 외 2`.

**C. 선택 영속화 + 최근 지역 (권장)** — zustand persist(MMKV)로 필터 스토어 신설. 최근 선택 3개를 시트 상단 칩으로. 프로필 지역 자동 적용은 **하지 않음**(빈 결과 오인 위험) — 최근 칩 후보로만 노출.

**D. 적용 버튼 + 결과 카운트 미리보기 (권장)** — 멀티선택 전환으로 즉시닫힘 UX가 깨지므로 "공고 N건 보기" 버튼. N은 `getTypeCounts` 재사용(선택 지역 파라미터로 총계). v1에서 카운트 미리보기가 부담이면 "적용"만.

> 기존 `RegionSelectModal`은 공고작성 폼(`BasicInfoSection`)에서 단일선택으로 계속 사용 — 건드리지 않고 브라우즈 전용 `RegionFilterSheet`를 신설한다.

### 2-A. "자기 지역 쉽게 찾기" — 지도 API 검토 결과 (2026-07-14 추가)

**결론: 지도 API는 지금 단계 부적합. 검색 인풋 + 프로필 지역 추천(OTA 가능)으로 해결하고, 현재 위치 버튼은 다음 바이너리 릴리스에 편승.**

지도 부적합 근거 (실측):
1. **공고 좌표 데이터가 0건** — `Location.coordinates`는 타입 선언만 존재하고 참조하는 코드가 전무(`types/common.ts` 1곳). 지도에 찍을 데이터 자체가 없어 전 공고 지오코딩 백필 + 작성 폼 좌표 수집부터 필요.
2. **필터 분류 체계가 행정구역 slug 67개** — 지도 탭을 slug로 변환하려면 역지오코딩 또는 행정동 폴리곤이 필요. 필터 목적 대비 과투자.
3. **카카오/네이버 지도 SDK = 네이티브 모듈** — 새 EAS 빌드 + 스토어 심사 필요, OTA 출하 불가. API 키·과금 관리 추가.

대안 3단 (비용 오름차순):
| 단계 | 방법 | 출하 경로 |
|---|---|---|
| ① 시트 내 검색 인풋 | "강남" 타이핑 → `RegionOption.keyword`/label 즉시 필터 | OTA, 의존성 0 |
| ② 프로필 지역 추천 칩 | `users.region` 자유텍스트("예: 서울 강남구") → 기존 `findRegionByAddress()`로 slug 변환 → 시트 상단 "내 지역: 강남구" 칩. 매핑 실패/미입력 시 미표시 | OTA, 권한 0 |
| ③ 현재 위치 버튼 | `expo-location` `reverseGeocodeAsync`(OS 지오코더, API 키 불필요) → district 텍스트 → `findRegionByAddress()`. 버튼 탭 시에만 권한 요청, 거부 시 조용히 폴백 | **미설치 → 네이티브 모듈 추가 = 새 EAS 빌드+심사.** 다음 바이너리에 편승 |

①②는 P1에 포함, ③은 P1-후속(바이너리 게이트)으로 분리. "내 주변 N km" 지도 탐색은 좌표 수집+PostGIS 반경 쿼리+지도 SDK가 한 묶음인 별개 에픽으로, 필터 개선과 혼합하지 않는다.

### 2-B. 공고작성→브라우즈 통합 지역 선택 (구인자·구직자 공용, 2026-07-14 추가)

**원칙: 지역 선택기는 하나만 만들어 3개 접점(공고작성·구직 필터·사장 브라우즈)에서 재사용하고, 접점별 보조 장치만 달리한다.**

**공용 컴포넌트 `RegionPickerSheet`** (2-패널 + 시트 내 검색 + 최근 지역 + 추천 칩):
- `mode: 'single'` — 공고작성. 그룹 전체 선택 **불가**(공고에는 구체 지역 필요), 선택 즉시 닫힘 유지
- `mode: 'multi'` — 브라우즈 필터. 그룹 전체 + 최대 5개 + 적용 버튼
- 기존 `RegionSelectModal`은 작성 폼 교체 완료 후 제거

**최근 지역 공유 저장소** (MMKV, 역할 무관 단일 키): 작성에서 고른 지역도 필터에서 고른 지역도 같은 최근 목록에 쌓임 → 가게 지역이 고정적인 사장은 사실상 1탭 선택.

**접점별 특화**:
| 접점 | 추천 칩 소스 | 추가 장치 |
|---|---|---|
| 공고작성(employer) | 직전 공고 region 프리필 + 주소 자동 제안(기존 `findRegionByAddress`) | 아래 위생 3종 |
| 구직 필터(staff) | 프로필 지역(`findRegionByAddress` 변환) + 최근 | 그룹 전체·멀티 |
| 사장 브라우즈 | 최근(=자기 공고 지역이 자연히 상단) | 필터 P1 그대로 공용 |

**작성 폼 위생 3종 (실측 발견 갭)**:
1. **stale region 갭**: `BasicInfoSection.tsx:108` — region은 최초 자동 제안 후 고정(`dataRef.current.location?.region ?? findRegion...`). 주소를 "서울 강남구"→"부산 해운대구"로 고쳐도 region이 서울 강남구로 남는다. 개선: 자동 제안된 region은 주소 변경 시 재계산, 사용자가 시트에서 **수동 선택한 region만 잠금**(auto/manual 출처 플래그).
2. **region 선택사항 → 필터 누락 구멍**: 지역 미설정 공고는 지역 필터에서 영구 제외. 제출 시 region 없으면 인라인 넛지("지역을 설정하면 지역 필터에 노출돼요") + 자동 제안 실패 시 시트 유도. 필수 전환 여부는 제품 결정(권장: 넛지 1릴리스 → 설정률 보고 필수화).
3. **기존 미설정 공고 백필**: `location->>address` 키워드 매핑(regions.ts 67개 keyword의 SQL CASE 이식)으로 1회 백필 — 지역 필터 커버리지 직결. 백필 전 미설정 비율 실측 선행.

**롤아웃 순서(키오스크 브랜치 충돌 회피)**: `RegionPickerSheet` 독립 신설 → P1 필터에 먼저 적용 → **키오스크 머지 후** 작성 폼 교체 + 위생 3종 반영.

## 3. 역할 필터 설계 (백엔드 완성 — UI + 인덱스만)

- **UI**: FilterBar에 `[역할 ∨]` pill → 바텀시트, 5개 표준 역할 멀티선택 칩(딜러/플로어/서빙/매니저/직원). `other`(커스텀)는 v1 제외 — key가 `other:자유텍스트`라 overlaps 정확 매칭 불가.
- **쿼리**: 기존 `filters.roles` 그대로 (`overlaps`, 10개 캡 이미 존재).
- **마이그레이션 (신규 1건)**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_job_postings_role_keys
    ON public.job_postings USING gin (role_keys);
  ```
  overlaps는 GIN 없으면 seq scan. (신규 함수 아님 — anon grant 함정 해당 없음)
- **매칭 의미**: 선택 역할 중 하나라도 모집하면 노출(OR). 카드에는 이미 역할별 급여/마감이 표시되므로 추가 표기 불필요.

## 4. 급여 필터 설계 (비정규화 필요)

### 왜 jsonb 직접 필터가 안 되나
- shared 모드는 `compensation->defaultSalary->amount`로 가능하지만, **by_role 모드는 `role_catalog` jsonb 배열 내부**라 PostgREST로 원소 범위필터 불가 → by_role 공고가 전부 누락되는 반쪽 필터가 됨.

### 설계: `role_keys`와 동일 패턴 (쓰기 시 계산 + 백필)

**컬럼 (마이그레이션)**
```sql
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS salary_hourly_max integer,
  ADD COLUMN IF NOT EXISTS salary_daily_max integer,
  ADD COLUMN IF NOT EXISTS salary_monthly_max integer;
-- 브라우즈 필터 대상만 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_hourly
  ON public.job_postings (salary_hourly_max)
  WHERE salary_hourly_max IS NOT NULL;
-- (daily/monthly 동일 — 사용량 보고 후행 추가 가능)
```
- **max 의미**: 해당 타입 급여 행(default + role_catalog 전체) 중 최대 금액. "시급 13,000 이상" = 이 공고에서 그 이상 받을 수 있는 역할이 존재. min(전 역할 충족)은 과도하게 엄격해 공고를 숨김.
- `other`(협의)는 컬럼 3개 모두 NULL → 급여 필터 활성 시 제외. 시트에 "급여 협의 공고는 제외돼요" 캡션 1줄.

**쓰기 경로**: `serialization.ts`의 `toDocument`에서 `getRoleKeysFromCatalog` 옆에 `getSalaryBounds(compensation, roleCatalog)` 추가 — 클라이언트 단일 지점. draftAdapter는 location 필드가 아니므로 무관(#194 함정 비해당)이나 매퍼 전수 확인은 리뷰 체크리스트에 포함.

**백필 (같은 마이그레이션)**: 기존 행을 SQL로 계산. `compensation->'defaultSalary'` + `jsonb_array_elements(role_catalog)`의 `salary` 를 타입별 GREATEST 집계. `amount`가 문자열로 저장된 이력 대비 `NULLIF(...,'')::numeric` 방어.

**쿼리**: `filters.salaryType + salaryMin` → `.gte('salary_hourly_max', min)` (타입별 컬럼 매핑).

**UI**: `[급여 ∨]` pill → 시트: 타입 세그먼트(시급/일급/월급) + 프리셋 칩(시급: 1.1만+ / 1.2만+ / 1.3만+ / 1.5만+ / 2만+, 일급: 10만+ / 12만+ / 15만+ / 20만+). 슬라이더는 v2. pill 라벨: `시급 1.3만+`.

## 5. 통합 FilterBar + 상태 설계

```
[검색바]
[긴급 N][대회 N][일반 N][고정 N]          ← 기존 타입칩 유지
[📍강남구 외 2 ∨][역할 ∨][급여 ∨] [초기화]  ← 신규 FilterBar (가로 스크롤)
```

- `src/components/jobs/filters/` 신설: `FilterBar.tsx`, `RegionFilterSheet.tsx`, `RoleFilterSheet.tsx`, `SalaryFilterSheet.tsx`
- `src/stores/jobFilterStore.ts` (zustand + MMKV persist): `{ regions[], roles[], salaryType?, salaryMin?, recentRegions[] }`. home-jobs의 `filters` useMemo가 스토어를 소비.
- 활성 필터 1개 이상이면 `초기화` 칩 노출. 각 pill은 활성 시 primary 스타일(기존 지역 pill 스타일 재사용).
- **중첩 Modal 금지** — 시트는 각각 독립 오픈(iOS 터치먹통 함정 `pitfall_nested_rn_modal_touch_dead`).

### 카운트 정합 (필수)
`getTypeCounts` 시그니처를 `Pick<JobPostingFilters, 'status'|'region'>` → `'status'|'regions'|'roles'|'salaryType'|'salaryMin'`으로 확장, getList와 동일 조건 적용. 과거 카운트-목록 불일치가 버그로 확정된 이력(EF-jobsearch-11)이 있으므로 **필터 조건은 getList/getTypeCounts 공용 빌더 함수로 추출**해 이중 구현을 없앤다.

### 빈 결과 카피
기존 지역 안내를 일반화: "조건에 맞는 공고가 없어요. 필터를 넓혀보세요" + [필터 초기화] 인라인 버튼 (impeccable 룰 9).

## 6. 구현 페이즈

| 페이즈 | 내용 | DB 변경 |
|---|---|---|
| **P1 지역 UX** | RegionFilterSheet(2패널·그룹전체·멀티5·최근·영속) + `regions[]` 필터 + FilterBar 골격 + 카운트 정합 | 없음 |
| **P2 역할** | RoleFilterSheet + GIN 인덱스 | 인덱스 1 |
| **P3 급여** | salary_*_max 컬럼+백필+인덱스 → serialization 쓰기 → SalaryFilterSheet | 컬럼 3 + 백필 + 인덱스 |

P1·P2는 독립 출하 가능. P3만 마이그레이션 순서 게이트(컬럼 마이그 → 코드 배포, 역순이면 insert 실패는 없지만 신규 공고 bounds NULL 누락).

## 7. 리스크 / 조율 사항

1. **공고작성 키오스크 브랜치(미머지, 워크트리 job-posting-kiosk-ux)** — `serialization.ts`/`jobPosting.schema.ts` 쓰기 경로를 공유. **P3(급여 쓰기 경로)는 키오스크 머지 후 착수** 권장. P1·P2는 읽기/UI라 충돌면 최소.
2. `location.region` 미보유 구공고는 지금도 지역필터에서 제외 — 그룹/멀티 전환해도 동일(악화 아님).
3. `filters.roles`의 `slice(0,10)` 캡 유지. 멀티 지역도 5개 캡(URL·쿼리 길이 억제).
4. 백필 마이그레이션은 MCP `apply_migration` 워크플로우 준수, 기존 마이그 수정 금지.
5. 타입칩 카운트 확장 시 tournament approvalStatus 클라이언트 집계 로직(`getTypeCounts`)과 조건 동기화 필수.
6. 신규 인덱스는 RLS/권한 비관여 — `/guard` 대상 아님. 단 백필 UPDATE는 prod 적용 전 로컬 `db reset` 파리티 스택에서 실측.

## 부록. 지도 기반 공고 탐색 — 별개 에픽 로드맵 (2026-07-14 논의)

**결론: 요금은 사실상 0(네이버 모바일 SDK 무제한 무료·카카오 지오코딩 무료쿼터)이나, 공고 밀도가 낮은 현 단계에서 지도는 빈약함을 전시하는 역효과. 좌표 파이프라인(M0)만 선행하고 지도 화면은 밀도 임계 후 착수.**

| 단계 | 내용 | 출하 | 비고 |
|---|---|---|---|
| M0 좌표 파이프라인 | 작성 폼 주소→지오코딩→`location.coordinates` 저장 + 기존 공고 백필. 필드는 `types/common.ts`에 이미 존재(데이터 0건) | OTA | 카카오 REST 키는 앱 반입 금지 → **Edge Function 프록시**. 키오스크 브랜치 머지 후(작성 폼 공유) |
| M1 지도 화면 | 네이버 지도 SDK(RN 래퍼+Expo config plugin), 핀+카드 시트, 리스트↔지도 토글 | **새 바이너리+심사** | 밀도 임계(예: 수도권 주간 활성 50건+) 도달 시. 대회 공고부터 여는 선택지 |
| M2 고도화 | 뷰포트 RPC·클러스터링·내 위치 | OTA | 수백 건까지 클라이언트 클러스터링, PostGIS 불필요 |

제품 결정 필요: 핀 위치(정확 주소 vs 구 중심점 — 상세주소 노출 정책 연동), 진입 동선(별도 탭 vs 구인구직 내 토글).
