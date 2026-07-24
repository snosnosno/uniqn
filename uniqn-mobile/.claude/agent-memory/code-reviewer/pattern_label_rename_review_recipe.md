---
name: pattern-label-rename-review-recipe
description: 표시 라벨 문자열 리네임(스키마 불변) 리뷰 시 tsc/jest가 못 잡는 3지점 — 수기 픽스처 드리프트·projected 오프라인캐시 스테일·조인 상한 실측
metadata:
  type: feedback
---

표시 라벨 리네임(저장 필드 유지) 리뷰는 grep+실측 3종이 필수 — 타입체크·테스트 green이 완전성을 보장하지 않는다.

**Why:** 2026-07-25 조건 시트 '경력'→'조건' 리네임(66ae6b183) 리뷰에서 실증. ① `PostingCardSurface.test.tsx`처럼 뷰모델을 **수기 리터럴로 주입**하는 픽스처는 구 라벨('경력 6개월 이상')로도 계속 green — 프로덕션 파생 함수(facts.ts) 출력과 드리프트해도 어떤 게이트도 안 울린다. ② `useJobPostings`류가 **projected 카드(라벨 문자열 포함)를 오프라인 캐시에 저장**하면 schemaVersion 미변경 시 OTA 후에도 구 라벨 잔존(코스메틱, 첫 온라인 fetch로 자가치유 — bump는 오프라인 가용성 희생이라 보통 비권장, 판단만 명시). ③ 프리셋 칩 확장 시 조인 길이 상한(zod safeText)은 **전량 선택 조인을 node로 실측**(String.length) — 암산 금지, 클램프 함수(customLimit류)가 토글 시점에도 적용되는지 함께 확인.

**How to apply:** 라벨/문구 리네임·프리셋 확장 diff를 받으면 ① 구 라벨 리터럴을 테스트 픽스처 포함 전체 grep(별개 도메인 동음어는 제외 판정) ② 해당 문자열이 오프라인 캐시/직렬화에 실리는지 추적(projections→setCriticalOfflineCache) ③ 조인·길이 계약이 있으면 최악 케이스 실측. testID에 라벨이 들어가면 e2e 디렉토리도 grep 범위에 포함. 관련: [[pattern-optional-field-wiring-six-points]]
