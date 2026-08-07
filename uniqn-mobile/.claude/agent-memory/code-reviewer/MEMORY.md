# code-reviewer 메모리

> 인덱스: 한 줄=한 메모리. 상세는 토픽 파일. 추천 전 실재 검증.

## knip / 데드코드 정리

- [knip 플랫폼 변형 default 드리프트](pitfall_knip_platform_variant_default_drift.md) — .web 짝의 default가 미탐 잔존, tsc는 base만 해석해 비대칭 못잡음. 배치 시 짝 grep 대조 필수

## 카운트 / 키 계약

- [역할키 2계보 — bare other 발산](pitfall_role_key_two_lineages_bare_other.md) — getPostingRoleKey='other' vs roleMatchKey/DB='other:'. hydrate 조회는 roleMatchKey 계보 필수

## 리뷰 절차

- [⭐머지 후 잔존결함 2대 — 정규화 예외 생산자 grep 은 `app/` 라우트까지(마지막공고 프리셋이 grouped 잔존) + "후보<2 숨김"×"최소1 필수" 합성=후보 0 에서 확인 영구잠금](pattern_empty_group_producer_sweep_and_zero_candidate_deadend.md) — PR#425 머지본. 575 green·다크래칫 green 에서 검출, 프로브 red 실증
- [⭐앵커 재해석 게이트 소급=축 없는 모드(fixed groups=[]) 전면 null→연쇄 사망+딤 잔존 · 정규화 '원형 보존' 예외로 좀비 부활(templateToValues grouped 잔존)](pattern_condition_grouping_gate_retrofit_and_zombie_reentry.md) — grouping 최종 리뷰 HIGH 프로브 red 실증. 침묵 종료는 딤 해제 책임 동반·멱등성/off-by-one/시그니처 정합은 검증 완료
- [⭐diff 진단 고지 함수=사용자 행동 오포획 프로브(카운트 감소 조건은 해제 조작과 겹침)+관측이 고지 분기에 묶이면 계기판 오염·scratchpad jest 프로브 레시피](pattern_diff_diagnosis_notice_user_action_misfire.md) — grouping 브랜치 HIGH 실증. 음성 단언(특정 문구 not-called)은 다른 오발화 통과
- [설계 대조 3축 — 다이어그램 라벨 형식↔요약함수 실출력·사용자 최종게이트 결정 변형=재가 필요·F-minor 나열 체크리스트](pattern_design_contract_review_grouping_branch.md) — green 브랜치에서 3건 검출. 정당 이탈 선례 4종 수록

- [⭐full-scope 시트 시드 합집합·상한 합성 무검증](pattern_full_scope_sheet_seed_union_and_cap_composition.md) — 캘린더 스텁 통째 덮어쓰기=시드 죽은 입력(prop 캡처 프로브만 유효)·cap 유닛 합성 지점·toMatchObject 완화 3조건·opt-in prop 부재 단언=묘비

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
