# 핸드오프 — 대회 생성 주문서화 S1 SDD 실행 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 다음 세션에 그대로 붙여넣어 시작한다.

---

## 메인 프롬프트

대회(tournament) 공고 생성을 주문서(order-sheet) 키오스크로 이관하는 **S1**을 SDD로 끝까지 구현해줘.

**착수 전 필수 확인 (이번 세션에서 겪은 함정 — 반드시 선행):**
1. `git status` + `git branch --show-current` — 작업 브랜치는 **`docs/order-sheet-unification-design`**. 여기에 설계문서 + S1 계획이 이미 커밋돼 있다(`git log --oneline -3`로 `f6db1e748` 플랜 · `5cce41231` 설계 · `869febacd` #259 확인).
2. **병렬 세션 격리**: 별도 워크트리 `.claude/worktrees/ops-posting-followup`(브랜치 `feat/ops-posting-reverse-hook`)가 활성일 수 있다. 이 메인 체크아웃은 단일트리라 **커밋 직전마다 `git branch --show-current`로 브랜치를 재확인**해라 — 지난 세션에 워킹트리가 master로 되돌려져 커밋이 master에 샜다. master에 직접 커밋 금지, 항상 feature 브랜치.
3. 커밋 직전 `git log --oneline -1`로 부모가 의도한 HEAD인지 확인.

**계획서(SSOT)**: `docs/superpowers/plans/2026-07-16-order-sheet-tournament-create.md` — 5개 TDD 태스크, 실제 코드·경로·명령 포함. 설계 근거: `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md`.

**실행 방식**: `superpowers:subagent-driven-development` 스킬로 태스크당 새 서브에이전트 디스패치 + 태스크 간 리뷰.
- **모델 라우팅**: 구현 서브에이전트 = **opus** / 태스크 리뷰·최종 판정 = **fable** (전역 agents-v2 · orchestration.md). 한도 시 fable→opus→sonnet 폴백 + 다운그레이드 명시.
- 서브에이전트 디스패치 프롬프트에 **금지사항 명시**: `mcp__supabase__*` 직접 호출 금지 · 기존 마이그레이션 수정 금지 · PROD 우회 금지 · 계획 범위 밖 리팩터 금지.
- 에이전트 "성공" 보고는 그대로 신뢰 금지 — **VCS diff + jest 실행으로 독립 검증** 후 다음 태스크.

**작업 디렉토리**: `uniqn-mobile/`. 검증 게이트 = `npm run quality`(tsc+eslint+prettier) + 관련 `npx jest`.

**S1 범위 (5태스크 요약):**
1. 스키마 enum에 `'tournament'` 추가 + `mappers.ts:278` silent-coercion(대회→regular 뭉갬) 제거 + 왕복 테스트(silent-coercion red-green 포함).
2. `TypeSegment` value prop 확장 + `OrderSheetScreen.handleTypeChange`가 **고정만** 레거시 위임(대회는 주문서 내부).
3. 대회 안내 배너(`InformationCircleIcon`·이모지 금지) + 제출 라벨 '승인 요청하기'.
4. 완료화면(`create-success.tsx`) + venueId 토스트 대회 승인 안내 분기(`pending` 파라미터).
5. 통합 검증: `npm run quality` exit 0 + order-sheet/create 스위트 무회귀 + 대회 create input `postingType` 보존 스팟체크.

**불변 계약 (계획서 Global Constraints):**
- 서버 **무변경**(마이그·RLS·EF 0) — 승인 워크플로우는 기존 `JobPostingRepository`가 `postingType==='tournament'`이면 `approvalStatus=PENDING` 자동 주입. 폼 입력 0.
- 한글(주석·커밋·문구) · `logger`(console.log 금지) · `dark:` · `@/` 경로 · toast/Alert · camelCase · 아이콘 `@/components/icons` stroke 2.0 · zodResolver **3제네릭** 유지.
- 커밋 컨벤션 `<type>(<scope>): 한글`. JS-only → OTA 출하 가능.

**출하 게이트 (구현 후, 사용자 게이트):**
- 전 태스크 완료 + `npm run quality`/jest green 후 최종 whole-branch 리뷰(fable).
- **실기기 QA는 사용자 게이트** — 계획서 Task5 Step4 체크리스트(대회 탭→배너→'승인 요청하기'→완료화면 안내, 대회 PENDING 검색 비노출, 고정 탭 레거시 무회귀, 지원/급구 무회귀).
- push/PR/OTA는 **명시 요청 시에만**(로컬 커밋만 자율).

**슬라이스 경계**: 이번은 **S1(대회 생성)만**. 대회 편집·고정(S2)·전 타입 편집(S3)·레거시 은퇴(S4)는 각자 별도 계획 — 손대지 말 것.

---

## 세션 컨텍스트 (참고)

- 설계 대화 요약: 사용자 결정 = ①대회·고정 한 스펙·슬라이스 분리 ②전 타입 생성+편집 주문서화 ③고정 스케줄 현행 유지(주 N일) ④레거시 은퇴 마지막 슬라이스 ⑤스케줄 discriminated union ⑥대회 편집 승인상태 보존.
- 시각 설계안 아티팩트: https://claude.ai/code/artifact/bee7aa02-b57a-43fa-aeb2-fd8cbe9715ae
- 핵심 실측(전제 교정): 대회는 매퍼에서 throw가 아니라 `mappers.ts:278`에서 **조용히 regular로 치환**됐다(위키 whitelist-silent-drop 재발 클래스) — S1 Task1이 근절.
- 관련 위키: `wiki/decisions/order-sheet-form-contract.md` · `wiki/decisions/whitelist-silent-drop.md` · `wiki/sources/job-posting-kiosk-order-sheet.md`.
