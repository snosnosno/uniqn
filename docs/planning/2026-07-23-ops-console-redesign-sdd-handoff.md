# 핸드오프 — ops 운영 콘솔 리디자인 + 블라인드 프리셋 SDD 실행 (다음 세션 메인 프롬프트)

> 아래 "메인 프롬프트" 블록을 다음 세션 첫 입력으로 붙여넣는다.

---

## 메인 프롬프트

ops 운영 콘솔 리디자인을 SDD(subagent-driven development)로 끝까지 구현한다.

### 시작 상태 (2026-07-23 설계 세션 완료분)

- 브랜치 `docs/ops-console-redesign-specs` — 워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-docs`에 체크아웃돼 있음. 커밋 4개: spec 2건(`81739701a`) + 계획 2건(`fb80d6858`) + fable 검증 리뷰 반영 2건(`621e672c7`·`8aa22ac7b`).
- **계획 2건 모두 fable 리뷰 통과 후 수정 완료** — 각 문서 끝 "리뷰 반영 이력" 섹션이 무엇이 왜 바뀌었는지 기록. 계획 본문의 "검증됨(리뷰)" 노트는 실제 코드 라인과 대조된 사실이다.
- 와이어프레임(비개발자 요약): https://claude.ai/code/artifact/3b2a9451-e6cf-4e18-8989-c0c7779d3720

### 실행 대상 (순서 고정)

1. **계획 A — 레이아웃 리디자인** `docs/superpowers/plans/2026-07-23-ops-console-layout-redesign.md` (7태스크, **스키마 무변경** → 바로 착수 가능)
2. **계획 B — 블라인드 기본 1~30 + 프리셋** `docs/superpowers/plans/2026-07-23-ops-blind-preset-default.md` (6태스크, 신규 테이블+RPC → **T3 착수 전 `/guard`**, 마이그는 로컬 GREEN 후에만 MCP prod)

spec: `docs/superpowers/specs/2026-07-23-ops-console-layout-redesign-design.md`(L1~L8) · `2026-07-23-ops-blind-preset-default-design.md`(B1~B7).

### 실행 방식

- `superpowers:subagent-driven-development` 스킬 — 태스크별 fresh 서브에이전트 + 태스크 간 리뷰. 모델 라우팅: 구현 에이전트=opus, 리뷰/판정=fable.
- 계획 A의 T1~T4는 상호 독립(병렬 디스패치 가능), T5→T6→T7 순차. 계획 B는 T1→T2, T3→T4→T5→T6 (T1·T3 병렬 가능).
- 각 태스크는 계획 문서의 스텝(RED→GREEN→커밋)을 그대로 — 계획이 이미 시그니처·모킹 문형까지 검증돼 있으니 **계획 밖 즉흥 금지**, 단 "실행 시 확인" 노트가 붙은 지점(showAlert import 경로 등)은 현행 코드 우선.

### 작업 트리 규칙 (중요)

1. 메인 트리(`C:\Users\user\Desktop\T-HOLDEM`)는 다른 세션이 점유 중일 수 있다 — `git status` 먼저, 내가 안 만든 미커밋 변경이 있으면 **`T-HOLDEM-ops-docs` 워크트리에서 작업**(이미 `docs/ops-console-redesign-specs` 체크아웃됨).
2. 워크트리에서 앱 코드를 빌드/테스트하려면 node_modules junction: `mklink /J C:\Users\user\Desktop\T-HOLDEM-ops-docs\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules` (5분 npm install 절약, 메모리 `feedback_worktree_node_modules_junction`).
3. 구현 커밋은 현 브랜치에 이어서(docs 커밋 위). push/PR은 사용자 명시 요청 시만.

### 게이트·금지

- 완료 주장 전 각 태스크의 검증 명령 실행 증거 필수(`npm run quality` + 해당 Jest / 계획 B DB슬라이스는 `npm run db:reset && npm run test:db`).
- 계획 B: 서브에이전트에 `mcp__supabase__*` 직접 호출 금지 명시. MCP `apply_migration`(prod)은 로컬 pgTAP GREEN + security-reviewer 통과 후 **메인 세션이 직접**. prod 선적용 절대 금지.
- anon-executable ops SECDEF =2 계약 — 신규 함수 REVOKE 누락 시 pgTAP 가드가 RED.
- 계획 A T7: eliminator picker(바운티)·handleBustSuccess 문구 이관 생략 금지(동작 등가). QR 버튼은 행 잔류.

### 완료 후

- 두 계획 완주 시: `npm run quality` + 전체 관련 Jest 최종 실행 → 결과 보고. 실기기 QA(폰/태블릿 600dp·시트 터치)는 사용자 게이트로 남긴다.
- 메모리 `project_ops_console_redesign_20260723` 갱신(진행 상태·잔여). push/PR·머지는 사용자 지시 대기.

---

## 참고 — 설계 세션 경과 요약 (다음 세션이 안 읽어도 되는 배경)

- 와이어프레임 브레인스토밍(폰 5탭: 현황 기본·테이블·참가·블라인드·스태프 + `⋯`=상금·이력, 상시 클럭 스트립, 태블릿 600dp 사이드바) → spec 2건 분리 → 계획 2건 작성 → fable 리뷰어 2기 병렬 검증(둘 다 "수정 후 실행" 판정) → 발견 전건 반영.
- 리뷰가 잡은 치명 결함: freeSeat=seatId(참가자 객체에 좌석 없음)·moveMode 진입점 소멸·마이그 prod 선적용 지시·anon 가드 false-RED·upsert 누락 — 전부 계획에 반영됨.
- 블라인드 기본값: LV1~30, ante=BB, 20분/레벨(spec §2 표가 단일 소스). 프리셋 = 내 계정 전용(owner RLS).
