---
area: decisions
updated: 2026-09-20
status: current
sources:
  - .claude/rules/skills-guide.md
  - .mcp.json
  - uniqn-mobile/package.json
  - PR#340
  - PR#341
  - PR#342
  - PR#506
  - memory/project_oss_adoption_20260714
tags: [tooling, mcp, skills, plugins, hooks, eslint]
---

# 결정: 도구는 "설치했으니 둔다"가 아니라 **산출로 값을 증명한 것만** 둔다

도구(스킬·MCP·플러그인·훅)는 조용히 비용을 낸다 — 세션 프롬프트 자리, 연결 타임아웃, 매 툴
호출마다의 프로세스. 그 비용은 보이지 않고 **쓰지 않아도 계속 나간다**. 그래서 정리 기준은
"언젠가 쓸까"가 아니라 **최근 표본에서 실제로 무엇을 산출했나**다.

## 판정에 쓰는 실측 (4주 표본, 2026-09-20)

세션 기록(`~/.claude/projects/<proj>/*.jsonl`)에서 실제 호출을 센다:
```bash
grep -ho '"skill"[: ]*"[a-zA-Z0-9_:-]*"' *.jsonl | sed 's/.*"\([a-z0-9_:-]*\)"$/\1/' | sort | uniq -c | sort -rn
```
17세션 표본에서 실제 호출된 스킬은 **8종뿐**(artifact-design 7 · session-end 6 · pr 6 ·
deploy 6 · ingest 4 · brainstorming · oss-vet · frontend-design). 나머지 수백 종은 목록에만 있었다.

## 정리한 것과 그 근거

| 대상 | 판정 근거 |
|---|---|
| MCP `mcp-installer` | 호출 **0회**인데 매 세션 **30초 CONNECT_TIMEOUT** |
| MCP `higgsfield` | 엔드포인트 부재(ENDPOINT_NOT_FOUND) |
| 플러그인 context7·playwright·supabase | `.mcp.json` 과 **완전 중복** — 도구 정의가 2벌씩 실렸다(`mcp__supabase__*` 25개 + `mcp__plugin_supabase_supabase__*` 25개) |
| 동기화 플러그인 11종(legal·finance·HR·marketing·data·design·engineering·PM·productivity·pdf-viewer·cowork) | **스킬 76개**. 1인 RN 앱 개발에 `sox-testing`·`recruiting-pipeline` 은 쓸 일이 없다 |
| `continuous-learning-v2` 관측 | **입력만 쌓고 산출이 멈춰 있었다** — `observer.enabled:false` 라 instinct 마지막 생성이 2026-07-26 인데 `observations.jsonl` 은 6.5MB/48,637줄까지 자랐다 |
| `skills-archive/` 8종 | `skills/` 에 원본이 살아 있는 **사본**(이동이 아니라 복사였다) |

🔑 **"쓸지도 모른다"는 유지 사유가 아니다. 유지 사유는 "최근에 썼다" 또는 "없으면 막힌다"뿐이다.**

## 무한 증가하는 로그는 소비 방식까지 함께 봐야 한다

`work-log/buffer.jsonl` 이 **27.9MB / 123,634줄**까지 자랐는데, SessionStart 훅
(`context-sync-suggest.sh`)이 **마지막 `session_end` 하나를 찾으려고 전체를 줄단위로 파싱**하고
있었다(0.31초, 파일 크기에 비례해 증가).

- 훅을 **파일 끝에서 역방향 청크 읽기**로 바꿨다 → 같은 값, **0.31s → 0.0005s**.
- `work-tracker-tool.sh` 에 **로테이션**을 넣었다(8MB 초과 시 최근 20,000줄만 남기고
  `archive/` 로 이동, 삭제하지 않음). 분기를 임계값 0으로 강제 실행해 20,009→20,000줄과
  아카이브 append 를 확인했다.

🔑 **쌓는 쪽과 읽는 쪽을 같이 보지 않으면, 로그는 조용히 세션 시작 비용이 된다.**

## 줄일 수 없는 것도 있다 — 알고 관리한다

- **전역 스킬 70종은 감축 불가.** gstack 업그레이드가 `~/.claude/skills/gstack/` 원본에서
  복원한다(2026-07-28 실증: 아카이브한 6종이 되살아났다). `ios-*` 5종은 Expo RN 에 무관하니
  **호출하지 않는 것**으로 관리한다.
- **중복 7종(autoplan·cso·guard·health·investigate·retro·review)은 의도적 오버라이드** —
  프로젝트 버전이 우선한다. 삭제 금지.

## 도입 전 게이트

`/oss-vet` 6항목(유료벽·라이선스 OSI·훅 충돌·Windows 실행성·기존 자산 중복·npm 사칭).
실적으로 4건을 걸러냈다(Buoy 유료벽 · context-mode ELv2+훅 충돌 · ui-ux-pro-max 중복·용량 ·
web-interface-guidelines 적용면).

⚠️ **`graphify install` / `claude install` 류는 실행 금지** — CLAUDE.md 를 고치고 PreToolUse 훅을
심어 fablize 게이트와 충돌한다. CLI + MCP 서버만 쓴다.

## 버전 올리기가 막히는 지점 (2026-09-20)

`eslint` 10 은 아직 못 올린다 — `eslint-plugin-react@7.37.5`(최신 stable)의 peer 가
`eslint ^9.7` 까지고 10 지원은 `7.8.0-rc.0` **RC 뿐**이다. 머지하면
`TypeError: contextOrFilename.getFilename is not a function` 으로 `npm run lint` 가 exit 2.
→ 플러그인 stable 이 나온 뒤 **eslint + eslint-plugin-react 를 한 PR 로**.

반면 `eslint-plugin-react-hooks` 7 은 **우리 설정 버그**였다(PR#380) —
`eslint-config-expo/flat` 이 이미 등록한 `react-hooks` 를 `eslint.config.js` 가 재등록해
`Cannot redefine plugin` 이 났다. 등록만 지우면 규칙은 그대로 동작한다.
🚨 이때 **"경고 0건"은 규칙이 꺼진 것과 구별이 안 되므로** 고의 위반 프로브로 Red 를 봐야 한다
→ [[vacuous-verification]] 유형 2.

## 관련

- [[knowledge-layer-budget]] — 항상-로딩 계층의 예산 원리(색인·메모리). 이 페이지는 그 **도구 축**이다
- [[vacuous-verification]] — 산출이 멈춘 파이프라인·꺼진 규칙은 "성공"과 구별되지 않는다
- [[db-red-fix-and-release-2026-09]] — 같은 정리 세션의 코드 축 기록
