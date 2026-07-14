---
area: decisions
updated: 2026-07-14
status: current
sources:
  - uniqn-mobile/src/repositories/supabase/JobPostingRepositoryHelpers.ts
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - uniqn-mobile/src/utils/job-posting/draftAdapter.ts
  - docs/superpowers/plans/2026-07-14-job-posting-kiosk-order-sheet.md
  - uniqn-mobile/src/components/jobs/JobDetail.tsx
  - PR#194
  - PR#243
  - PR#247
tags: [serialization, whitelist, regression-class, mapper]
---

# 결정: "화이트리스트 조용한 증발" 재발 클래스 — 신규 필드는 전 매핑 지점 전수 + 읽기 방향 테스트

## 클래스 정의
이 코드베이스의 직렬화·매핑 계층은 **명시 화이트리스트** 방식이다(스프레드 통과가 아니라 필드를 하나하나 옮김). 신규 필드/키를 어느 한 지점에서 빠뜨리면 **에러 없이 조용히 증발**한다 — 쓰기는 성공하는데 읽기·수정·표시에서 사라지는, 가장 발견이 늦는 결함 클래스다.

## 실증 3회 (같은 클래스, 다른 지점)
1. **#194 region 유실**: 신규 location 필드를 draftAdapter 4매퍼 중 일부만 갱신 → 지역 필터 값이 왕복에서 소실.
2. **#243 filled counts 0/N**: `usePostingFilledCounts` 전역맵(키 `postingId__...`)을 `extractPostingFilledSubmap` 없이 hydrate(접두 없는 키)로 넘김 — 필드가 아니라 **키스페이스** 불일치 변형([[ios-userflow-fixes]]).
3. **키오스크 conditions (2026-07-14 계획 리뷰가 사전 적발)**: 신규 컬럼의 왕복 지점이 4개가 아니라 **9개**였다 — 쓰기 4(draft타입·draftToCreateJobPostingInput·jobPostingToDraft·serializeJobPostingV3) + 템플릿 2 + **읽기**(`TABLE_COLUMNS` SELECT 화이트리스트 `JobPostingRepositoryHelpers.ts:17`·`toJobPosting`의 미등록 키 드롭·`deserializeJobPostingDocument` 조립부) + **수정**(`toCreateJobPostingInput` merge base·`draftToUpdateJobPostingInput`). 4지점만 하면 "쓰기만 되고 아무도 못 읽는 필드"가 된다.

## 규칙 (신규 필드/키 추가 시)
1. **지점 전수 조사**: 타입 → 쓰기 매퍼 → 직렬화 → **SELECT 컬럼 목록** → 역직렬화/hydrate → 수정(merge/patch) → 템플릿. `grep -n "<인접 기존 필드명>"`으로 화이트리스트 지점을 전부 나열한 뒤 하나씩 반영.
2. **왕복 테스트는 읽기 방향 포함**: draft→document 쓰기 단언만으로는 이 클래스를 못 잡는다. document→deserialize→entity→(merge base) 방향 단언 + SELECT 목록 등록 가드(`TABLE_COLUMNS.split(',')` contains)까지.
3. **배선 통합 가드**: 서브맵/추출 함수가 낀 소비자는 "추출 호출을 제거하면 실패하는" Red-Green 테스트로 배선 자체를 고정(단위 테스트는 배선 결함을 못 잡음).
4. 계획/리뷰 단계에서 이 클래스를 의심하는 질문: "이 필드를 **읽는** 경로는 어디를 지나는가?" — 쓰기 경로만 나열된 계획은 미완성.
5. **읽기 배선 ≠ 표시 UI**(2026-07-14 실증): conditions는 9지점 왕복(읽기 hydration 포함)이 PR#246에서 완료됐지만, 지원자가 보는 **표시 UI**(`JobDetail.tsx` '모집 조건' 섹션)는 별개 갭으로 남아 PR#247이 완결했다. entity에 필드가 있는 것과 화면에 렌더되는 것은 다른 질문 — 왕복 전수 조사에 "이 필드가 **화면에** 뜨는 경로"를 별도 항목으로 포함하라.

관련: [[ios-userflow-fixes]] · [[enum-divergence]](읽기 레코드 증발의 zod 변형) · [[layers]] · [[parity-baseline-squash]] · [[job-posting-kiosk-order-sheet]]
