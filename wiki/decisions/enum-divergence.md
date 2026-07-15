---
area: decisions
updated: 2026-07-16
status: current
sources:
  - memory/pitfall_enum_divergence_read_disappearance.md
  - memory/pitfall_fixed_schedule_strict_parse_kills_backcompat.md
  - uniqn-mobile/src/schemas/jobPosting.schema.ts
  - PR#146
  - PR#155
  - PR#161
  - PR#162
tags: [decisions, enum, zod, read-disappearance, pitfall, posting-status]
---

# 결정: enum 발산 → 읽기 레코드 증발 방지

**맥락:** DB enum에 신규값이 생겼는데 앱 Zod 스키마가 미동기화 → `safeParse` 실패 → 레코드 전체가 목록에서 조용히 사라짐. PR#146/PR#155/PR#161/PR#162에서 3회 재발.

## 실패 메커니즘

주장 (memory/pitfall_enum_divergence_read_disappearance.md 기반):
```
DB: posting_status = 'capacity_full'  ← 신규값
앱: z.enum(['active', 'closed', ...]) ← 누락
→ safeParse() → fail
→ parseJobPostingDocument() → null
→ filter() 제거
→ 공고 목록/상세에서 공고 증발
```

재발 시점 각각: `payroll_status`('failed' 미수록, PR#146), `capacity_full` 도입(PR#155 P0), `getMyJobPostings` includeAll(PR#161), `getList` status=active(PR#162).

## 결정 (검증됨: PR#146·PR#155·PR#161·PR#162)

1. **읽기 Zod는 미지값 허용**: `.catch(undefined)` 또는 `.or(z.literal(...))` 패턴 적용. drop 대신 흡수.
2. **enum SSOT**: `Constants.public.Enums.*`(generated types)에서 `z.enum()` 파생, 인라인 하드코딩 금지. (`uniqn-mobile/src/schemas/jobPosting.schema.ts` 참조)
3. **status reader 전수 갱신 체크리스트**: posting_status 신규값 추가 시 read/filter Zod + status 필터 쿼리(includeAll/getList) 전부 점검.

## 역호환 흡수 패턴 (검증됨: PR#146)

strict Zod parse는 역호환 코드를 **dead code**로 만든다. 올바른 패턴:
```
normalizeLegacyInput(raw)   ← safeParse 이전에 흡수
  → safeParse()             ← 이제 통과
    → deserialize()         ← 역호환 fallback 도달 가능
```

## 영향 범위

주장 (memory 기반): `payroll_status`(앱 'processing' ↔ DB 'failed'). 현재 dead writer 0건이나 값 쓰면 즉시 발동.

검증됨 (`uniqn-mobile/src/schemas/jobPosting.schema.ts:25, 115, 504`, 2026-07-16 재확인): `posting_status`는 SSOT 패턴 유지 — `Constants.public.Enums.posting_status` 파생(`POSTING_STATUS_VALUES`, :25), `z.enum(POSTING_STATUS_VALUES)` 사용(jobFilterSchema :115, jobPostingDocumentSchema :504). 2026-07 필터 개편(#250/#251/#254: 지역 택소노미·`salary_*_max`·역할필터)은 **전부 additive** — enum 발산 규칙 불변(라인만 이동).

## 관련

- [[capacity-full]] — capacity_full enum 도입 시 이 규칙으로 reader 누락 조기 차단
- [[rls-model]] — RLS와 함께 발생한 공고 읽기 차단(anon 함수 권한) 별개 패턴
- [[revenue-model]] — wallet_ledger enum 6종 dead 상황(생산자 0건, 동일 리스크)
