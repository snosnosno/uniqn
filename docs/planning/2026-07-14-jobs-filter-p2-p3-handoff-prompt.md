# 핸드오프 — 구인구직 필터 P2(역할)·P3(급여) 끝까지 구현 (다음 세션 메인 프롬프트)

> 설계 원본: `docs/planning/2026-07-14-jobs-filter-region-ux-role-salary-design.md` (§3 역할, §4 급여, §5 통합 UI) — **먼저 Read**.
> 이 문서를 프롬프트로 받은 세션은 P1 출하 마무리 → P2 → P3 순으로 사용자 추가 확인 없이 끝까지 진행한다(push/PR 포함 — 사용자가 이 핸드오프로 위임함). 단 prod 마이그레이션 적용 직전에는 1회 확인.

## 0. 현재 상태 (2026-07-14 세션 종료 시점)

- **P1(지역 UX 개편) 구현·리뷰 완료, 미push**: 워크트리 `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\region-filter-p1`, 브랜치 `feat/region-filter-p1`
  - `c28df6689` P1 구현 / `5dfdf9593` 리뷰 후속(M2·L4 반영) / `38736647b` origin/master 재통합
  - code-reviewer(fable) 판정 **APPROVE**. 검증 실측: tsc 0에러·eslint clean·jest 59/59(4스위트)
  - node_modules 는 메인 레포로 junction 연결됨(`mklink /J`) — npm install 불필요
- **P1 핵심 구조** (P2·P3가 그대로 확장할 것들):
  - 선택 모델 `src/utils/regionSelection.ts` (토큰 slug|'group:서울', 테스트 14)
  - `src/stores/jobFilterStore.ts` (zustand+MMKV persist — P2 roles·P3 salary 필드를 여기에 추가)
  - `src/components/jobs/filters/` — FilterBar(pill 행)·RegionFilterSheet·index.ts
  - `JobPostingRepository.ts`의 `applyRegionScope` 헬퍼 — getList/getTypeCounts **동일 스코프 단일 지점**(EF-jobsearch-11 카운트-목록 불일치 방지). P2 roles·P3 salary 조건도 같은 방식으로 공용화할 것
  - `usePostingTypeCounts` — `regions`·`keepPreviousCounts` 옵션 존재
- **P1 잔여 사니티(LOW)**: 로컬 Supabase 스택(`npm run db:start`)에서 `regions: ['서울 강남구','경기 수원시']` `.in()` 1회 실측(공백 slug 인용) — 스택 다운으로 미수행
- 키오스크 주문서는 **이미 master 머지·출하 완료**(#246/#247) → P3의 serialization.ts 착수 게이트 해소됨

## 1. 작업 순서

### STEP A — P1 출하
1. 세션 시작 프로토콜: 메인 체크아웃 git status 확인(다른 세션 작업물 있으면 무시하고 **기존 워크트리에서 계속**), `git fetch origin master` 후 stale-base면 merge 재통합(squash 레포 — rebase 금지)
2. P1 잔여 사니티 실측(위) → PASS 확인
3. push + PR 생성(`/pr` 스킬 또는 gh). PR 본문에 설계 문서 링크 + 검증 증거. **머지 직전 최신 master 재통합+재검증** 관례 엄수
4. 머지 후 P2·P3는 같은 워크트리에서 새 브랜치(`feat/role-salary-filter-p2p3`) — master 재기반

### STEP B — P2 역할 필터 (백엔드 완성, UI+인덱스만)
1. **마이그레이션 1건** (MCP `apply_migration` 전용, 기존 마이그 수정 금지):
   `CREATE INDEX IF NOT EXISTS idx_job_postings_role_keys ON public.job_postings USING gin (role_keys);`
   — 인덱스 뿐이라 RLS 비관여. 로컬 `npm run db:reset` 파리티 통과 확인 후 prod 적용(사용자 1회 확인)
2. `jobFilterStore`에 `roleFilters: StaffRole[]` (+persist·sanitize — 유효값 dealer/floor/serving/manager/staff 5종, **'other' 제외**: role_keys 가 `other:자유텍스트`라 overlaps 매칭 불가)
3. `RoleFilterSheet` — 5종 멀티선택 칩 + 적용(카운트 미리보기는 P1 패턴 재사용). FilterBar에 [역할] pill 추가(활성 라벨 "딜러 외 1")
4. **정합 필수**: `getTypeCounts` Pick에 'roles' 추가 + getList와 같은 `overlaps('role_keys', ...)` 적용(applyRegionScope처럼 공용 함수로) + `usePostingTypeCounts`에 roles 전달. home-jobs filters에 `result.roles` 배선(레포는 이미 filters.roles 처리함 — `JobPostingRepository.ts` overlaps, slice(0,10) 캡 유지)
5. 검증: 신규 스토어/시트 테스트 + JobsScreen 회귀 + tsc/eslint/prettier

### STEP C — P3 급여 필터 (컬럼 3+백필 — 유일한 DB 실작업)
1. **마이그레이션** (순서 게이트: 컬럼 먼저 → 코드 나중):
   - `salary_hourly_max integer` / `salary_daily_max integer` / `salary_monthly_max integer` 컬럼 추가
   - 부분 인덱스: `(salary_hourly_max) WHERE salary_hourly_max IS NOT NULL` (daily/monthly 동일)
   - **백필**: `compensation->'defaultSalary'` + `jsonb_array_elements(role_catalog)->'salary'` 를 타입별 GREATEST 집계. `amount` 문자열 이력 대비 `NULLIF(...,'')::numeric` 방어. 'other'(협의)는 NULL 유지
   - 로컬 파리티 스택에서 백필 결과 실측(샘플 공고 3종: shared/by_role/협의) 후 prod(사용자 1회 확인)
2. **쓰기 경로**: `src/domains/job-posting/serialization.ts` — `getRoleKeysFromCatalog` 옆에 `getSalaryBounds(compensation, roleCatalog)` 추가, toDocument에 3필드 포함. TABLE_COLUMNS(Repository/Application/Settlement Helpers 3곳)에 컬럼 추가 여부는 **읽기 불필요하므로 select 미포함이 기본** — 필터는 서버측 where만 쓴다. 단 supabase.ts 타입 재생성 필요(`mcp generate_typescript_types` 또는 수동)
3. **필터**: `JobPostingFilters`에 `salaryType?: SalaryType`, `salaryMin?: number` + zod jobFilterSchema 동기(침묵 드롭 함정 — P1 리뷰 M1과 동일 클래스) + repository gte 매핑(타입별 컬럼) — getList/getTypeCounts 공용
4. **UI**: `SalaryFilterSheet` — 타입 세그먼트(시급/일급/월급) + 프리셋 칩(시급 1.1/1.2/1.3/1.5/2만+, 일급 10/12/15/20만+), "급여 협의 공고는 제외돼요" 캡션. FilterBar [급여] pill(라벨 "시급 1.3만+")
5. matching 의미론: 해당 타입 급여 행(default+역할별) **최대값 ≥ 기준** — min이 아니라 max(설계 §4 근거)
6. 검증 + code-reviewer(fable) 디스패치 + 커밋·push·PR

### STEP D — 마무리
- OTA 출하는 별도 사용자 게이트(전 규칙: OTA 직전 재fetch+ff, Commit필드=origin HEAD)
- `/session-wrap` + 메모리 토픽파일(`project_posting_filter_p1_p2_p3`) 갱신 + 필요 시 `/ingest`

## 2. 함정 (이 작업에서 실제로 밟은/밟을 것들)

- **삼항 분기 내 `dark:text-off-white` 금지** — ESLint no-restricted-syntax가 막음. `text-content-primary` 등 CSS var 토큰 사용 (P1에서 3건 적발됨)
- **중첩 RN Modal 금지**(iOS 터치먹통) — 시트는 각각 독립 오픈, FilterBar pill들이 서로 다른 시트를 동시에 못 열게
- **카운트-목록 정합**: 새 필터 축 추가 시 getList와 getTypeCounts에 **반드시 같은 조건** — 공용 헬퍼 확장으로 강제
- **zod 스키마 동기**: JobPostingFilters에 필드 추가하면 jobFilterSchema에도 — strip 모드 침묵 드롭
- **시트 미리보기 쿼리**: SheetBody는 visible일 때만 마운트(P1 패턴) + keepPreviousCounts
- **jobFilterStore onRehydrateStorage의 queueMicrotask 제거 금지** — MMKV 동기 hydration TDZ 크래시(주석 있음)
- **Supabase 마이그는 MCP apply_migration 전용**, db push 금지. 신규 **함수** 만들면 `REVOKE FROM anon` 명시(이번엔 함수 없음이 기본)
- **prod 파리티**: 마이그 후 로컬 `db reset`==prod 가드(pgTAP+CI parity-smoke)가 있으므로 기대값 갱신이 필요한지 확인. 공유 Docker 스택 함정 — pgTAP 전 스택 상태 재확인
- **테스트 날짜**: `toISOString()` 기반 날짜 생성은 KST 00~09시 플레이크 — 고정 날짜 문자열 사용
- **리뷰 디스패치된 커밋 amend 금지** — 후속은 append 커밋

## 3. 완료 기준

- [ ] P1 PR 머지 + P2·P3 PR 머지(또는 단일 PR이면 리뷰 통과)
- [ ] GIN 인덱스·salary 컬럼 3·백필이 로컬 파리티 스택 + prod 양쪽 적용
- [ ] 신규 공고 작성 시 salary_*_max 자동 세팅 실측(로컬)
- [ ] 필터 조합(지역+역할+급여) 시 목록과 칩 카운트 일치 실측
- [ ] tsc/eslint/prettier/jest 전부 그린 (증거 필수 — "될 것" 금지)
- [ ] 실기기 QA·OTA는 사용자 게이트로 문서화만
