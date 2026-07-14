# code-reviewer 메모리

> 인덱스: 한 줄=한 메모리. 상세는 토픽 파일. 추천 전 실재 검증.

## knip / 데드코드 정리

- [knip 플랫폼 변형 default 드리프트](pitfall_knip_platform_variant_default_drift.md) — .web 짝의 default가 미탐 잔존, tsc는 base만 해석해 비대칭 못잡음. 배치 시 짝 grep 대조 필수

## 카운트 / 키 계약

- [역할키 2계보 — bare other 발산](pitfall_role_key_two_lineages_bare_other.md) — getPostingRoleKey='other' vs roleMatchKey/DB='other:'. hydrate 조회는 roleMatchKey 계보 필수

## 필드 배선 리뷰 레시피

- [optional 오브젝트 필드 6+3지점 사슬](pattern_optional_field_wiring_six_points.md) — 쓰기6(시트→zod→mapper→직렬화→하이드→UI가드)+카드3(projections 전사·spread 재구성·오프라인캐시 버전)
