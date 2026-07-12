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
| 세션 마무리 | `/session-wrap` | 문서/패턴/학습/후속 4병렬 탐지 |
| 메모리 감사 | `/memory-audit` | 월 1회 — claim 실존 검증 |

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
| "세션 정리해줘" / 작업 마무리 | `/session-wrap` |

에이전트 분담·병렬 디스패치·모델 3계층 라우팅·훅 규칙은 `.claude/rules/orchestration.md` 참조. 스킬이 서브에이전트를 디스패치할 때도 모델 라우팅(읽기=haiku/sonnet·구현=opus·판정=fable) 준수.

## 스킬/MCP 정리 이력 (2026-07-12)
- **무관 스킬 8종 아카이브**: ios-clean/ios-design-review/ios-fix/ios-qa/ios-sync(네이티브 Xcode용, 이 프로젝트는 Expo RN)·cache-components(Next.js)·devex-review·frontend-code-review(범용, /review와 중복) → `~/.claude/skills-archive/`. 복원=디렉토리를 `~/.claude/skills/`로 이동.
- **MCP 제거**: revenuecat(수익모델 설계 P6=RevenueCat 재도입 안함)·tosspayments(PortOne 채택) — `.mcp.json`·전역 `mcp-config.json`. 유지: context7·playwright·supabase·mcp-installer.
- **중복 7종은 의도적 오버라이드**(autoplan·cso·guard·health·investigate·retro·review) — 프로젝트 버전이 우선(위 우선순위 규칙). 삭제 금지.
