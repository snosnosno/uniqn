# 핸드오프 — 키오스크 주문서 출하 게이트 + 후속 PR (다음 세션 메인 프롬프트)

> 아래 블록을 다음 세션 첫 메시지로 그대로 사용.

---

공고작성 키오스크 "주문서" — **코드는 완료·리뷰 승인 상태다. 남은 출하 게이트와 후속 PR을 순서대로 끝까지 진행**해줘. push/PR/prod 마이그레이션/OTA는 이 프롬프트가 명시 요청이다.

## 현재 상태 (전부 검증 완료 — 재구현·재설계 금지)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\job-posting-kiosk-ux` (브랜치 `worktree-job-posting-kiosk-ux`, HEAD `20622fab5`, **미push**). node_modules는 메인 junction — 시작 시 `.bin` 개수·jest/expo 존재 프리플라이트.
- SDD 11태스크 전부 fable 리뷰 Approved + **최종 브랜치 리뷰(fable) Ready to merge, 필수 수정 0건**(merge-base `a66ddcc2a`, 30커밋/76파일/+8,596). 게이트 실측: quality exit 0 · jest 439스위트/5266 PASS · e2e 변경 2스펙 23 pass.
- 상세 이력: `docs/planning/2026-07-14-job-posting-kiosk-sdd-execution-handoff.md` 상단 배너 · SDD 원장 `<워크트리>/.superpowers/sdd/progress.md`(**git 미추적 — git clean 금지**) · 메모리 `project_job_posting_kiosk_order_sheet.md`.

## 실행 순서 (엄수 — 어기면 장애)

### ① conditions 마이그레이션 prod 적용 [최우선 — OTA 선행 필수]
- 파일: `uniqn-mobile/supabase/migrations/20260714000000_job_postings_conditions.sql` (jsonb nullable·IF NOT EXISTS — 멱등).
- `mcp__supabase__apply_migration`으로 prod 적용(프로젝트 `ygfxukhktpqymahfrvbz`). 적용 전 `mcp__supabase__list_migrations`로 `20260714*` 타임스탬프 충돌 확인(충돌 시 리네임 후 같은 PR에서 레포 파일도 동시 갱신 — [[pitfall_prod_repo_schema_drift_massive]]).
- 파리티 가드는 함수163·정책104만 카운트 — 컬럼 추가 무해(실측 확정). 적용 후 `SELECT column_name FROM information_schema.columns WHERE table_name='job_postings' AND column_name='conditions'` 실측.
- **이 단계 없이 OTA가 나가면 TABLE_COLUMNS의 conditions SELECT로 공고 읽기 전건 실패.**

### ② 본 PR (push + PR + 머지)
1. `git fetch origin` → **최신 origin/master를 브랜치에 merge**(squash 저장소라 rebase 금지) → 충돌 해소 시 `npm run quality` + `npx jest` 재검증(전건 green 필수).
2. `CHANGELOG.md` Unreleased > Added에 주문서 개편 항목 추가(프로젝트 관례 — PR # 포함해 커밋).
3. push + PR 생성(/pr 스킬). 함정: pre-push 훅 hang 시 `gh api` 우회 이력 있음(메모리 브랜치 위생 항목). PR 본문에 Design B 승인 일탈·배포 순서 게이트 명시.
4. CI green 확인 후 squash 머지. 원격 브랜치 삭제 전 아카이브 태그 불필요(PR 있음).

### ③ 후속 PR (OTA 전 필수 권고 — 최종 리뷰 Important 해소)
본 PR 머지 후 **새 브랜치**에서 번들 1개 PR:
- **conditions 지원자 표시**(핵심 — 계획 갭): 공고 상세(스태프 탭·공유 링크 표면)에 복장/경력 렌더. 읽기 배선(deserialize→entity)은 이미 완료 — UI만. 다크모드·기존 상세 섹션 패턴 준수.
- 폴리시 소건 5: ⚡이모지 카드 title→Lucide Zap(size 14, PresetCarousel) · create-success strokeWidth 2.5→2.0 · ConditionsSheet 커스텀 입력 trim · TimeSlotsSheet "시간대 추가" roles 깊은복사 · TemplateModal onSave try/catch.
- 코드 후 code-reviewer(fable) 리뷰 → 머지.
- (여유 시 백로그: serialize current-폴백 보존 테스트·title cap `'a'.repeat(25)` 강화·fixed 시드 shape 유닛 회귀 — `/tmp/session-wrap/session-wrap-followups.md` 참조)

### ④ OTA (본+후속 PR 머지 후 1회)
- [[feedback_ota_refetch_local_tree_before_update]] 규율: **직전 `git fetch` + 로컬 master ff-merge → Commit 필드=origin HEAD 확인** 후 `eas update`(production, ios+android). eas.json env 무시 함정([[pitfall_eas_update_shell_env_not_loaded]]).

### ⑤ 실기기 QA 안내 (사용자 수행 — 코드 완료 보고와 함께 체크리스트 제시)
- 주문서 진입~등록 풀 플로우(지원/급구) · PlaceSheet 인라인 지역 3단 터치 · TimeWheelPicker embedded · TimeSlots↔Roles #244 지연 전환 체감 · DatePickerModal · 하단 고정 바 홈 인디케이터 간섭 · 완료 화면 공유(OS 시트).

## 규율

- 커밋 사전승인(한글 `<type>(<scope>):`), 완료 주장 전 이 세션 도구 결과 증거(fablize 게이트), 에이전트 보고는 diff·테스트로 독립 검증.
- 모델 라우팅: 구현=opus · 리뷰/판정=fable(429 시 한 단계 폴백·보고 명시).
- 금지: 기존 마이그레이션 파일 수정(①의 충돌 리네임 예외) · 범위 밖 리팩터링 · Workflow 도구(옵트인 없음).
- 병렬 세션 감지 시(내가 안 만든 미커밋 변경) 새 워크트리 격리.

## 완료 후

- 메모리(`project_job_posting_kiosk_order_sheet.md` — 게이트 완료 반영·잔여=실기기 QA만) · MEMORY.md 인덱스 갱신 · `/session-wrap`.
- 머지 완료 시 위키 졸업 후보(`/ingest`): conditions 왕복 9지점·Design B·#244 pending-window 가드.
