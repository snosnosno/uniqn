# 핸드오프 — 주간 배치 그리드 출하 게이트(QA→push/PR→OTA→플래그 ON) + 반복 저장 개선 착수 (다음 세션 메인 프롬프트)

> 작성 2026-07-04. 이 문서를 **메인 프롬프트**로 시작하라. 순서 준수: **① 수동 QA → ② push/PR → ③ 머지 후 OTA→플래그 ON → ④ 반복 저장 개선 슬라이스**. ①~③은 이 문서로 **사용자 지시 완료**(단, ③의 OTA 실행·플래그 ON "실행 직전"은 각각 재확인 1회).

## 0. 현재 상태 (팩트 — 전부 실측됨)

- 브랜치 **`feat/weekly-grid-p0-ux`** 로컬 커밋 **11개**(`67283b151`~`f7fc0cef4`), **미push**. master(`97a7bcaf6`) 기반.
- 내용: P0 4건(슬롯 삭제·콜드스타트 CTA·뱃지 범례·주차 표기) + P1 4건(운영처 자동 생성·staffPicker SSOT+W-1·단일 ScrollView+셀 압축·요일 반복 벌크) + P2 3건(부족→프리필 공고·발행 후 `router.back()` 복귀·익일 표기) + **/review 반영**(specialist 4종+적대, CRITICAL 0 — 새로고침 복원·벌크 Alert 확인+과거 제외·룰21/5/9/10 교정·테스트 갭 4건).
- 검증 완료: **전체 jest 383스위트/4821 통과·quality EXIT 0**. 전부 JS(신규 마이그 0).
- PROD 무영향: 플래그 `weekly_grid_enabled` OFF + **OTA 미배포**(prod 모바일 번들에 그리드 코드 없음 — 그래서 ③은 반드시 "머지→OTA→플래그 ON" 순서).
- 언트래킹 문서 3개: `docs/analysis/2026-07-03-weekly-grid-uxflow-dependency-analysis.md`(분석), `docs/planning/2026-07-02-weekly-grid-uxreview-redesign-handoff.md`, 본 문서. **PR 전에 분석 문서+본 문서를 docs 커밋으로 브랜치에 포함 권장.** 루트의 정체불명 파일 `아래`는 내용 확인 후 삭제 제안(쉘 리다이렉트 사고 추정).

## ① 수동 QA (첫 작업)

### 환경
- QA 워크트리 `C:\Users\user\Desktop\T-HOLDEM-weekly-grid`는 **구 브랜치(feat/venue-create-ui)** — `git checkout feat/weekly-grid-p0-ux` 필수(node_modules 정션 유지 확인, [[feedback_worktree_node_modules_junction]]).
- 로컬 Supabase(플래그 ON + 시드 운영처 "강남 홀덤펍" `8f832b30`) → `cd uniqn-mobile && npm run web` → Playwright 웹 구동. ⚠️공유 로컬 DB reset 드리프트 시 grid 마이그(20260629~20260703) 멱등 재적용.

### 웹(Playwright) 스모크 — 신규 표면 전수
1. **자동 운영처 생성**: 운영처 0개 워크스페이스로 진입 → 워크스페이스 이름으로 자동 생성+선택(생성 시트 안 뜸). 실패 폴백=수동 EmptyState.
2. **슬롯 삭제**: 슬롯 탭→편집 시트 "빼기"→overlay 확인("배치 빼기")→확정→리스트/셀 갱신. 지원확정분(공고 스팬)도 확정해제로 빠지는지.
3. **콜드스타트 CTA**: 빈 풀에서 "공고로 모집하기"/"전화번호로 찾기" 동작.
4. **범례·주차 표기**: `! 부족/+ 공고/✓ 배치` 범례, 액션바 "대상 주 · M/D(요일) ~ M/D(요일)".
5. **요일 반복**: 체크 on+저장→Alert "요일 전체 적용"(N일 수치)→적용 시 과거 날짜 제외 반영. 과거만 남으면 에러 토스트.
6. **부족→프리필 공고**: 목표>현재인 날 "부족 N명 공고로 모집"→공고 폼에 날짜·인원 N(딜러)·18:00 프리필 확인.
7. **발행→복귀 루프**: 6에서 발행→그리드 복귀(선택 운영처·날짜 보존)+해당 셀 `+N` 뱃지. **토스트 1회만**(중복 제거 회귀 확인).
8. **단일 스크롤**: 화면 세로 스크롤로 패널 끝까지, 목표 입력 키보드 정상.
9. **익일 표기**: 18:00~02:00 슬롯 카드 종료 컬럼 "익일 02:00".

### iOS 실기기 (BLOCKING — 플래그 ON 전제조건)
- **EditSlotSheet 시간 휠 피커 터치**(중첩 Modal 함정 H1/H2 재검증) + **삭제 확인 overlay 터치**(신규 — 같은 overlay 패턴).
- **당겨서 새로고침**(웹에선 제스처 확인 불가) + `router.back()` 복귀 1회(적대 I2, edit.tsx 동일 패턴이라 확인만).
- 기존 체크리스트: `uniqn-mobile/docs/planning/2026-06-30-weekly-grid-qa-handoff-prompt.md`(P0 이전 기준 — 위 신규 항목 병기).
- 결함 발견 시: 이 브랜치에 fix 커밋 추가 후 재검증(TDD, [[pitfall_jest_restoremocks_module_scope_spyon]] 주의).

## ② push / PR (사용자 지시 완료 — 실행하라)

1. 문서 커밋(`docs(grid): 분석+핸드오프`) → `git push -u origin feat/weekly-grid-p0-ux`.
2. PR 생성(base master): 커밋 11개 전체 이력 기반 요약(P0/P1/P2/리뷰 4단 구성), 테스트 계획(전체 jest 수치+수동 QA 결과), 분석 문서 링크. **master 직접 push 금지**([[feedback_master_direct_push_bypasses_e2e]]) — PR로 e2e 포함 CI 통과 확인. e2e 비결정 45분 timeout이면 재시도([[pitfall_e2e_runner_contention_timeout]]).
3. 머지는 CI 그린 + 사용자 확인 후 squash(관례).

## ③ 머지 후: OTA → 플래그 ON (순서 엄수)

1. **OTA 배포**: 그리드는 prod 번들에 없으므로 플래그보다 OTA가 먼저. ⚠️OTA는 master 전체 번들(휴면 중인 ops·리뷰허브 OTA대기분 등 동승) — **배포 범위 1줄 보고 후 실행 재확인 1회**. 절차는 [[pitfall_fixed_schedule_strict_parse_kills_backcompat]](android/ mv+NODE_ENV=production+--environment production)·`docs/planning/2026-06-30-weekly-grid-deploy-handoff.md` 참조. 웹은 `node scripts/deploy-cloudflare.js --force`.
2. **플래그 ON**: `app_config`의 `weekly_grid_enabled`를 `{"enabled": true}`로 UPDATE(정확 컬럼명은 마이그 `20260630000300` 실측, MCP `execute_sql`). 원격 플래그라 재배포 불필요. **실행 직전 재확인 1회** → ON 후 프로드 스모크(진입 버튼 노출·그리드 로드)·문제 시 즉시 OFF 롤백(주의: 롤백 시 잔존 배치알림 딥링크는 workspace로 바운스 — 알려진 경미 결합).

## ④ 반복 저장 개선 슬라이스 (게이트 완료 후 착수)

리뷰 세션에서 사용자 질문("사람 불러오기 쉽게·드래그·엑셀보다 편하게")에 대한 4안 중 **1안+2안 진행이 기본**(사용자가 세션에서 달리 말하면 따름):

1. **[추천·S~M] 다중 날짜 벌크 배치** — AddSlotSheet에서 사람 선택 후 "이번 달 같은 요일 전체 배치" 옵션. `add_direct_staff`의 `p_assignments`가 **이미 벌크 지원**(마이그 `20260629000000:179-213` 실측) → 서버 변경 0, 페이로드 조립+UI만. 요일 반복 목표인원과 동일한 보호(과거 제외+확인 다이얼로그) 적용.
2. **[S] 그날 단위 "지난주 이 요일 멤버 채우기"** — 날짜 패널 버튼, `copyLastWeek` 도메인(shiftDateByDays/buildCopyLastWeekPayload) 재사용.
3. [백로그·M] 페인트 모드(사람 선택→날짜 연속 탭 배치 — 모바일에서 드래그보다 정합). 4. [백로그·L] 스태프×요일 매트릭스 뷰(별도 설계).

착수 방식: HARD-GATE 준수 — 간단 스펙→계획 승인→TDD 구현(P0~P2와 동일 슬라이스 방식). 새 브랜치(머지 후 master 기반).

## 진실의 원천
- 메모리 `project_weekly_grid_design_20260628`(전체 이력·함정), `pitfall_jest_restoremocks_module_scope_spyon`.
- 분석: `docs/analysis/2026-07-03-weekly-grid-uxflow-dependency-analysis.md` / 계획: `~/.claude/plans/glowing-imagining-petal.md`.
- 리뷰 부록(조치 불요 기록): 대규모 배치 시 VenueDayDetail FlashList 재검토 트리거·익일 표기 실측/예정 혼합 엣지(I4)·로딩 스켈레톤(룰16).

## 제약
- 한글 응답·커밋. 커밋은 로컬 자율, **push/PR/OTA/플래그 ON은 위 지시 범위 내에서만**(그 외 확장은 사용자 확인).
- 중첩 RN Modal 금지(overlay 패턴)·NativeWind 정적 리터럴·`logger`·TDD·검증은 fresh 실행 증거.
