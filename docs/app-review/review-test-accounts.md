# 앱 심사용 테스트 계정 안내 / App Review Test Accounts

> App Store Connect / Google Play Console 심사 제출 시 이 문서의 **시나리오**를 "심사 메모(App Review Information)"란에 첨부.
> 비밀번호는 이 문서에 적지 않는다 — 아래 [🔐 비밀번호 취급 규칙](#-비밀번호-취급-규칙) 참조.
> When submitting to App Store Connect / Google Play Console, paste the **scenarios** below into the "App Review Information" / "Reviewer notes" field.
> Passwords are deliberately absent from this file — see [Password handling](#-비밀번호-취급-규칙).

---

## 🔐 비밀번호 취급 규칙

**이 레포는 PUBLIC 이다.** 심사 계정은 prod 에 실재하므로 평문 비밀번호를 여기에 두면 곧바로 계정 탈취 경로가 된다.

- 2026-08-07 사고: 시드 마이그레이션에 평문으로 적힌 비밀번호가 prod `review-admin`(`app_metadata.role=admin`)에 실제로 일치했고,
  admin 은 `permanently_delete_user` 로 임의 계정을 삭제할 수 있었다. 상세: PR #427 (`732c300a5`).
- 그 뒤 **`review-*` 4계정 비밀번호를 회전**하고 세션 93건·refresh token 108건을 파기했다.
- **현재 비밀번호의 진실원은 App Store Connect 심사 노트와 레포 밖 비밀번호 보관소다.** 레포 어디에도 두지 않는다.
- 원격(prod)을 겨냥해 E2E 를 돌릴 때만 `E2E_TEST_ACCOUNT_PASSWORD` 환경변수로 주입한다
  (`uniqn-mobile/e2e/.env.test`, gitignore). 주입하지 않으면 `e2e/config.ts` 가 안전 정지시킨다.
- 🔴 **비밀번호를 회전할 때마다 App Store Connect 심사 노트를 같이 갱신할 것.** 안 하면 다음 심사가 로그인 실패로 반려된다.

---

## 한국어

### 계정 정보

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 스태프 | review-staff@uniqn.app | (레포 밖 보관 — 위 규칙 참조) |
| 구인자 | review-employer@uniqn.app | (레포 밖 보관) |
| 관리자 | review-admin@uniqn.app | (레포 밖 보관) |

### 데모 시나리오

**1) 스태프 (review-staff@uniqn.app)**
1. 로그인 → 홈 화면에서 "강남 포커룸 주말 스태프" 공고 확인
2. 공고 상세 → "지원하기"
3. 마이페이지 → "내 지원" 탭에서 확정/대기 상태 확인 (분당 공고: 확정, 강남 공고: 대기)
4. 게시판 탭 → "포커룸 첫 출근 후기" 글에 댓글 작성

**2) 구인자 (review-employer@uniqn.app)**
1. 로그인 → 공고 관리에서 모집중 공고 2개 확인
2. "강남 포커룸 주말 스태프" 공고 → 지원자 목록에서 신청 확인/거절
3. 정산 탭 → 4일 전 근무 1건의 정산 내역 확인
4. 공고 작성 → 템플릿 "주말 스태프 모집 템플릿" 불러오기

**3) 관리자 (review-admin@uniqn.app)**
1. 로그인 → 관리자 대시보드 진입
2. "신규 employer 신청" 알림 → 심사용 신청자 승인/거절
3. 통계 → 전체 공고/지원/근무 카운트 확인

### 주의 사항
- 모든 데이터는 데모용이며 실제 결제/정산은 발생하지 않음
- 테스트 결제는 Apple/Google 샌드박스 계정이 필요 (해당 시)
- 시간 기반 데이터(공고 일정, 근무 기록)는 마이그레이션 적용 시점부터 동적 계산되므로 항상 신선한 상태

---

## English

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Staff | review-staff@uniqn.app | (stored outside this repo) |
| Employer | review-employer@uniqn.app | (stored outside this repo) |
| Admin | review-admin@uniqn.app | (stored outside this repo) |

> This repository is public. Passwords live only in App Store Connect review notes and an
> out-of-repo password store. See the Korean section above for the full rationale.

### Demo Scenarios

**1) Staff (review-staff@uniqn.app)**
1. Sign in → check the "강남 포커룸 주말 스태프" job posting on the home screen
2. Posting detail → tap "Apply"
3. My Page → "My Applications" tab → check confirmed/pending status (Bundang posting: confirmed, Gangnam posting: pending)
4. Board tab → leave a comment on the post "포커룸 첫 출근 후기"

**2) Employer (review-employer@uniqn.app)**
1. Sign in → "Postings" tab → check 2 active postings
2. "강남 포커룸 주말 스태프" → applicant list → approve/reject
3. "Payroll" tab → check 1 settlement record from 4 days ago
4. Create new posting → load "주말 스태프 모집 템플릿"

**3) Admin (review-admin@uniqn.app)**
1. Sign in → enter admin dashboard
2. "New employer application" notification → approve/reject the applicant
3. Stats → check total counts of postings/applications/work logs

### Notes
- All data is for demo purposes; no real payment or settlement occurs
- Test payments require Apple/Google sandbox accounts (if applicable)
- Time-based data (posting schedules, work logs) is dynamically calculated from migration apply time, so it's always fresh

---

## 메타정보 / Metadata

- 데모 데이터 시드 마이그레이션: `uniqn-mobile/supabase/migrations/20260710000004_baseline_data_seed.sql`
  (§3 심사 계정 3종 · §5 AD-001 미인증 구인자 · §6 협업자. 구 파일들은 `migrations/archive/` 로 이동됐다)
- 마이그레이션 재적용으로 데이터 복구 가능 (`ON CONFLICT DO NOTHING` 멱등)
- 비밀번호 정기 로테이션 권장 (분기 1회) — 회전 시 App Store Connect 심사 노트 동시 갱신 필수

### 시드가 만드는 계정 전체 (5개 — prod 에도 실재)

| 이메일 | app_metadata.role | 시드 위치 | 2026-08-07 회전 |
|---|---|---|---|
| `review-staff@uniqn.app` | staff | §3 | ✅ |
| `review-employer@uniqn.app` | employer | §3 | ✅ |
| `review-admin@uniqn.app` | admin | §3 | ✅ |
| `review-collaborator@uniqn.app` | employer | §6 | ✅ |
| `pending-employer-staff@uniqn.app` | staff | §5 (AD-001) | 🔴 **미회전** |

> ⚠️ `pending-employer-staff@uniqn.app` 는 이름이 `review-` 로 시작하지 않아 2026-08-07 회전 대상에서
> 누락됐다. 2026-08-07 prod 실측 기준 여전히 시드 평문 비밀번호와 일치한다.
> 권한은 `staff` 라 `permanently_delete_user` 경로는 없고 로그인 이력·세션·refresh token 은 0 건이다.
> **회전 스크립트를 다시 돌릴 때 `review-%` 패턴이 아니라 위 5개 이메일 목록을 기준으로 할 것.**

### 공고 `schedule` jsonb shape 주의

`job_postings.schedule`는 앱이 `serializeJobPostingV3` (src/domains/job-posting/serialization.ts) 로 직렬화한 정확한 shape이어야 일별 탭 필터에 공고가 나타남:

```json
{
  "kind": "dated",
  "primaryDate": "YYYY-MM-DD",
  "allDates": ["YYYY-MM-DD", ...],
  "requirements": [
    {
      "date": "YYYY-MM-DD",
      "timeSlots": [
        {
          "startTime": "HH:MM",
          "roles": [{ "role": "dealer|floor|...", "count": N, "filled": 0 }]
        }
      ]
    }
  ]
}
```

- `requirements[].date`가 비어 있으면 `matchesPostingDate()` (src/domains/job-posting/projections.ts) 가 항상 false 반환 → 일별 탭에 안 보임.
- 수동 INSERT 시 `work_dates` text[] 배열도 `requirements[].date` 와 동일하게 유지해야 DB 레벨 필터도 동작.
