# 앱 심사용 테스트 계정 + 데모 데이터 설계

> 작성일: 2026-04-19
> 목적: App Store / Google Play 심사 제출용 데모 계정 3종(staff/employer/admin)과 핵심 기능 데모 데이터를 단일 마이그레이션으로 시드한다.

---

## 1. 배경 / 목표

- 기존 `qa-staff/employer/admin@uniqn.test` 계정은 E2E 테스트와 데이터를 공유하므로, 심사 중 테스트 실행 시 데이터가 변할 위험이 있다.
- 심사관 입장에서는 로그인 직후 핵심 기능을 한 번에 둘러볼 수 있어야 한다(공고 → 지원 → 근무 → 정산 → 게시판 → 알림).
- 별도 심사 전용 계정을 만들고, **표준 범위**의 데모 데이터를 함께 시드한다.

---

## 2. 계정 정의 (3종)

| 역할 | 이메일 | 비밀번호 | 표시명 | 비고 |
|------|--------|----------|--------|------|
| staff | `review-staff@uniqn.app` | `Review2026!` | 심사용 스태프 | 지원/근무/게시판 데모 |
| employer | `review-employer@uniqn.app` | `Review2026!` | 심사용 구인자 | 공고/지원관리/정산 데모 |
| admin | `review-admin@uniqn.app` | `Review2026!` | 심사용 관리자 | 전체 권한 데모 |

### 선택 근거
- **`@uniqn.app` 도메인** — 자사 도메인이라 심사 통과 안정적(`.test` TLD는 일부 심사관이 reject한 사례 있음). 실제 inbox 없어도 OK — 가입 흐름이 이메일 인증 OFF.
- **비밀번호 `Review2026!`** — 대소문자/숫자/특수문자 포함, 12자 미만, 심사관 입력 편의.
- **`review-` prefix** — E2E의 `qa-` 계정과 명확히 구분, 정리 스크립트가 실수로 건드리지 않음.
- **`auth.users` + `auth.identities` 동시 INSERT** — 메모리 기록(qa-employer 사례) 반영. provider 레코드 누락 시 로그인 불가.

---

## 3. 데모 데이터 범위 (표준)

> 모든 시간 기반 데이터는 `NOW() + interval` 동적 계산 → 마이그레이션 적용 시점부터 N일 기준이라 심사 시점이 늦어져도 데이터가 신선함.

### 3.1 Job Postings (employer 소유) — 3건
| 공고 제목 | 상태 | 일정 | 모집 |
|-----------|------|------|------|
| 강남 포커룸 주말 스태프 | active(모집중) | NOW + 7일~14일 | 3명 |
| 분당 포커룸 평일 딜러 | active(마감임박) | NOW + 2일~5일 | 2명 |
| 홍대 포커룸 단기 알바 | closed | NOW − 14일~7일 | 마감 완료 |

### 3.2 Applications — 2건 (staff → employer 공고)
- 공고1에 `pending` (지원 완료, 대기중)
- 공고2에 `confirmed` (확정) → 트리거가 work_log 자동 생성

### 3.3 Work Logs — 2건
- 과거 1건: `checked_out` (완료) — payroll trigger로 정산 자동 생성
- 미래 1건: `scheduled` (예정) — QR 체크인 데모용

### 3.4 Board Posts — 2건 + 댓글 4건
- staff 작성: "포커룸 첫 출근 후기" + 댓글 2개
- employer 작성: "강남 포커룸 정기 채용" + 댓글 2개

### 3.5 Notifications — 각 계정 3건씩 (총 9건)
- staff: 지원 확정 / 새 공고 / 게시판 댓글
- employer: 새 지원자 / 근무 완료 / 정산 생성
- admin: 신규 employer 신청 / 시스템 알림 (2건)

### 3.6 Templates — 1건
- employer 소유: "주말 스태프 모집 템플릿"

### 3.7 Employer Application — 1건
- admin 데모용: 다른 신규 사용자 1명이 employer 신청 `pending` 상태 → admin이 승인/거절 데모 가능

---

## 4. 구현 방식

### 4.1 파일 구조
```
uniqn-mobile/supabase/migrations/
└── 20260419HHMMSS_seed_app_review_accounts.sql   ← 신규
```
> 기존 `20260416160000_seed_existing_employers.sql` 패턴 준수.

### 4.2 마이그레이션 4부 구조

**Part 1 — auth 계층**
```sql
-- auth.users 3건 (고정 UUID, 멱등성)
-- encrypted_password = crypt('Review2026!', gen_salt('bf'))
-- email_confirmed_at = NOW() (이메일 인증 우회)
-- raw_app_meta_data: { provider: 'email', role: '<role>' }
-- ON CONFLICT (id) DO NOTHING

-- auth.identities 3건 (provider='email')
-- ON CONFLICT (provider, provider_id) DO NOTHING
```

**Part 2 — public.users 프로필**
```sql
-- public.users 3건 (role, name, phone_number)
-- 트리거 handle_new_user가 자동 생성하지만, 이름/전화 갱신 위해 UPSERT
```

**Part 3 — 데모 데이터**
```sql
-- 모든 ID는 deterministic UUID (gen_random_uuid 대신 명시 UUID)
-- 순서: job_postings → applications → work_logs → board_posts → comments
--       → notifications → templates → employer_applications
-- payroll/work_log은 트리거 자동 생성에 의존
```

**Part 4 — 멱등성**
```sql
-- 모든 INSERT에 ON CONFLICT (id) DO NOTHING 적용
-- 재실행 시 에러 없이 통과
```

### 4.3 적용 방법
```
mcp__supabase__apply_migration name=seed_app_review_accounts query=<...>
```
> `supabase db push` 금지 (메모리 룰: Supabase 마이그레이션은 MCP apply_migration 전용).

### 4.4 검증
- 신규 스크립트 X
- 기존 `e2e/scripts/seedSupabase.ts`의 `SUPABASE_QA_ACCOUNTS` 배열에 `review-*` 3개 추가 (선택)
- 또는 수동: 3개 계정 로그인 + 데모 데이터 카운트 확인

### 4.5 롤백
- 별도 마이그레이션 X — 마이그레이션 하단 주석으로 수동 SQL 첨부
```sql
-- ROLLBACK (수동 실행용):
-- DELETE FROM auth.users WHERE id IN (
--   '<staff-uuid>', '<employer-uuid>', '<admin-uuid>'
-- );
-- CASCADE로 public.users, applications, work_logs 등 자동 정리
```

---

## 5. 심사 제출용 산출물

### 5.1 별도 문서 1개
**경로**: `docs/app-review/review-test-accounts.md`

**포함 내용**:
1. 3개 계정 정보 (이메일/비밀번호 표)
2. 각 역할별 데모 시나리오 (3~5단계 클릭 가이드)
   - staff: 로그인 → 공고 검색 → 지원 → 게시판 댓글
   - employer: 로그인 → 공고 작성 → 지원자 확인 → 정산
   - admin: 로그인 → 신규 employer 신청 승인 → 통계
3. App Store Connect / Google Play Console **심사 메모**란 복붙용 **영문 버전**

### 5.2 심사 메모 위치
- **App Store Connect**: App Information → App Review Information → Sign-in required: ON → Demo Account
- **Google Play Console**: App content → App access → Provide instructions

---

## 6. 위험 / 고려사항

| 위험 | 완화 |
|------|------|
| 트리거(work_log/payroll/notification)가 시드 데이터에 중복 발화 | `ON CONFLICT DO NOTHING` + 트리거 자동 생성 데이터는 시드에서 제외 |
| 심사 후 계정 노출 → 무단 사용 | 비밀번호 정기 로테이션(분기 1회) 또는 심사 통과 후 비활성화 절차 문서화 |
| `@uniqn.app` 도메인 inbox 부재 → 비밀번호 재설정 불가 | 심사용은 비밀번호 재설정 불필요. 만약 잠기면 마이그레이션 재실행으로 복구 |
| 마이그레이션 재실행 시 데이터 변형(예: 공고 마감일 갱신) | 시간 기반 데이터는 `INSERT ... ON CONFLICT DO UPDATE SET expires_at = ...`로 갱신할지 결정 필요 (현재 설계는 DO NOTHING — 첫 시드 시점 기준 고정) |

---

## 7. 완료 조건

- [ ] 마이그레이션 파일 1개 생성 + MCP apply 성공
- [ ] 3개 계정 로그인 성공 (검증 스크립트 또는 수동)
- [ ] 데모 데이터 7종 모두 카운트 확인 (공고 3 / 지원 2 / 근무 2 / 게시글 2 / 댓글 4 / 알림 9 / 템플릿 1 / employer_application 1)
- [ ] `docs/app-review/review-test-accounts.md` 작성 (한/영)
- [ ] 마이그레이션 + 문서 커밋
