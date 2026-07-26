---
name: oss-vet
description: OSS 도입 전 6항목 검증. 스킬/MCP/패키지 도입, 이 도구 써볼까, OSS 검토, 라이선스 확인 요청 시 활성화
allowed-tools: Read, Bash, Grep, Glob, WebSearch
---

# OSS 도입 검증 스킬

새 스킬·MCP 서버·npm 패키지·CLI 도구를 이 저장소에 들이기 **전에** 돌리는 체크리스트다.

> 실적: 2026-07-26 세션에서 후보 7건에 이 검증을 수동으로 반복해 **4건을 걸러냈다**
> (Buoy·context-mode·obsidian-cli·defuddle). 추상적 체크리스트가 아니다.

## 입력 / 출력

- **입력**: GitHub 저장소 URL 또는 npm 패키지명
- **출력**: 6항목 판정 표 + `도입` / `조건부 도입` / `탈락` 권고 + 근거

## 원칙

- **결론 먼저.** 항목별 나열보다 도입/탈락 판정을 첫 줄에 쓴다.
- **탈락 근거를 기록한다.** 나중에 같은 도구가 다시 후보로 올라온다. 판정만 남기고
  근거를 버리면 검증을 처음부터 반복하게 된다.
- **웹 페치 금지** — 전역 규칙대로 `WebSearch` / `gh` / `curl -sL --max-time 20` 을 쓴다.
  저장소 분석은 `git clone --depth 1` 후 로컬 탐색이 가장 안정적이다.

## 체크리스트 6항목

### 1. 유료벽 위치

README의 "free" 를 믿지 말고 **Pro/Enterprise 경계**를 직접 찾는다. 무료 티어가
넓어 보여도 우리가 실제로 쓸 기능만 유료인 경우가 흔하다.

```bash
gh repo view <owner>/<repo> --json description,homepageUrl
grep -riE "pro |enterprise|paid|pricing|license key|subscription" README.md docs/ | head -20
```

> 걸러낸 사례: **Buoy** — 15개 툴이 무료지만 정작 필요한 **MCP 서버와 프로덕션 빌드가 Pro**.

### 2. 라이선스 OSI 여부

`ELv2` · `BSL` · `SSPL` · `NOASSERTION` 은 **오픈소스가 아니다**. 사내 사용은 가능해도
재배포·수정 조건이 붙는다.

```bash
gh repo view <owner>/<repo> --json licenseInfo
npm view <pkg> license
```

> 걸러낸 사례: **context-mode** — 툴 출력 98% 절감이라는 실적에도 ELv2 라 탈락.

### 3. 훅 충돌 (이 저장소 고유 — 가장 자주 걸린다)

설치 스크립트가 `UserPromptSubmit` / `PostToolUse` / `Stop` / `PreToolUse` 나
`CLAUDE.md` 를 건드리는가. **fablize 게이트가 이미 3지점을 점유** 중이라 정면 충돌한다.

```bash
grep -rnE "UserPromptSubmit|PostToolUse|PreToolUse|SessionStart|\"Stop\"|CLAUDE\.md" \
  <clone>/install* <clone>/scripts/ <clone>/*.json 2>/dev/null | head -20
```

- **설치 명령을 그냥 돌리지 말 것.** `<tool> install` 류는 대개 훅과 CLAUDE.md 를 심는다.
  CLI 와 MCP 서버만 수동 등록하는 경로가 있는지 먼저 확인한다.

> 걸러낸 사례: **context-mode**(훅 3지점 공유) · **graphify 의 `graphify install`**
> (CLAUDE.md 수정 + PreToolUse) — graphify 자체는 CLI+MCP 수동 등록으로 도입했다.

### 4. Windows 실행 가능성

이 개발 머신은 **Windows 11 + Git Bash** 다. 서명 없는 `.exe`, POSIX 전용 스크립트,
macOS 전용 기능은 문서에 안 적혀 있어도 조용히 실패한다.

```bash
grep -rnE "darwin|macos|#!/bin/(ba)?sh|\.sh\b|xcode|brew install" README.md package.json | head -20
npm view <pkg> os cpu
```

- 실패하면 **Docker 경로가 있는지** 확인한다. 그게 우회로인 경우가 많다.

> 걸러낸 사례: **claude-devtools** 의 npm/exe 경로(→ Docker 로 우회해 도입) ·
> **obsidian-cli**(`obsidian` 바이너리 미설치).

### 5. 기존 자산과 중복

들이기 전에 이미 있는 것과 대조한다. 중복 도입은 규칙이 두 곳에 갈라지는 비용을 낳는다.

```bash
ls .claude/skills/ ~/.claude/skills/ && cat .mcp.json && ls scripts/
grep -rn "<핵심기능 키워드>" .claude/rules/ CLAUDE.md | head
```

> 걸러낸 사례: **defuddle** — 기존 웹 페치 규칙(`interaction.md`)과 중복.

### 6. npm 사칭(typosquat) 검증

패키지가 주장하는 저장소와 실제 저장소가 일치하는가. 이름이 한 글자 다른 사칭 패키지는
설치 스크립트로 임의 코드를 실행한다.

```bash
npm view <pkg> repository.url maintainers time.created
```

- 생성일이 최근이고 다운로드가 적은데 유명 패키지와 이름이 비슷하면 **중단**한다.

## 판정 후 할 일

- **도입 시**: `.claude/rules/skills-guide.md` 의 "스킬/MCP 정리 이력" 에 도입 근거를
  한 줄 남기고, 스택 변경이면 `wiki/log.md` 에 `note` 엔트리를 추가한다
  (`[2026-04-17] Firebase MCP 제거` 선례 형식).
- **탈락 시**: 같은 파일에 **탈락 근거까지** 기록한다. 근거 없는 탈락 기록은 재검증을 부른다.

## 하지 말 것

- **새 훅을 만들지 말 것.** fablize 게이트가 이미 3지점을 점유하고 있고, 이 체크리스트의
  목적 자체가 훅 충돌을 사전에 걸러내는 것이다. 수동 실행형으로 쓴다.
- 6항목 중 일부만 돌리고 "통과" 로 판정하지 말 것 — 걸러낸 4건이 **서로 다른 항목**에
  걸렸다. 어느 항목이 결정적일지는 미리 알 수 없다.
