---
name: pattern-optional-field-wiring-six-points
description: optional 도메인 오브젝트 필드(conditions류) 리뷰는 6지점 사슬 전수 확인 — sheet 정규화→form zod→mapper 게이트→직렬화 폴백→읽기 하이드레이션→UI 렌더가드
metadata:
  type: project
---

optional 도메인 오브젝트 필드(예: `conditions: PostingConditions`)를 리뷰할 때는 6지점 사슬을 전수 확인해야 #194류 "쓰기만 되고 읽기 증발"과 명시-undefined 함정을 잡는다.

**Why:** 2026-07-14 kiosk 후속 PR(`460fcb083`) 리뷰에서 확립. ConditionsSheet norm이 `{dressCode: undefined, experience: undefined}`처럼 **양 키를 명시 undefined로 재작성**해도 안전한 이유가 사슬 전체에 분산돼 있었음 — 한 지점만 보면 오판.

**How to apply:** 아래 6지점을 각각 grep/Read로 실측:

1. 시트 confirm 정규화 (trim은 confirm 시점만 — onChangeText에서 trim하면 타이핑 UX 파괴)
2. form zod 스키마 (`orderSheet.schema.ts` — safeText+optional, `.default({})`)
3. values→draft mapper의 **per-field `!== undefined` 게이트** (`mappers.ts:114` — 명시-undefined 오브젝트를 "미설정"으로 흡수하는 지점)
4. 직렬화 폴백 (`serialization.ts:325` — `input ?? current` 보존, 키 자체 생략 패턴. supabase-js JSON 직렬화가 undefined 키를 드롭하는 것도 안전망)
5. 읽기 하이드레이션 (`serialization.ts:499` — 빠지면 read 증발)
6. UI 렌더가드 (`JobDetail.tsx:102` — `?.field?.trim()` + falsy 섹션 숨김, 공유링크/스태프 양 표면 공용 여부 grep `<JobDetail`)

부수 학습: 읽기 문서 스키마가 `.strict()`(postingConditionsSchema)면 미래에 미지 키 추가 시 #146류 read-null 위험 — 새 키 추가 PR에서 재확인. Jest `toHaveBeenCalledWith`+`objectContaining`은 명시-undefined 추가 키를 무시하므로 norm 도입이 기존 단언을 깨지 않음.
