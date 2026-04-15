# UNIQN QA Audit — 최종 종료 회고

> 기간: 2026-04-14 ~ 2026-04-15
> 총 7 wave / 21 PR (#17~#31 + chore/wave6-3-final) / Phase 0 10/10 해결
> 상태: **공식 종료** (T-E6 + T-D2 CI 검증은 Sprint 4 백로그)

---

## 1. 타임라인

| Wave | 날짜 | PR | 핵심 작업 |
|------|------|----|----------|
| W0 (Phase 0) | 2026-04-14 | - | 5팀 병렬 분석, 사용자 10개 주장 100% 사실 확인, 23개 발견사항 정의 |
| W1 (Quick Wins) | 2026-04-14 | #17 | T-C1/C2/C3 — EventQR 컬럼, Admin lastLoginAt, templateService Firebase 잔재 제거 |
| W2 (RPC 회수) | 2026-04-14 | #19~#22 | T-A1~A4 — confirm/cancel/QR/stats RPC 회수 + Edge Functions 회수 |
| W3 (RLS 강화) | 2026-04-14 | #19 | T-E1/E2 — Announcements targetAudience RLS DB 강제, 클라이언트 필터 제거 |
| W4 (원자성 RPC) | 2026-04-14 | #25 | T-B1~B6 — cancel_application_atomically + process_qr_checkin_atomically 신규 RPC + 클라이언트 교체 |
| W5 (테스트 + outbox) | 2026-04-14 | #26~#29 | T-B7~B10 outbox 패턴, T-D1~D10 e2e 스펙 재작성 30+, Firebase 완전 제거 |
| W6.1~W6.2 (보안 마무리) | 2026-04-15 | #30~#31 | T-E3 XSS, T-E4 is_active 가드, T-E5 payroll 트리거, observability |
| W6.3 (최종 종료) | 2026-04-15 | wave6-3 | T-D2 Docker Supabase 인프라 구축, INDEX.md 완료 마킹, 회고 문서 |

---

## 2. 최종 지표

| 지표 | 값 |
|------|----|
| PR 머지 수 | 21개 (#17 ~ #31 + wave6-3) |
| 신규 Supabase 마이그레이션 | 12개 |
| 신규 Edge Functions 회수/생성 | 6개 |
| 신규/재작성 테스트 (단위+통합+e2e) | 30+ |
| Phase 0 주장 해결 | 10/10 (100%) |
| 발견사항 해결 | 22/23 (96%) |
| P0 완료 | 12/12 |
| P1 완료 | 7/7 |
| P2 완료 | 3/4 (T-E6 백로그) |
| Docker Supabase 인프라 | config.toml + seed.sql + base schema 1000줄 완성 |
| CI 상태 (master) | Green |

---

## 3. 배운 것

### 3.1 Worktree 절대 경로 함정 (★ 가장 중요)
Wave 5 PR #28에서 병렬 worktree 에이전트가 `jest.mock`/`require` 경로에 `C:/Users/user/Desktop/T-HOLDEM-w*/` 같은 로컬 절대 경로를 하드코딩. 로컬에서는 통과했지만 CI Linux에서 실패.
- **교훈**: 병렬 에이전트 dispatch 프롬프트에 반드시 `@/` alias 또는 상대 경로 강제 문구 추가.
- **대책**: push 전 `git diff | grep -E 'C:/Users|T-HOLDEM-w'` 스캔 필수화.

### 3.2 Red master 위에 작업 쌓기 위험성
Wave 3~4에서 master가 일시적으로 red 상태인 동안 파생 브랜치들이 쌓임. 머지 순서와 CI 체인이 꼬여 cleanup PR이 필요했음.
- **교훈**: master가 red일 때 non-trivial 브랜치 생성 금지. 빠른 hotfix 우선.

### 3.3 Agent 병렬 디스패치 + pattern doc 선행의 효과
5팀 병렬 분석(W0)에서 먼저 패턴 문서를 작성하고 에이전트에게 참조시켰을 때 결과물 일관성이 크게 향상. 에이전트에게 codebase 컨텍스트를 주는 것보다 "무엇을 찾아야 하는지"를 명확히 하는 것이 더 효과적.

### 3.4 pg_get_functiondef로 기존 RPC 안전 병합
T-A1~A4에서 production에 적용된 RPC 정의를 `pg_get_functiondef()`로 추출 후 마이그레이션 파일로 저장. 원본 로직 손실 없이 회수 성공. base schema 추출에도 동일 접근 적용 가능.

### 3.5 Supabase 마이그레이션 이력 불일치의 잠재적 위험
production `schema_migrations`에는 57개 레코드가 있는데 로컬 `migrations/` 폴더에는 27개만 있었음. 초기 base schema 마이그레이션들이 production에만 적용되고 repo에 커밋되지 않은 상태. Docker Supabase 도입 과정에서 이 불일치가 드러남.
- **교훈**: Supabase 프로젝트 설정 시 모든 마이그레이션을 반드시 repo에 커밋. `supabase db pull`로 초기 상태 캡처 필수.

---

## 4. 잔여 백로그 (Sprint 4)

### 4.1 T-E6 — RPC rate limiting (P2)
- 상태: Skip (W6.3 Decision 3=D)
- 내용: 고위험 RPC (confirm_application, cancel_application_atomically 등)에 토큰 버킷 방식 속도 제한
- 참조: `docs/qa/2026-04-14/EXECUTION-PLAN.md §6 T-E6`
- 추정 사이즈: L

### 4.2 T-D2 CI 검증 — Docker Supabase 첫 실행 (P1)
- 상태: 인프라 완성, CI 검증 미완
- 완성된 것: `config.toml`, `seed.sql`, `20260409000000_base_schema.sql` (1000줄), `e2e.yml` Docker 전환
- 남은 것: CI에서 `supabase start` → seed 적용 → e2e 실행 3회 연속 녹색 확인 → `continue-on-error: true` 제거
- 잠재 이슈: base schema의 함수 정의 누락 (incremental migrations 이전 auth RPCs 등)
- 추정 사이즈: M (디버깅 포함 1~2일)

### 4.3 T-A5 — 토너먼트 Edge Function (P2)
- approve-job-posting, reject-job-posting, resubmit-job-posting
- 별도 분석 필요

---

## 5. 다음 sprint 권장사항

1. **T-D2 CI 검증 우선**: 첫 PR에서 Docker Supabase CI 로그 확인 → base schema 오류 있으면 즉시 패치
2. **T-E6 타이밍**: rate limit 첫 도입은 보수적으로 (1분 10회 / 1시간 100회), 프로덕션 데이터 보고 조정
3. **마이그레이션 동기화**: production과 repo의 migration 이력 갭을 `supabase db pull`로 해소하여 재발 방지
4. **e2e 커버리지**: Docker Supabase 안정화 후 WF-03 (프로필 완성), WF-13 (리뷰) e2e 추가

---

*7 wave, 2026-04-14~2026-04-15, UNIQN QA Audit 공식 종료.*
