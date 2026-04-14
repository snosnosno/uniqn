# UNIQN 종합 검증 & 5팀 병렬 분석 — 인덱스

> 작성일: 2026-04-14
> 출발점: 사용자가 작성한 19개 워크플로우 분석 + 10개 고위험 공백
> 산출물: 본 디렉토리 (`docs/qa/2026-04-14/`)
> 플랜 원본: `C:\Users\user\.claude\plans\tranquil-bouncing-acorn.md`

---

## 0. 문서 구성

| 파일 | 내용 | 상태 |
|------|------|------|
| `INDEX.md` (본 문서) | Phase 0 검증 + 전체 요약 + 우선순위 매트릭스 + cross-ref | ✅ |
| `team-a-server-contracts.md` | 18개 미정의 RPC/Edge Function 카탈로그 + 회수/스펙 | ✅ |
| `team-b-atomicity-spec.md` | 비원자 흐름 부분 실패 매트릭스 + 3개 RPC SQL 스펙 + outbox 패턴 | ✅ |
| `team-c-bug-inventory.md` | 컬럼 불일치/Firebase 잔재/snake_case 누수 sweep + P0 quick win 3건 | ✅ |
| `team-d-coverage-matrix.md` | 19 워크플로우 × 228 테스트 자산 매트릭스 + Top 10 P0 미커버 | ✅ |
| `team-e-security-rls.md` | 27 테이블 RLS 매트릭스 + JWT 일관성 + STRIDE + P0 1건 | ✅ |
| `EXECUTION-PLAN.md` | P0/P1/P2 task 분해 + 의존성 + 검증 명령 + 사이즈 추정 | ✅ |

---

## 1. Phase 0 — 사용자 주장 검증 (이번 세션 시작 시)

3개 Explore 에이전트로 사용자 10개 고위험 공백을 모두 코드 검증. **10/10 사실 확인.**

| # | 주장 | 결과 | 핵심 근거 |
|---|------|------|----------|
| 1 | RPC/Edge 다수 미정의 | ✅ | 15+ 호출 중 14+ 미정의 (Team A는 18개로 확장) |
| 2 | confirm 흐름 원자적 | ✅ | `ApplicationRepositoryTransactions.ts:116` 단일 RPC |
| 3 | 취소 승인/확정 취소 비원자적 | ✅ | 동 218-303, 475-541 — 3 client ops |
| 4 | QR 출퇴근 비트랜잭션 | ✅ | `WorkLogRepositoryTransactions.ts:185-348` — read/validate/update 분리 |
| 5 | board sync swallow | ✅ | `jobManagementService.ts:20-33` |
| 6 | EventQR 컬럼 불일치 | ✅ | `EventQRRepository.ts:28` — assignmentGroupId/timeSlot 누락 |
| 7 | last_login_at 누락 | ✅ | `AdminRepository.ts:37` |
| 8 | templateService Firebase 잔재 | ✅ | `templateService.ts:29-31` |
| 9 | e2e Firebase 의존 | ✅ | 9/79 파일 |
| 10 | 공지 클라이언트 필터 | ✅ | `AnnouncementRepository.ts:145-153` + RLS 미강제 |

---

## 2. 사용자 정의 19 워크플로우

| ID | 워크플로우 | 우선순위 |
|----|-----------|---------|
| WF-01 | 앱 진입/세션 복원 | P0 |
| WF-02 | 인증/가입 | P0 |
| WF-03 | 프로필 완성 | P1 |
| WF-04 | 구인자 전환 | P0 |
| WF-05 | 공고 탐색 | P1 |
| WF-06 | 지원 | P0 |
| WF-07 | 지원자 관리/확정 | P0 |
| WF-08 | 취소 라이프사이클 | P0 |
| WF-09 | 스케줄 (파생 뷰) | P1 |
| WF-10 | QR 출퇴근 | P0 |
| WF-11 | 정산 | P0 |
| WF-12 | 알림 | P1 |
| WF-13 | 리뷰 | P1 |
| WF-14 | 커뮤니티/일정게시판 | P2 |
| WF-15 | 고객센터 | P1 |
| WF-16 | 공지 | P0 |
| WF-17 | 관리자 | P0 |
| WF-18 | 설정/탈퇴/내 데이터 | P1 |
| WF-19 | 템플릿/오프라인/복구 | P2 |

---

## 3. 정합성 핵심 규칙 (사용자 정의)

- `applications ↔ job_postings ↔ work_logs` 확정 시 세 개가 같이 움직여야 함
- `schedules`는 파생 뷰
- `users.role ↔ auth metadata role ↔ route guard ↔ RLS`는 한 축
- `notifications ↔ notification_counters`는 eventual consistency
- `permanently_delete_user`는 다수 테이블 익명화 + 소유 공고 종료 연쇄

---

## 4. 5팀 발견사항 통합 매트릭스

| 발견 | Team | 우선순위 | 영향 워크플로우 | 핵심 영향 파일 | EXECUTION-PLAN task |
|------|------|---------|-----------------|----------------|---------------------|
| 14+ Edge/RPC 미정의 (confirm_application, register_as_employer 등) | A | P0 | WF-02, WF-04, WF-06, WF-07 | 14+ 호출 site | T-A1~A8 |
| `cancel_application_atomically` 부재 → 부분 실패 시 capacity 깨짐 | B | P0 | WF-08 | `ApplicationRepositoryTransactions.ts:218-303,475-541` | T-B1~B3 |
| `process_qr_checkin_atomically` 부재 | B | P0 | WF-10 | `WorkLogRepositoryTransactions.ts:185-348` | T-B4~B6 |
| board sync 실패 silently swallow | B | P1 | WF-09, WF-14 | `jobManagementService.ts:20-111` | T-B7~B10 |
| Announcements RLS targetAudience 미강제 | E | P0 | WF-16 | `AnnouncementRepository.ts:145-153` + announcements_rls.sql | T-E1, T-E2 |
| EventQR scope 컬럼 누락 | C | P0 | WF-10 | `EventQRRepository.ts:28` | T-C1 |
| Admin last_login_at 누락 | C | P0 | WF-17 | `AdminRepository.ts:37` | T-C2 |
| templateService dead Firebase 분기 | C | P0 | WF-19 | `templateService.ts:29-31` | T-C3 |
| notification.schema XSS 누락 | E | P1 | WF-12 | `notification.schema.ts:53-62` | T-E3 |
| is_active 강제 부재 | E | P1 | WF-01, WF-04 | users RLS, critical RPC | T-E4 |
| revoke-apple-token Edge Function 부재 | A | P0 | WF-18 | `accountDeletionService.ts:54` | T-A2 |
| e2e 6/32 Firebase 차단 | C/D | P1 | WF-02, WF-05~07, WF-10~12 | `e2e/global-setup.ts` 외 | T-D1~D3 |
| WF-08 취소 e2e 0건 | D | P0 | WF-08 | - | T-D4 |
| WF-18 deletion grace e2e 0건 | D | P0 | WF-18 | - | T-D5 |
| WF-06 capacity race 미검증 | D | P0 | WF-06 | - | T-D6 |
| work_logs payroll 컬럼 raw update 위험 | E | P2 | WF-11 | `WorkLogRepository*.ts` | T-E5 |
| RPC rate limiting 부재 | E | P2 | WF-06, WF-15 | - | T-E6 |
| swallow 패턴 monitoring 부재 | C | P2 | WF-09, WF-12, WF-19 | 다수 | T-C4 |

---

## 5. 19 워크플로우 × 발견사항 교차 인덱스

| WF | 우선순위 | 영향 발견사항 | EXECUTION task |
|----|---------|---------------|----------------|
| WF-01 | P0 | is_active 강제 부재 | T-E4 |
| WF-02 | P0 | check_email/nickname/phone RPC 부재, e2e Firebase 차단 | T-A1, T-D2 |
| WF-03 | P1 | (없음 — Team C/E 결과 추가 sweep 필요) | - |
| WF-04 | P0 | register_as_employer RPC 부재, JWT/RLS sync timing | T-A2, T-D7 |
| WF-05 | P1 | get_job_posting_stats 부재, e2e Firebase 차단 | T-A4, T-D2 |
| WF-06 | P0 | confirm 흐름 의존, capacity race 미검증, e2e 차단 | T-A1, T-D6, T-D2 |
| WF-07 | P0 | **confirm_application RPC 부재**, 매니지먼트 e2e | T-A1, T-D8 |
| WF-08 | P0 | **취소 비원자**, e2e 0건 | T-B1, T-D4 |
| WF-09 | P1 | board sync swallow | T-B7 |
| WF-10 | P0 | **QR 비트랜잭션**, EventQR 컬럼 누락, e2e 차단 | T-B4, T-C1, T-D2 |
| WF-11 | P0 | bulk rollback 미검증, payroll 컬럼 위험 | T-D9, T-E5 |
| WF-12 | P1 | unread counter Edge Function 부재, schema XSS 누락 | T-A3, T-E3 |
| WF-13 | P1 | (없음 critical) | - |
| WF-14 | P2 | board sync swallow | T-B7 |
| WF-15 | P1 | (없음 critical) | - |
| WF-16 | P0 | **Announcement RLS 미강제** | T-E1, T-E2 |
| WF-17 | P0 | **last_login_at 누락**, 신고 처리 e2e | T-C2, T-D10 |
| WF-18 | P1 | revoke-apple-token 부재, deletion grace e2e 0건 | T-A2, T-D5 |
| WF-19 | P2 | **templateService Firebase 분기**, increment_template_usage 부재 | T-C3, T-A6 |

---

## 6. 발견사항 우선순위 요약

| 우선순위 | 개수 | 즉시 가능 | RPC/SQL 작업 | 테스트 작업 |
|---------|------|----------|-------------|-------------|
| **P0** | 12 | 3 (T-C1, T-C2, T-C3) | 5 (T-A1, T-B1, T-B4, T-E1) | 4 (T-D4, T-D5, T-D6, T-D7) |
| **P1** | 7 | 2 | 2 | 3 |
| **P2** | 4 | 1 | 1 | 2 |
| **합계** | **23** | **6** | **8** | **9** |

---

## 7. Bottom Line

1. **사용자 분석은 정확** — 10/10 사실 확인. 추가 sweep으로 위험 발견사항 13개 확장 (총 23개).
2. **가장 시급한 5건**:
   - confirm_application RPC 회수 (T-A1) — WF-06, WF-07 핵심
   - cancel_application_atomically 신규 (T-B1) — WF-08
   - process_qr_checkin_atomically 신규 (T-B4) — WF-10
   - Announcement RLS 강화 (T-E1) — WF-16
   - 3개 1-line bug fix (T-C1/C2/C3) — 5분 작업
3. **차단 해제 필요**: e2e Firebase 이주 (T-D2) — WF-02/05/06/07/10/11/12 7개 워크플로우 모든 e2e 작성을 가로막음
4. **권장 진행 순서**: T-C → T-E1 → T-A → T-B → T-D2 → T-D 시나리오 → T-D 차단 해제 후 e2e

EXECUTION-PLAN.md가 task 단위 분해 + 의존성 그래프 + 검증 명령을 제공.
