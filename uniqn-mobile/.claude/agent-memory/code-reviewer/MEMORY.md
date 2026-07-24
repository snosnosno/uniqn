# code-reviewer 메모리

> 인덱스: 한 줄=한 메모리. 상세는 토픽 파일. 추천 전 실재 검증.

## knip / 데드코드 정리

- [knip 플랫폼 변형 default 드리프트](pitfall_knip_platform_variant_default_drift.md) — .web 짝의 default가 미탐 잔존, tsc는 base만 해석해 비대칭 못잡음. 배치 시 짝 grep 대조 필수

## 카운트 / 키 계약

- [역할키 2계보 — bare other 발산](pitfall_role_key_two_lineages_bare_other.md) — getPostingRoleKey='other' vs roleMatchKey/DB='other:'. hydrate 조회는 roleMatchKey 계보 필수

## 리뷰 절차

- [워크트리 리뷰 diff는 그 워크트리에서](pitfall_worktree_review_diff_wrong_checkout.md) — 메인 체크아웃 git diff=타 세션 워킹트리 비교→유령 대량삭제 오탐. git show(객체)는 안전, diff는 아님
- [동봉된 회귀 가드는 pre-fix 코드에 돌려 red 확인 전 신뢰 금지](pitfall_regression_guard_not_red_on_prefix.md) — 판정단위>결함단위(삼항 전체 includes)·jest 전역 useSafeAreaInsets=0 목 2종 실측
- [SDD 브리프 코드블록은 sed 추출 후 byte-diff](pattern_sdd_brief_verbatim_diff_check.md) — 눈 대조는 한 글자 바뀐 testID·클래스명 놓침. prettier 이탈 주장은 --stdin-filepath로 파일 안 고치고 검증
- [무수정 변이 프록시 = 단일파일 커버리지 브랜치](pattern_coverage_as_mutation_proxy_readonly.md) — Lines 100인데 Uncovered 번호 남으면 그 분기 지워도 green. RN `disabled`가 내부 `if(!x) return`을 선점해 미커버
- [⭐`queryByTestId(...).toBeNull()`은 "미마운트"가 아니라 "미노출" — display:none 위반본이 통과 +**변이본 트리모양이 탐지력을 좌우**](pitfall_rntl_display_none_defeats_not_mounted_assertion.md) — SlotCard Task5 실측: display:none=null(위장 성공)·className hidden=FOUND·opacity:0=FOUND → 탐지가 숨김 방식에 우연 좌우, 하필 아코디언에서 흔한 display:none만 뚫림. 마운트 계약은 **state 생존 단언**으로 검증. 🔑재리뷰 실측: 루트 타입이 분기마다 다르면(Pressable↔View) React가 알아서 언마운트→**2분기 변이본은 리마운트 테스트를 green으로 통과**시켜 "vacuous" 오판 유발. **단일트리+display 토글 변이본**으로 프로브해야 red(=Task7 애니 래핑의 현실적 위반형). includeHiddenElements 교정과 state 생존 단언은 **각각 다른 변이본을 잡아 중복 아님**. +삭제로 인한 인덱스 승계는 언마운트를 우회(실측 red)
- [⭐변이 green의 원인은 셋(테스트갭·도달불가 죽은분기·관측불가 계약) +**한 줄 안에서 도달성이 갈린다**](pitfall_mutation_green_misattribution.md) — ScheduleSlotsSheet Task6 2라운드 실측: 같은 삼항의 `cur>i`=도달불가(결함아님)인데 형제항 `Math.min` 클램프=**도달가능·무가드**(진짜 갭) → statement 아닌 **sub-expression 단위 변이**. 깊은복사=소비자 전원 불변이라 값 단언으로 원리적 미탐(코드유지+참조 `not.toBe`) · `updateStart` idx가드=슬롯1개에서만 테스트한 갭. 🔑브리프 계약은 **조항 단위로 쪼개 변이**(3조항 중 2개만 가드) · 🔑1차 변이에 안 죽은 테스트는 **2차 표적 변이로 무죄 증명**(안 하면 vacuous 오신고)
- [파일수정 금지 리뷰에서 변이 돌리는 법 = gitignored `dist-e2e/`](pattern_readonly_mutation_sandbox_dist_e2e.md) — 스크래치패드는 @babel/runtime 미해석·mklink /J 실패. dist-e2e는 rootDir 안+testPathIgnorePatterns `/dist/`가 안 잡음. 끝나면 rm -rf + git status 확인
- [⭐"스코핑이 단언을 강화한다"는 논증=독립 2주장으로 쪼개 **소스×단언 2×2 교차 변이** +죽은 가드는 발화조건 생성자 호출처 전수](pattern_scoping_strengthens_assertion_claim_audit.md) — Task8 실증: 베이스라인 중복매치(참) / 변이시 vacuous(**거짓** — 전역 단언도 red). 조치는 옳고 논증만 틀림 → 코드 승인+보고서 정정. 거짓 명제가 "이 단언은 X 때문에 강하다"로 상속되면 X 소멸해도 아무도 재검증 안 함. 가드 삭제 안전성=`git show <base>:<f> | grep 호출처`로 도달불가 증명(호출처 미확인 격상은 오탐)
- [⭐"이 테스트가 X를 지킨다"는 주장은 X를 변이해 확인 + green이면 **base 재생**으로 귀속](pattern_mutation_audit_base_replay.md) — Task4 실증: 브리프가 "고정 역할 반영 수호"라 한 테스트가 `roles: next` 떼도 green(토스트가 폼 경유 없이 `next` 직행 수신), dated 경로는 같은 변이가 red = 경로별 비대칭. base 커밋 재생도 green→선재 갭 확정(재생 없었으면 Important 오탐). ⚠️`git checkout <commit> -- <p>`는 **인덱스까지** 오염→`git checkout HEAD -- <p>` + `git diff HEAD --stat` 0줄 확인
- [순환 순회 함수 — 반복 key의 groupIndex identity 매칭은 groupIndex=0 대표 케이스만으론 미검증](pitfall_cyclic_traversal_repeated_key_groupindex_untested.md) — orderRowMeta `nextUnsetRowAfter` 실측: `t.groupIndex===current.groupIndex` 제거해도 11/11 green(같은 key의 groupIndex0 occurrence가 항상 먼저 나와 findIndex 오귀속). 프로브로 실제 오동작(current 자기 자신을 "다음"으로 반환) 재현 — 코드는 정확·테스트만 미검증(Important, 비블로킹). 부수: optional 하드코딩 unset:false로 `!state.optional` 가드 도달불가(분류1 사례, 회귀 아님)
- [⭐연쇄 딤(scrim) 리셋이 onEntered 통지 1종에만 의존→DatePickerModal 미소비 경로서 영구잔존, 4단 변이 중 2건 무가드+실물재현으로 CRITICAL 확정](pattern_chain_scrim_datepickermodal_leak_repro.md) — Task3(`e06b86fbd`) 실증: `nextUnsetRowAfter`가 전체 폼 순회라 dates 타깃 항상 도달가능. `secondGroupDatesMissing()`로 재현→취소 후에도 딤 고착. "무가드"만으론 실전영향 안 보임, fixture로 베이스코드 직접 재현이 심각도 판정을 갈랐다

## 공용 컴포넌트 추출

- [추출 컴포넌트 testID 네임스페이스 충돌](pitfall_extracted_component_testid_namespace_collision.md) — 추출 태스크는 green, 채택 태스크에서 getByTestId 다중매치. 신규 testID 전 레포 grep 필수

## RN 레이아웃

- [flex:1 → maxHeight/flexShrink 전환 리뷰 레시피](pattern_rn_flex_to_flexshrink_review.md) — flexShrink 기본0→KAV로 부모 줄면 헤더가 위로 오버플로. insets 패딩은 배경 가진 View에
- [인라인폼→absolute FAB 전환=리스트 하단 패딩이 FAB 풋프린트 이상인지 대조](pattern_absolute_fab_flashlist_last_row_occlusion.md) — FAB 풋프린트=height+bottom+insets. 미만이면 최하단 행 가림, right:16이면 우측 QR/체브론 탭불가 MEDIUM. SafeAreaView edges top-only면 FAB +insets 이중적용 아님. 실증=L7 `2e515864e`

## 필드 배선 리뷰 레시피

- [optional 오브젝트 필드 6+3지점 사슬](pattern_optional_field_wiring_six_points.md) — 쓰기6(시트→zod→mapper→직렬화→하이드→UI가드)+카드3(projections 전사·spread 재구성·오프라인캐시 버전)
- [스토어 계약 필드 렌더러 미배선](pitfall_store_contract_field_without_renderer.md) — toast.action 타입만 있고 Toast.tsx 미소비=Undo 죽은기능. 스토어 mock 테스트는 false-green, 소비처 grep 필수
