---
area: sources
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/src/constants/regions.ts
  - uniqn-mobile/src/utils/regionSelection.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/src/hooks/usePostingTypeCounts.ts
  - uniqn-mobile/src/stores/jobFilterStore.ts
  - uniqn-mobile/src/components/jobs/filters/FilterBar.tsx
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - uniqn-mobile/src/components/region/RegionTaxonomyBrowser.tsx
  - docs/planning/2026-07-14-jobs-filter-region-ux-role-salary-design.md
  - docs/planning/2026-07-14-region-taxonomy-3level-design.md
  - PR#250
  - PR#251
  - PR#254
  - PR#257
tags: [job-posting, filter, region, salary, role, taxonomy]
---

# 소스: 구인구직 필터 3축 + 지역 필수화 (2026-07-14~15, PR#250/#251/#254/#257)

## 무엇 / 왜
구직자 공고 목록에 **3축 필터**(지역 P1·역할 P2·급여 P3)를 얹고, 지역 축을 수도권 편중 5그룹에서 **전국 3단계 택소노미**로 확장한 뒤, 공고작성 폼에서 **지역 제출을 필수화**했다. 타깃([[target-market]])인 단발 알바 구직자가 "내 지역·내 직무·최소 급여"로 공고를 좁히게 하는 게 목적. DB 변경은 P3(salary 컬럼 3개)뿐이고 나머지 축은 기존 `location`/`role_keys` 컬럼 재활용.

## P1 지역 필터 (PR#250 머지 `5b4a2f2ef`)
- 단일선택 모달 → **2패널 바텀시트**(그룹 전체 · 시/구 멀티 최대 5). 선택은 MMKV 영속(`jobFilterStore.ts`). 조회 시 sanity `.in()` 공백 slug 실측 PASS.
- CI 8종 그린(E2E 9m29s). +1362/-64. (주장: 라인 수는 PR 요지)

## P2 역할 + P3 급여 (PR#251 머지 `9ec830acc`)
- `FilterBar.tsx`를 3-pill로 확장. 역할은 멀티선택(`overlaps` 매칭), 급여는 타입별 최소 급여 이상.
- **P3 마이그(prod 적용됨)**: `salary_min_max`·`salary_hour_max`·`salary_day_max` 3컬럼 신설 + 부분 인덱스 + GIN 인덱스 + 백필. prod 백필 실측=공고 11건 중 시급7·일급3·월급0.
- **쓰기 계약(코드 검증됨)**: `serialization.getSalaryBounds`(`serialization.ts:93`)가 defaultSalary + roleCatalog 전체의 GREATEST를 계산해 **3키를 항상 기록**(없으면 null 명시) — 편집 시 stale 컬럼 UPDATE 소거. 이 "빈 값도 null로 기록" 규율은 [[whitelist-silent-drop]] 재발 클래스의 예방책이다.
- **매칭 의미론(주장)**: 타입별 `salary_*_max`(최대값) ≥ 기준 — min 기준은 과도 엄격. 역할 필터 `other` 제외 근거=자유텍스트라 overlaps 매칭 불가.
- code-reviewer(fable) APPROVE(백필 fail-safe CASE 반영). CI 9종 그린(E2E 8m17s + DB Tests).

## 지역 전국 3단계 택소노미 (PR#254 머지 `bfb83ce28`)
- `regions.ts` 67 slug → **277 slug**(8권역 > 시·군 > 구). **기존 67 slug 불변**(스냅샷 가드) → MMKV 저장 필터 무손실 자동 승격.
- 제품결정 3건(사용자 확정): ①좌측 8권역 하이브리드(서울/경기/인천/강원/충청/전라/경상/제주+기타) ②우측 시 칩 + 구 인라인 단일 아코디언 ③구 필터=부모 시 공고 포함(recall 우선, 구 백필 보류).
- 선택 모델: 시 slug를 "시 전체" 토큰으로 오버로드(`city:` 신설 없음). 3층 상호배타.
- 2026-07 행정구역 반영: 인천 9구 개편·화성 4구·군위→대구·광주+전남 통합(slug 불변·주소 폴스루)·TK 미발효.
- 검증: jest 5403/5403 · CI 8종 그린 · 로컬 웹 실기(카운트-목록 3=3 정합).

## 공고작성 지역 필수화 + 피커 공유 추출 (PR#257)
- 공고작성 폼에서 지역 제출을 zod `superRefine`으로 **필수화**(미입력 등록 차단) — [[order-sheet-form-contract]] 확장.
- 택소노미 UI를 `RegionTaxonomyBrowser.tsx`로 **공유 컴포넌트 추출** → 목록 필터 시트와 작성 폼이 같은 브라우저를 재사용.

## 🔑 근본수정 2건 (실측)
1. **URL 한도 → 그룹 접두 압축**: 그룹 전체 선택 시 `in()`에 160+ slug 나열 → PostgREST URL 한도 초과 `ERR_FAILED`(로컬 실측 119 OK / 163 fail). 해법=`REGION_GROUP_QUERY_PREFIXES`(`regions.ts:595`) 파생 + `or=(location->>region.like.접두*)` 접두 쿼리(`regionSelection.ts:158-169`). 파티션 안전성 테스트로 그룹 간 접두 겹침 없음 보장.
2. **RN-web ScrollView flexGrow:1**: 기본 flexGrow가 className 폭 지정을 flex-basis로만 취급해 남은 공간 50/50 분할(좌측 탭 542px 실측). `grow-0 shrink-0` 명시로 76px 고정.

## 필터 축 확장 레시피 (다음 축 추가 시 그대로 — 6지점)
필터 축 1개 추가 = ①`JobPostingFilters`+`jobFilterSchema` 동기 ②repository `apply*Scope` 공용 헬퍼(`JobPostingRepository.ts` — getList/getTypeCounts 동일 지점) ③`usePostingTypeCounts` options+캐시키(`usePostingTypeCounts.ts`) ④`jobFilterStore` persist+sanitize ⑤시트(visible 마운트 + keepPreviousCounts + **타 필터 축 포함 미리보기**) ⑥FilterBar pill. 이 6지점 전수 갱신이 [[whitelist-silent-drop]] 누락을 막는다. 읽기 조회는 Repository 직접 호출([[data-flow]] TanStack Query 예외)이라 Service 우회 아님.

## 🔑 세션 함정 (재발 주의)
- `npm run test:db`가 bare `supabase` 호출 → CLI 미설치 시 헬퍼만 로드되고 **침묵 실패**(파이프가 exit 가림). → **`npx supabase test db`로 직접 실행**해 "Result: PASS" 확인.
- **Windows curl 한글 = cp949** → PostgREST 500 오탐. 한글 REST 프로브는 **node fetch**로.
- **Metro + NativeWind 워처**: 워크트리에서 편집 시 dev 서버 exit 7 크래시 반복 — 재시작으로 해소.
- **로컬 qa-staff 시드**: terms/phone_verified/identity_verified/profile_completed false → 로그인해도 signup 강제. db reset 시 UPDATE 재실행 필요.

## 잔여 (사용자 게이트)
- **OTA 미출하** — #245/#252/#253과 일괄 권장(memory `feedback_ota_refetch_local_tree_before_update` 관례).
- **실기기 QA** — 필터 시트 3종(iOS 터치·다크모드) + 조합 필터 칩카운트-목록 일치 스모크.
- 후속 백로그(선택): `text_pattern_ops` 인덱스(접두 like 스케일) · 주소 기반 구 백필.

관련: [[whitelist-silent-drop]] · [[data-flow]] · [[order-sheet-form-contract]] · [[job-posting-kiosk-order-sheet]] · [[layers]] · [[target-market]]
