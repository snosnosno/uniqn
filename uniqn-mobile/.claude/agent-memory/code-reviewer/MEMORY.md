# code-reviewer 메모리

> 인덱스: 한 줄=한 메모리. 상세는 토픽 파일. 추천 전 실재 검증.

## knip / 데드코드 정리

- [knip 플랫폼 변형 default 드리프트](pitfall_knip_platform_variant_default_drift.md) — .web 짝의 default가 미탐 잔존, tsc는 base만 해석해 비대칭 못잡음. 배치 시 짝 grep 대조 필수

## 카운트 / 키 계약

- [역할키 2계보 — bare other 발산](pitfall_role_key_two_lineages_bare_other.md) — getPostingRoleKey='other' vs roleMatchKey/DB='other:'. hydrate 조회는 roleMatchKey 계보 필수

## 리뷰 절차

- [워크트리 리뷰 diff는 그 워크트리에서](pitfall_worktree_review_diff_wrong_checkout.md) — 메인 체크아웃 git diff=타 세션 워킹트리 비교→유령 대량삭제 오탐. git show(객체)는 안전, diff는 아님
- [동봉된 회귀 가드는 pre-fix 코드에 돌려 red 확인 전 신뢰 금지](pitfall_regression_guard_not_red_on_prefix.md) — 판정단위>결함단위(삼항 전체 includes)·jest 전역 useSafeAreaInsets=0 목 2종 실측

## RN 레이아웃

- [flex:1 → maxHeight/flexShrink 전환 리뷰 레시피](pattern_rn_flex_to_flexshrink_review.md) — flexShrink 기본0→KAV로 부모 줄면 헤더가 위로 오버플로. insets 패딩은 배경 가진 View에

## 에러 계약 / 플로우 리뷰 레시피

- [위저드 에러코드 복귀 리뷰 4지점](pattern_wizard_error_rollback_review.md) — metadata.code 사슬 끝까지(래퍼 pass-through 확인)·rethrow 매트릭스 전수·모드 비대칭·savedAt 단측 증명+런타임 안전망

## 필드 배선 리뷰 레시피

- [라벨 리네임 리뷰 3지점](pattern_label_rename_review_recipe.md) — 수기 픽스처 드리프트(green 유지)·projected 오프라인캐시 스테일·조인 상한 node 실측. testID 라벨이면 e2e도 grep

- [optional 오브젝트 필드 6+3지점 사슬](pattern_optional_field_wiring_six_points.md) — 쓰기6(시트→zod→mapper→직렬화→하이드→UI가드)+카드3(projections 전사·spread 재구성·오프라인캐시 버전)
- [스토어 계약 필드 렌더러 미배선](pitfall_store_contract_field_without_renderer.md) — toast.action 타입만 있고 Toast.tsx 미소비=Undo 죽은기능. 스토어 mock 테스트는 false-green, 소비처 grep 필수
