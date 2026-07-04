---
paths:
  - "**/*"
---

# 세션 오케스트레이션 규칙 (하네스 자동 운영)

모든 세션은 사용자 지시 없이도 아래 분담·자동화 규칙을 스스로 적용한다.

## 세션 시작 프로토콜
1. 구현 작업 전 `git status` — 내가 만들지 않은 미커밋 변경이 있으면 새 워크트리+브랜치로 격리 (전역 git-workflow 규칙)
2. 옵시디언 색인(SessionStart 훅이 자동 주입)은 지도로만 사용 — 관련 노트만 on-demand Read, 전체 로딩 금지
3. 작업 유형에 맞는 스킬 라우팅 확인 — CLAUDE.md 라우팅 표 + `.claude/rules/skills-guide.md`. 1%라도 해당하면 Skill tool 먼저 호출

## 에이전트 분담 (Agent tool) — 기본값
| 상황 | 에이전트 | 비고 |
|---|---|---|
| 여러 파일·규약에 걸친 탐색 | Explore | 읽기 전용, 결론만 회수 |
| 구현 전 설계 | Plan / planner | 신규 기능 3+ 파일 = 설계 먼저 (HARD-GATE) |
| 코드 작성·수정 직후 | code-reviewer | 프롬프트 없이 자동 실행 |
| 커밋 전 보안 민감 변경 | security-reviewer | RLS·인증·입력검증·시크릿 |
| 빌드 실패 | build-error-resolver | |
| DB 스키마·쿼리·RLS | database-reviewer | Supabase/PostgreSQL |
| 다단계 복합 검색 | general-purpose | 첫 시도로 못 찾을 검색 |

- 독립 작업 2개 이상 → **한 메시지에 병렬 디스패치** (순차 금지)
- 에이전트의 "성공" 보고는 독립 검증(diff 확인·테스트 실행) 후에만 신뢰 — 전역 verification 규칙
- 에이전트 디스패치 프롬프트에 금지사항 명시: `mcp__supabase__*` 직접 호출 금지·기존 마이그레이션 수정 금지·PROD 우회 금지

## 대규모 오케스트레이션 (Workflow 도구)
- 멀티에이전트 파이프라인(Workflow)은 **사용자 옵트인 필수** — "워크플로우/ultracode/팬아웃" 명시 요청 시만 실행
- 유익할 것 같으면 비용 개요와 함께 1회 제안만 하고 Agent tool 병렬로 대신 수행
- 에이전트 간 상호 통신이 필요한 협업 → `/team-orchestrator` 스킬

## 훅 (자동화 지점)
- SessionStart: `scripts/obsidian-context.mjs` — 지식 색인 + MEMORY 예산 경고. 설정: `.claude/settings.local.json`
- "매번/자동으로 X 해줘" 류 반복 자동화는 기억·약속이 아니라 **훅으로 구현** (update-config 스킬 경유)

## 지식 4계층 (자동 운영)
CLAUDE.md=불변 규칙 / memory MEMORY.md=라이브 함정·진행작업 / wiki/=영속 합성(`/ingest` `/query`) / 옵시디언 색인=발견.
계약·졸업 규칙 전문: `wiki/AGENTS.md` §10. 세션 마무리 시 `/session-wrap`.

## 완료 게이트 (요약)
완료 주장 전 이 메시지 안에서 실행한 증거(테스트/빌드 출력) 필수. "될 것"·"통과할 듯" 금지. 전문: 전역 verification 규칙.
