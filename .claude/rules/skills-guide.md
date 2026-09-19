---
paths:
  - "**/*"
---

# 스킬 사용 가이드

gstack 기반 커스텀 스킬 + superpowers + 프로젝트 전용 스킬 조합.

## 개발 워크플로우

| 단계 | 스킬 | 설명 |
|------|------|------|
| 아이디어 검증 | `/office-hours` | YC식 6가지 강제 질문 |
| 브레인스토밍 | `superpowers:brainstorming` | 요구사항·의도 탐색 |
| 계획 수립 | `/autoplan` | 아키텍처 레이어별 구현 계획 |
| 계획 리뷰 | `/plan-eng-review` | 엔지니어링 관점 검토 |
| TDD | `superpowers:test-driven-development` | Red→Green→Improve |
| 코드 리뷰 | `/review` | 5대 전문가 리뷰 + 자동 수정 |
| 보안 감사 | `/cso` | OWASP + STRIDE + Supabase RLS |
| 버그 조사 | `/investigate` | 4단계 근본 원인 조사 |
| 커밋 | `/commit` | 프로젝트 컨벤션 한글 커밋 |
| PR | `/pr` | PR 생성 자동화 |
| 배포 | `/deploy` | Supabase/EAS/Cloudflare 배포 |
| 품질 점수 | `/health` | 0-10점 종합 대시보드 |
| 위험 확인 | `/guard` | Supabase/결제/권한 변경 경고 |
| 회고 | `/retro` | 커밋 기반 주간 회고 |
| 완료 검증 | `superpowers:verification-before-completion` | 증거 기반 완료 확인 |
| 타입 체크 | `/type-check` | TypeScript 타입 에러 수정 |
| 테스트 | `/test` | 테스트 작성 및 실행 |
| 리팩토링 | `/refactor` | 코드 리팩토링 |
| 단순화 | `/simplify` | 구현 직후 복잡도 축소 |
| 지식 질의 | `/query` | wiki 인용 답변 (읽기 전용) |
| 지식 반영 | `/ingest` | 머지·해결된 교훈을 wiki로 졸업 |
| 세션 종료 | `/session-end` | 착지(PR·머지)·최신화(메모리·파리티)·정리(워크트리)·인계 **실행** |
| 세션 마무리 탐지 | `/session-wrap` | 문서/패턴/학습/후속 4병렬 **탐지·제안** |
| 메모리 감사 | `/memory-audit` | 월 1회 — claim 실존 검증 |
| OSS 도입 검증 | `/oss-vet` | 스킬·MCP·패키지 도입 **전** 6항목 |

### 도메인 스킬 (프로젝트 로컬 — 위 워크플로우 표에 없던 것)

| 영역 | 스킬 | 비고 |
|---|---|---|
| 성능 | `/performance` | 렌더링·번들·느린 화면 |
| 접근성 | `/a11y` | 스크린리더·키보드 |
| 국제화 | `/i18n` | 번역·다국어 |
| DB 마이그레이션 | `/migration` | 스키마 변경·데이터 이전 |
| 모션 감사·계획 | `/improve-animations` | 읽기 전용 — 계획만, 적용 안 함 |
| 모션 diff 리뷰 | `/review-animations` | **명시 호출 전용**(`disable-model-invocation`) |
| 모션 용어 역인덱스 | `/animation-vocabulary` | "그 통통 튀는 거" → 정확한 용어 |
| UI 마감·컴포넌트 폴리시 | `/emil-design-eng` | Emil Kowalski 철학 |
| 제스처·스프링·재질·타이포 | `/apple-design` | Apple HIG 를 웹으로 |

## 스킬 우선순위

1. **프로젝트 로컬** (`.claude/skills/`) — 프로젝트 규칙 내장, 최우선
2. **gstack 전역** (`~/.claude/skills/gstack/`) — 프로젝트 오버라이드 없는 것만
3. **superpowers** — 프로세스/규율 (TDD, 디버깅, 검증, 병렬 에이전트)

## 상황별 선택

| 상황 | 사용 스킬 |
|------|----------|
| "이거 리뷰해줘" | `/review` |
| "에러 났어" / "안돼" | `/investigate` |
| "보안 검사" | `/cso` |
| "이 기능 어떻게 만들지" | `/autoplan` |
| "프로젝트 상태" | `/health` |
| "이번 주 뭐했지" | `/retro` |
| "RLS 바꿔야 해" | `/guard` 먼저 → 작업 |
| "테스트 작성해줘" | `/test` |
| "리팩토링 해줘" | `/refactor` |
| "배포해줘" | `/deploy` |
| "타입 에러" | `/type-check` |
| "디자인 검토" | `/design-review` |
| "커밋해줘" | `/commit` |
| "PR 만들어줘" | `/pr` |
| "이거 왜 이렇게 됐지" (과거 결정) | `/query` |
| "세션종료" / "마무리하자" / "끝내자" | `/session-end` |
| "세션 정리해줘" / 회고성 탐지 | `/session-wrap` |
| "이 도구 써볼까" / OSS·MCP 도입 검토 | `/oss-vet` 먼저 → 도입 |

에이전트 분담·병렬 디스패치·모델 3계층 라우팅·훅 규칙은 `.claude/rules/orchestration.md` 참조. 스킬이 서브에이전트를 디스패치할 때도 모델 라우팅(읽기=haiku/sonnet·구현=opus·판정=fable) 준수.

## 스킬/MCP 정리 이력 (2026-07-12)
- **무관 스킬 정리 시도 — 6종은 되살아났다** (2026-07-28 실측 정정): 실제로 제거된 건 `cache-components`(Next.js)·`frontend-code-review`(/review 와 중복) **2종뿐**이다. `ios-clean/ios-design-review/ios-fix/ios-qa/ios-sync`·`devex-review` 는 `~/.claude/skills-archive/` 에 **사본이 남았을 뿐**(이동이 아니라 복사였다) `~/.claude/skills/` 에 다시 등록돼 있다 — gstack 업그레이드가 `~/.claude/skills/gstack/` 원본에서 복원한다. 이 프로젝트는 Expo RN 이라 ios-* 는 여전히 무관하니 **호출하지 말 것**. 재아카이브하려면 gstack 원본까지 손대야 해 사실상 불가하다.
- **MCP 제거**: revenuecat(수익모델 설계 P6=RevenueCat 재도입 안함)·tosspayments(PortOne 채택) — `.mcp.json`·전역 `mcp-config.json`. 유지: context7·playwright·supabase·graphify.
- **중복 7종은 의도적 오버라이드**(autoplan·cso·guard·health·investigate·retro·review) — 프로젝트 버전이 우선(위 우선순위 규칙). 삭제 금지.

## 스킬/MCP 정리 이력 (2026-07-26)
- **MCP 추가**: `graphify` (stdio, `graphify-mcp uniqn-mobile/graphify-out/graph.json`). 코드·SQL 구조 전용 지식그래프, 툴 10종. 값어치는 `get_node`/`get_neighbors`/`shortest_path` — **`query_graph`는 임베딩이 없어 한글 질의가 0건**이다. `.graphifyignore`로 `*.md`·`migrations/archive/`·`supabase/fixtures/`를 제외해 옵시디언 색인과의 중복과 오탐을 없앴다.
  - ⚠️ `graphify install`/`claude install`은 **실행 금지** — CLAUDE.md를 고치고 PreToolUse 훅을 심어 fablize 게이트와 충돌한다. CLI + MCP 서버만 쓴다.
  - 전제: `uv tool install "graphifyy[sql,mcp]"`. `graphify-out/`은 gitignore라 새 워크트리엔 없다.
  - **재색인은 수동이다 — 그래프는 조용히 낡는다.** `graphify update uniqn-mobile`(레포 루트에서, 약 2분·22 워커). MCP 툴은 낡은 그래프에도 정상 응답하므로 **오래됐다는 신호가 없다**. 머지 웨이브 직후·대규모 리팩터링 후·`get_node` 가 최근 추가한 심볼을 못 찾을 때 돌린다. 검증법 = 방금 추가한 함수를 `get_node` 로 조회해 파일:줄이 나오는지 확인. 코드 삭제가 많았던 뒤엔 노드 수 감소로 갱신이 거부되므로 `--force` 가 필요하다. 노드 5000 초과라 `graph.html` 은 생성되지 않는다(정상) — 대신 `graphify-out/GRAPH_REPORT.md` 를 본다.
- **스킬 추가**: `obsidian-markdown` (kepano/obsidian-skills, MIT에서 1종만 선별). 이 저장소가 옵시디언 볼트이고 `wiki/`·메모리가 위키링크를 쓰는데 규약이 없었다. 같은 팩의 `obsidian-cli`는 `obsidian` 바이너리 미설치로, `defuddle`은 기존 웹 페치 규칙과 중복이라 제외.
- **도입 검토 후 탈락**: `Buoy`(RN 인앱 devtools — MCP·프로덕션 빌드가 Pro 유료), `context-mode`(툴 출력 98% 절감이지만 ELv2 라이선스 + `UserPromptSubmit`/`PostToolUse`/`Stop`을 fablize 게이트와 정면 공유).
- 관측 도구 `claude-devtools`는 리포 밖(Docker 컨테이너, `localhost:3456`). Windows에서 `.exe`/npx 경로는 실패하므로 **Docker만** 쓸 것.
- **스킬 추가**: `oss-vet` — 위 도입 검토 7건에 수동으로 반복한 검증을 체크리스트로 고정했다(유료벽·라이선스 OSI·훅 충돌·Windows 실행성·기존 자산 중복·npm 사칭). 실제로 4건을 걸러낸 실적이 근거다. 앞으로 스킬·MCP·패키지 도입 **전에** 먼저 돌린다.

## 스킬/MCP 정리 이력 (2026-09-20)

- **MCP 제거 2종** — `mcp-installer`(프로젝트 `.mcp.json` + 전역 `mcp-config.json`): 4주 표본에서
  호출 0회인데 **매 세션 30초 CONNECT_TIMEOUT** 을 태웠다. `higgsfield`(전역 `~/.claude.json`):
  엔드포인트 자체가 없다(ENDPOINT_NOT_FOUND). 현재 MCP = **context7·playwright·supabase·graphify**
  (`ide` 는 IDE 확장이 떠 있을 때만 붙는 것이라 설정 대상이 아니다).
- **잔재 삭제** — 전역 `rules/*.bak-20260712` 2개 · `~/.claude/skills-archive/`(8종 **사본**,
  원본이 `skills/` 에 살아 있어 이중 보관이었다) · 프로젝트 `.claude/` 의 `pr-body.md`·
  `wf-screen-audit.js`·`wf-screen-audit-v2.js`·`scheduled_tasks.lock`(6~7월 잔재, 미추적) ·
  `.claude/worktrees/`(8월 워크트리의 **빈 디렉토리 5개**).
- 🔑 **`ls -laR` 이 하위 디렉토리를 조용히 누락했다** — `worktrees/…/supabase` 아래 `functions`·
  `snippets` 가 목록에 안 나와 "비었는데 rmdir 실패"로 보였다. **`find` 또는 `cmd dir /a /s /b`
  로 교차검증**할 것(같은 계열 함정=[[pitfall_bash_grep_app_tree_silent_zero]]).
- **훅 19개 전량 실재 확인** — PreToolUse 3 · SessionStart 2 · UserPromptSubmit 3 · PostToolUse 7 ·
  Stop 4. 죽은 배선 0건이라 정리 대상이 없다.
- ⚠️ **전역 스킬 70종은 줄이지 못한다** — gstack 업그레이드가 `~/.claude/skills/gstack/` 원본에서
  복원하므로 삭제해도 되살아난다(2026-07-28 실증). ios-* 5종은 Expo RN 프로젝트에 무관하니
  **호출하지 않는 것**으로 관리한다.
- 🚨 **`eslint` 10 은 아직 못 올린다**(PR#479 보류) — `eslint-plugin-react@7.37.5`(최신 stable)의
  peer 가 `eslint ^9.7` 까지고, ESLint 10 지원은 `7.8.0-rc.0` **RC 뿐**이다. 머지하면
  `TypeError: contextOrFilename.getFilename is not a function` 으로 `npm run lint` 가 exit 2 로 죽는다.
  플러그인 stable 이 나온 뒤 **eslint + eslint-plugin-react 를 한 PR 로** 올릴 것.

## 스킬/MCP 정리 이력 (2026-09-11)

- **`vercel-labs/agent-skills` 의 `react-native-skills` — 조건부 채택(스킬 설치 없이 룰만 흡수)**.
  `/oss-vet` 6항목 전량 실측: 유료벽 없음 · 훅 충돌 없음(스킬 내부가 `.md` 41 + `metadata.json` 1
  **뿐**, 스크립트 0) · Windows 무관(실행 파일 0) · 공급망 정상(`vercel-labs` 공식 org,
  `skills` npm maintainer = `rauchg`). **라이선스는 혼재** — 레포 루트 `licenseInfo: null`
  인데 `SKILL.md` frontmatter 는 `license: MIT`. 그래서 **원문 복사 금지, 우리 문장으로 재작성만** 했다.
  `npx skills add` 도 돌리지 않았다(graphify `install` 선례 — CLAUDE.md + PreToolUse 를 심는다).
- 🔑 **교훈: 규칙 문서 grep 으로 "갭"을 판정하면 틀린다 — 코드를 재라.**
  `useCallback` 이 `.claude/rules/`·CLAUDE.md 에 0건이라 "콜백 안정화 규칙이 없다"고 봤으나,
  실제 코드는 `JobList`·`ApplicantList`·`NotificationList` 전부 `useCallback` + deps 로
  **이미 지키고 있었다**. 관행으로 정착했지만 명문화만 안 된 상태였다. 룰 13종을 흡수하려던
  계획이 실측 후 **2종**으로 줄었다(→ `nativewind-patterns.md` §6·§7).
- **해당 없음으로 판정된 룰**: `react-compiler-*` 2종(**React Compiler 미사용** — `app.json`·
  `babel.config.js` 에 설정 0. 켜면 `.value` 54곳이 대상이 되므로 도입 시 재검토) ·
  `ui-safe-area-scroll`(SafeAreaView 가 145화면에 정착 + 웹 지원이라 `contentInsetAdjustmentBehavior`
  전환은 대공사·이득 불명) · `ui-scrollview-content-inset`(impact LOW 이고 우리 `contentContainerStyle`
  53곳이 **대부분 정적 padding** — 룰 자체가 "정적이면 padding 으로 충분"이라 명시) ·
  `navigation-native-navigators`(expo-router 55 기본 스택이 이미 native-stack).
- ⚠️ **원문 품질에 편차가 있다 — 그대로 베끼지 말 것**. `list-performance-callbacks.md` 는
  frontmatter 에 `tags: tag1, tag2` 플레이스홀더가 남아 있고 참조 링크가 `https://example.com`
  이며, "correct" 예제 코드 자체가 어긋나 있다(리스트 루트의 `useCallback` 이 `item.id` 에 의존).
- **탈락: `nextlevelbuilder/ui-ux-pro-max`** (실측 126,611 stars · MIT · 활발). 인기는 진짜지만
  ①우선순위 1~10 표(대비 4.5:1·터치 44×44·60-30-10·모션·다크모드·시맨틱 토큰)가
  `impeccable-design.md` 29룰과 영역이 겹치고 ②핵심 가치인 **디자인 시스템 생성기**
  (79 스타일·192 팔레트·74 폰트 페어링)가 **Black & Gold v3.0 이 확정된 우리에겐 무용**이며
  ③`google-fonts.csv` 747KB + `phosphor-icons` 823KB + `.ttf` 다수가 `src/`·`cli/assets/`·
  `.claude/skills/` 에 **3벌 중복**으로 들어 있고 Python 스크립트를 요구한다. 웹·슬라이드·배너 중심.
- **보류: `vercel-labs/web-interface-guidelines`** (858 stars, MIT). 100+ 룰이나 **웹 인터페이스용**이라
  RN 주력인 현 단계에선 적용면이 좁다. 웹 빌드 품질을 볼 때 재검토.
