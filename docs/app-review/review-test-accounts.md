# 앱 심사용 테스트 계정 안내 / App Review Test Accounts

> App Store Connect / Google Play Console 심사 제출 시 이 문서의 정보를 "심사 메모(App Review Information)"란에 첨부.
> When submitting to App Store Connect / Google Play Console, paste the information below into the "App Review Information" / "Reviewer notes" field.

---

## 한국어

### 계정 정보

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 스태프 | review-staff@uniqn.app | Review2026! |
| 구인자 | review-employer@uniqn.app | Review2026! |
| 관리자 | review-admin@uniqn.app | Review2026! |

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
| Staff | review-staff@uniqn.app | Review2026! |
| Employer | review-employer@uniqn.app | Review2026! |
| Admin | review-admin@uniqn.app | Review2026! |

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

- 데모 데이터 시드 마이그레이션: `uniqn-mobile/supabase/migrations/20260419031905_seed_app_review_accounts.sql`
- 마이그레이션 재적용으로 데이터 복구 가능 (멱등성 보장)
- 비밀번호 정기 로테이션 권장 (분기 1회)

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
