# 핸드오프 — ops 콘솔 출하 게이트(push/PR→머지→정리) + 후속 마이그 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 다음 세션 첫 입력으로 붙여넣는다.

---

## 메인 프롬프트

ops 운영 콘솔 리디자인 브랜치를 출하한다: push/PR 생성 → 체크 green 확인 → 머지 → 지식 졸업(/ingest) → 워크트리 정리. 이후 여력이 있으면 서버 levels 상한 후속 마이그를 진행한다.

### 시작 상태 (2026-07-24 후속 세션 완료분)

- 브랜치 `docs/ops-console-redesign-specs` @ `fb1401b0f` — 워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-docs` 체크아웃, **미push**. 총 23커밋(docs 5 + SDD 구현 14 + master merge `6bde3dd61` + 후속 4: a11y `90ee0c216`·L7 FAB `2e515864e`·패딩 `c0621043f`·프리셋 UX `fb1401b0f`).
- 검증 완료(실측): 전체 ops Jest 54스위트/551 PASS · quality exit 0 · fable 최종 리뷰 2회 APPROVE(본체+후속). 원장=워크트리 `.superpowers/sdd/progress.md`(gitignore — 디스크에만 있음, 삭제 주의).
- ⚠️ **prod 마이그 2건 적용완료 — 재적용 절대 금지**: `20260724000000_ops_blind_presets` · `20260724000100_ops_blind_preset_rpcs`.
- 메모리 `project_ops_console_redesign_20260723` 최신화됨(교훈·잔여 포함).

### 작업 순서

**1. push/PR**: `git fetch origin master` — master가 진전됐으면 merge(squash 저장소, rebase 금지) 후 ops Jest+quality 재검증. push는 `git push -u origin docs/ops-console-redesign-specs`. PR 본문: SDD 13태스크+후속 3묶음 요약, 테스트 플랜=아래 실기기 QA 체크리스트. ⚠️auto-merge는 Quality만으로 발동(E2E 비필수) — 머지 확인 전 후속 push 금지.

**2. 머지 후 정리**:
- `/ingest`로 wiki 졸업 후보: ①RNW style `pointerEvents:'box-none'` 드롭(웹 딤 클릭 삼킴 — prop 필수, Modal/SheetModal 수정) ②행 Pressable 중첩=웹 button-in-button 하이드레이션 에러 ③RNModal+gorhom 동시오픈 피커 가림(visible 게이트) ④워크트리 expo dev EMFILE→정적 export(`--clear` 필수)+serve. → 졸업 후 메모리 가지치기.
- 워크트리 정리: `T-HOLDEM-ops-docs` 제거 전 **node_modules junction 해제 선행**(메모리 `feedback_worktree_node_modules_junction`), `.env.local` 복사본은 삭제 무방.
- prod 데모 대회 "디자인리뷰 데모 대회"(review-employer 소유, 참가자 0) — 사용자에게 정리 여부 확인.

**3. (선택 후속) 서버 levels 상한 마이그**: 클라 zod `.max(100)`만 있고 서버 RPC(`ops_set_blind_levels`·프리셋 save RPC)는 무상한. 진행 시: `/guard` 먼저 → **새 마이그**(기존 수정 금지) → 로컬 `npm run db:reset && npm run test:db` GREEN → database-reviewer(fable) 리뷰 → 메인 세션이 MCP로 prod 적용 → proconfig 실측(이 RPC들은 inline SET search_path이나 확인 습관 유지). 사전존재 100+ 레벨 재저장 거부 엣지(fable LOW)도 이 마이그에 동봉 판단.

### 게이트·금지
- push/PR/머지는 이 프롬프트 자체가 사용자 지시 — 단 **머지 직전 최신 master 재통합+재검증** 필수(stale-base green 무효).
- 서브에이전트 `mcp__supabase__*` 금지. prod 적용은 메인 세션이 로컬 GREEN+리뷰 후 직접.
- 브랜치 삭제는 `gh api -X DELETE .../git/refs/heads/<br>`(pre-push 훅 hang 함정).

### 실기기 QA 체크리스트 (사용자 게이트 — PR 테스트 플랜에 기재)
①바운티 탈락 피커 표시(Android/iOS) ②태블릿 600dp 사이드바 ③⋯ 오버플로 시트 터치 ④프리셋 시트 키보드/다크모드 ⑤등록 FAB 터치·등록 시트 키보드 ⑥VoiceOver 탭 낭독(role=tab+selected) ⑦웹 딤 탭 닫기 크로스브라우저(Safari 포함)

### 참고 — 직전 세션 경과(안 읽어도 됨)
- 전체 리뷰(fable)·UI/UX 웹 실관찰·후속 3묶음(a11y/L7 FAB/프리셋 UX) 전부 APPROVE 마감. 상세=`.superpowers/sdd/progress.md` "후속 세션" 섹션 + 메모리 토픽 파일.
- 구현 서브에이전트가 "작업 후 무보고 유휴"로 3회 멈춤 — diff 검수 후 메인 세션 인수가 빨랐다.
