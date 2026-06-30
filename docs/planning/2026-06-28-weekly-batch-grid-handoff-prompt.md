# 핸드오프 프롬프트 — 주간 배치 그리드 끝까지 구현 (다음 세션용)

> ⚠️ **DEPRECATED(원본·착수용).** Phase 1 완료 + Phase 2 일부 진행됨. 최신 핸드오프는
> **`2026-06-28-weekly-grid-handoff-v2-orchestrated.md`**(오케스트레이션 최적화판)이다.
> 다음 세션은 v2 를 메인 프롬프트로 사용할 것. 본 파일은 최초 착수 기록으로만 보존.

> 아래 코드블록 전체를 다음 세션 첫 메시지로 붙여넣으면 된다. `ultracode` 키워드가 포함돼 있어 워크플로 오케스트레이션이 활성화된다.

---

```
ultracode

# 임무: 주간 배치 그리드(홀덤펍 운영 그리드) 끝까지 구현 — 새 워크트리에서 핸드오프 자율 진행

너는 UNIQN(Expo·RN·TS strict·Supabase·NativeWind, layered: Presentation→Hooks→Service→Repository→Supabase)의 시니어 개발자다. 응답·커밋·주석·문서 전부 한글. 작업 디렉토리는 워크트리의 uniqn-mobile/.

## 0. 시작 전 필수 읽기 (Source of Truth)
1. 설계 확정본: `docs/planning/2026-06-28-weekly-batch-grid-design.md` (설계 v2) — 전체 정독. 이게 진실의 원천이다.
2. 프로젝트 메모리: `project_weekly_grid_design_20260628` (+ MEMORY.md 인덱스의 관련 함정들)
3. 본 문서의 "절대 규칙/불변식/검증 게이트"를 설계 v2와 충돌 없이 따른다. 충돌 시 설계 v2 우선, 그 위에 CLAUDE.md/rules 우선.

## 1. 확정 결정 (이미 합의됨 — 재논의 금지)
- 전체 6 Phase 진행(MVP 컷 없음) / QR 트리밍 포함 / 컨테이너 카운터 = read-time COUNT(추천안)
- 구조: "운영처(venue) = 숨김 컨테이너 공고(status='container')" — work_logs.job_posting_id NOT NULL이 강제하는 최선. 재설계 금지.

## 2. 자율성 & 승인 정책 (핸드오프 모드)
- **끝까지 자율 진행**. Phase마다 "사람 승인 대기"하지 말고 **추천안(recommended)으로 자동 결정**하고 계속 진행한다.
- 각 Phase 완료 시 **간단 보고(완료 항목 + 검증 증거)** 를 남기고 다음 Phase로 이어간다(멈추지 않음).
- 단, 아래 **하드 게이트는 반드시 멈추고 사용자 승인**을 받는다(되돌리기 어려움/외부 영향):
  · `git push` / PR 생성 / master 머지
  · **PROD Supabase 마이그레이션 적용**(MCP apply_migration to prod)
  · 의존 브랜치 `origin/claude/staff-management-add-feature-g8wvsz`의 **master 머지**
  → 이 게이트 전까지는 전부 로컬(워크트리 커밋 + 로컬 Supabase dev 스택)에서 끝낸다. 게이트에 도달하면 무엇을·왜 승인받아야 하는지 1단락으로 정리해 묻는다.
- 그 외 구현상 선택(라이브러리·네이밍·테스트 범위 등)은 추천안 자동 채택, 사후 보고.

## 3. 워크트리 격리 셋업 (먼저 git status 확인)
1. `git status` — 내가 안 만든 미커밋 변경이 있으면 그 위에서 작업 금지. 새 워크트리로 격리.
2. 워크트리 생성(예): `git worktree add ../T-HOLDEM-weekly-grid -b feat/weekly-batch-grid master`
3. **의존 토대 통합**: 직접배치 토대(add_direct_staff/remove_direct_staff/search_users_by_phone, confirmedStaffService, useConfirmedStaff, AddStaffModal)는 `origin/claude/staff-management-add-feature-g8wvsz`(마이그 20260629000000)에 있고 master 미머지. → 이 브랜치를 워크트리 브랜치에 **로컬 머지**해 토대를 확보한 뒤 그 위에 그리드를 구현한다. (master로의 최종 머지는 하드 게이트 §2)
4. node_modules 5분 절약: 워크트리 루트에서 `cmd /c mklink /J "uniqn-mobile\node_modules" "C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules"` (junction).
5. 로컬 Supabase dev 스택(`project_local_supabase_dev_stage`): `.env.development.local` 준비 + `npm run db:start/reset`로 마이그를 **로컬에 먼저** 적용·검증.

## 4. 오케스트레이션 — ultracode/스킬/도구 최적 사용
- ultracode 켜짐: 실질 작업마다 워크플로를 작성·실행한다. 특히:
  · **fail-closed 누수 감사**(§5): 여러 읽기경로(jp_select/검색/getList/owner 경로/통계/크론/트리거)를 멀티-모달 스윕으로 동시 점검 → 깨지는 테스트 먼저.
  · **Phase별 구현→검증 파이프라인**: 구현 직후 적대 검증(마이그/RLS/RPC를 별 에이전트가 refute) → 통과분만 커밋.
  · 마이그/RLS/RPC는 **적대 리뷰**(3표 다수결)로 굳힌다.
- 스킬 적극 사용(가능한 것 전부 최적):
  · 구현 단위마다 `superpowers:test-driven-development`(Red→Green→Improve)
  · DB/RLS/권한 변경 전 `/guard`, 변경 후 보안은 `/cso` 필요 시
  · 코드 작성 직후 `/review`(또는 code-reviewer) + `/type-check` + `/health`
  · 디버깅은 `/investigate`(근본원인), 커밋은 `/commit`(한글 컨벤션)
  · 완료 주장 전 `superpowers:verification-before-completion`
  · 막판 통합 검토 `/plan-eng-review` 재실행(선택)
- Subagent dispatch 가드(`feedback_subagent_dispatch_guards`): 서브에이전트에 mcp__supabase__* 직접호출/기존 마이그 수정/PROD 우회 **금지** 명시.

## 5. 절대 불변식 (설계 v2에서 회귀하면 안 되는 것)
- **E1 venue 집계축**: count·부족신호·정산은 컨테이너 단독이 아니라 venue 스팬으로 — `job_posting_id IN (SELECT id FROM job_postings WHERE venue_id=:V OR id=:V)`. (단일 컨테이너만 보면 "공고 열기" 유입 인원 silent 누락)
- **E4 enum 2단 마이그**: `ALTER TYPE ... ADD VALUE 'container'`는 단독 마이그, 사용은 다음 마이그(같은 트랜잭션 사용 불가).
- **fail-closed 중앙화(§5)**: repo 베이스쿼리 1곳 `status != 'container'` deny + owner 경로(getByOwnerId/getManagedJobPostings) deny + 모든 SUM/통계 reader deny. **Zod SSOT `POSTING_STATUS_VALUES`에 'container' 추가**(누락 시 read null 증발).
- **카운터(§6)**: 컨테이너는 filled_positions 미사용. `add_direct_staff`·`remove_direct_staff`에 `IF status='container' THEN` 분기로 filled/capacity_full 미러 skip(대칭). 하루 인원=read COUNT, 부족=softTargets[D]−COUNT(음수 0 clamp).
- **soft-target(§4.4)**: 컨테이너 `schedule.softTargets`에 저장, `requirements[].count`와 분리(MAX_CAPACITY 하드가드 회피). 날짜 키 포맷 SSOT(YYYY-MM-DD).
- **QR(§7)**: live 함수(`pg_get_functiondef`) 기준으로 작업(20260414 파일은 구버전). `'auto'` 분기 + status `NOT IN ('active','container')`, **is_active 계정 가드 유지**(status만 완화). clocked_out_raw 원본 보존(덮어쓰기 금지). 기존 회전 event QR은 유지(컨테이너용 고정 QR은 신규).
- **정산(§8)**: venue 스팬 + 날짜범위를 **SQL 레벨**로 스코핑. 기존 per-공고 정산은 옵션 파라미터로 하위호환.
- **보안**: 운영처명/메모/color는 사용자 입력 → `z.string().refine(xssValidation)`, color는 토큰 팔레트 화이트리스트. 신규 RPC는 `REVOKE EXECUTE FROM anon` + `has_function_privilege` 실측. SECDEF는 `SET search_path=public,extensions,pg_temp`.
- **무회귀**: 전부 `weeklyGrid` 플래그(권장 app_config 원격) 뒤. 플래그 OFF면 사용자 경험 동일. DB/RPC 변경은 하위호환으로 짜고 회귀 테스트로 고정.

## 6. Phase 실행 순서 (각 Phase: 구현→검증→커밋→1단락 보고→다음)
- **Phase 1(BLOCKING 집결)**: 마이그 2단(enum→컬럼/인덱스/유니크) + Zod SSOT + getOrCreateVenueContainer(ON CONFLICT 멱등, E2/E3) + fail-closed 중앙화(§5) + **누수 감사 테스트 먼저(Red→Green, pgTAP+jest)** + 날짜 포맷 SSOT + 슬롯 상태머신(순수함수)+단위테스트.
- **Phase 2**: useGridSummary/useVenueDaySlots(venue 스팬, 월 1쿼리) + CalendarCell 다중뱃지 prop(U1 a11y 숫자+아이콘, U2 우선순위) + 운영처 선택기 + 날짜상세 ConfirmedStaffList(읽기).
- **Phase 3**: 추가 시트(풀/전화검색 AddStaffModal/공고열기 templateToDraft) + add/remove 컨테이너 분기 + 시간·역할·색상(U3 팔레트)·메모(XSS) 편집 + 시작시간 자동정렬 + 중복충돌 경고 + soft-target 입력+부족 신호.
- **Phase 4**: QR 트리밍(§7 live 함수 기준) + 정산 venue 스팬+날짜범위(§8).
- **Phase 5**: 지난주 복사(venue 스팬, no_show/cancelled 제외 → add_direct_staff 벌크 멱등) + "배치 확인" FCM 알림.
- **Phase 6**: 내 공고 토글(컨테이너 deny 확인) + 공고작성 풀폼→템플릿/상세편집 강등 + venue_id draft 경로 추가(draftAdapter 5매퍼 전수갱신, region 유실 함정) + 고정공고 lifecycle 무회귀.

## 7. 검증 게이트 (증거 기반 완료 — 추측 금지)
- 각 Phase 종료 전: 해당 테스트 실행해 **0 실패 증거** 제시(개수 포함). 회귀 테스트는 Red→Green(수정 되돌려 FAIL 확인) 1회.
- 마이그/RPC는 **로컬 Supabase에 적용 후** `SELECT * FROM rpc() LIMIT 0` 류로 schema-mismatch 실측(staging dry-run DDL만으론 부족).
- 전체 종료 전: `npm run quality`(type-check+lint+format) 통과 + 관련 jest/pgTAP 통과를 **실행 출력으로** 증명. "should work" 금지.
- Supabase advisor(get_advisors)로 신규 RPC/RLS 경고 0(특히 anon-executable SECDEF는 monitor/player류 화이트리스트 외 금지).

## 8. 프로젝트 규칙 (CLAUDE.md/rules 준수)
- 커밋: `<type>(<scope>): <한글>` (feat/fix/refactor/test/chore...). 로컬 커밋은 사전승인(push/PR만 게이트).
- 마이그=MCP `apply_migration` 전용(로컬은 db:reset). **기존 마이그 수정 금지**(새 타임스탬프). db push 금지.
- 로깅 logger.*(앱), 다크모드 dark: 항상, 경로 @/ 절대, 필드 camelCase, 불변(스프레드), 입력 zod 검증, 다중문서 runTransaction, 에러 AppError(E1~E7).
- 리스트 대형 FlashList/소형 FlatList, 이미지 expo-image.

## 9. 최종 핸드오프 보고 (전부 끝나면)
- Phase별 완료/증거 표 + 변경 파일 요약 + 검증 결과(테스트 통과 수·quality·advisor) + 남은 하드 게이트(push/PR/master 머지/PROD 마이그)와 승인 요청 + 리스크/미결 항목.
- 메모리 `project_weekly_grid_design_20260628` 갱신(구현 완료 상태로) + 필요 시 wiki /ingest 후보 표시.

지금 §0(설계 v2 정독)부터 시작해라.
```

---

## 사용 메모
- 위 프롬프트는 **로컬 끝까지** 자율 구현용. push/PR/master 머지/PROD 마이그는 의도적으로 사람 승인 게이트로 남겨 뒀다(되돌리기 어려움·외부 영향).
- 의존 토대 브랜치 `origin/claude/staff-management-add-feature-g8wvsz`의 master 머지는 이 작업의 선행 조건이자 하드 게이트다. 미리 머지해 두면 워크트리를 master에서 바로 분기할 수 있다.
- 추천안 자동 진행이라 빠르지만, 각 Phase 보고에서 방향이 어긋나면 그때 끼어들어 교정하면 된다.
