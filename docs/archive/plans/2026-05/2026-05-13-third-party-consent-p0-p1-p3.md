# 개인정보 제3자 제공 동의 P0/P1/P3 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans 또는 superpowers:subagent-driven-development. Phase 별 체크박스(`- [ ]`)로 진행 추적.

**Goal:** 한국 개인정보보호법 §17 (제3자 제공) 분쟁 방어선 확보. 구인자가 구직자의 이름·연락처·프로필을 보는 행위에 대해 (1) 가입 시 별도 동의 (2) 지원 시점 1-tap 확인 (3) 구인자 서약서 의무 강화 3개 축을 단일 PR 로 출하.

**스코프 결정사항 (사전 확정):**
- **옵션 A 채택** — 기존 회원 재동의 모달 작업 제외. 현재 prod 회원은 테스트 계정만 존재하므로 신규 가입자/신규 지원자/신규 구인자 등록자만 신규 동의 흐름 적용.
- **타겟:** 신규 회원·신규 지원·신규 구인자 등록만 적용. 기존 row backfill 불필요.
- **DB 컬럼 nullable:** users / applications 양쪽 모두 NOT NULL 강제 대신 nullable 유지 → 기존 row 호환 + 신규 row 는 항상 채움.

**Architecture:** UNIQN 의 4-계층(Presentation → Hooks → Service → Repository → Supabase) 패턴을 그대로 따른다.

- **Legal source-of-truth:** `src/constants/legal/`. 약관/처리방침/서약서/마케팅/제3자 동의는 모두 이곳에서 정의. settings 화면·signup 모달·HTML 직접 수정 금지 (메모리 `project_legal_documents_single_source`).
- **Signup 흐름:** `SignupStepTerms` (Presentation) → `signUpTermsSchema` (Domain validation) → `authCoreService.completeSignup` / `socialLoginService.completeSocialSignup` (Service) → `UserRepository.create` (Repository) → `users` 테이블.
- **Apply 흐름:** `ApplicationForm` (Presentation) → `useApplications.submit` (Hook) → `ApplicationRepository.applyWithTransaction` (Repository) → `applications` 테이블 + assignments/preQA.
- **Employer-register 흐름:** 기존 `liabilityWaiver.ts` / `employerTerms.ts` 텍스트만 갱신 + version tag bump → `employer_agreements` jsonb 에 신규 버전 누적 (기존 구조 그대로).
- **마이그레이션 정책:** MCP `apply_migration` 전용 (메모리 `feedback_supabase_migration_workflow`). 파일명/레지스트리 timestamp 불일치는 무해. 마이그레이션 후 `mcp__supabase__generate_typescript_types` 로 `supabase.ts` 재생성.

**Tech Stack:** Supabase Postgres (RLS 영향 없음 — 컬럼 추가만), zod 스키마, react-hook-form + zodResolver, NativeWind, Expo Router. PostgREST `from('applications').insert` 패턴 (RPC 신규 필요 없음).

---

## File Structure

### 신규 파일

| 경로 | 책임 |
|---|---|
| `uniqn-mobile/src/constants/legal/thirdPartyConsent.ts` | 제3자 제공 동의 본문 (개보법 §17 4고지: 제공받는자/항목/목적/보유기간) + version 1.0 + 2026-05-13 시행 |
| `uniqn-mobile/supabase/migrations/20260516000000_third_party_consent_columns.sql` | users 3 컬럼 + applications 2 컬럼 (양쪽 nullable) |

### 수정 파일

| 경로 | 변경 핵심 |
|---|---|
| `uniqn-mobile/src/constants/legal/index.ts` | `THIRD_PARTY_CONSENT` export 추가 |
| `uniqn-mobile/src/constants/legal/privacyPolicy.ts` | 제4조 본문은 이미 있음 → version 1.1 → 1.2 bump, effectiveDate 2026-05-13. 4고지 항목 구체화 (제공받는자/항목/목적/보유기간 명시) |
| `uniqn-mobile/src/constants/legal/liabilityWaiver.ts` | 제6조 (신설) "구직자 개인정보 보호 의무" + version 1.1 → 1.2 bump + `LIABILITY_WAIVER_VERSION_TAG` `v4-` → `v5-` |
| `uniqn-mobile/src/constants/legal/employerTerms.ts` | 제3조 5호 (1줄) → 제7조 (별도 조항) 격상 + version 1.1 → 1.2 bump + `EMPLOYER_TERMS_VERSION_TAG` `v4-` → `v5-` |
| `uniqn-mobile/src/components/auth/signup/termsContent.ts` | `THIRD_PARTY_CONSENT` export 추가 |
| `uniqn-mobile/src/components/auth/signup/SignupStepTerms.tsx` | `TERMS` 배열에 4번째 항목 `thirdPartyAgreed` (required: true) 추가 |
| `uniqn-mobile/src/schemas/auth.schema.ts` | `signUpTermsSchema` 에 `thirdPartyAgreed: z.literal(true)` 추가 |
| `uniqn-mobile/src/services/auth/authTypes.ts` | `SignUpData` interface 에 `thirdPartyAgreed: boolean` 추가 |
| `uniqn-mobile/src/services/auth/authCoreService.ts` | `completeSignup` 에서 `thirdPartyAgreed: data.thirdPartyAgreed` 매핑 |
| `uniqn-mobile/src/services/auth/socialLoginService.ts` | `completeSocialSignup` 에서 동일 매핑 |
| `uniqn-mobile/src/services/auth/portOneIdentityService.ts` | 본인인증 재인증 mode 에서 `thirdPartyAgreed: true` 기본값 (재인증은 기존 동의 유지) |
| `uniqn-mobile/src/repositories/supabase/UserRepository.ts` | `create` 에 `third_party_agreed` / `third_party_agreed_at` / `third_party_agreed_version` 매핑 |
| `uniqn-mobile/src/types/application.ts` | `CreateApplicationInput` 에 `provisionConsentAt: string` (필수 — UI 에서 항상 채움) + `provisionConsentVersion: string` 추가 |
| `uniqn-mobile/src/components/jobs/ApplicationForm.tsx` | 제출 버튼 직전에 동의 체크박스 1개 + "이 공고 구인자에게 내 이름·연락처를 제공" 1줄 안내. 체크 안 되면 제출 disabled |
| `uniqn-mobile/app/(app)/jobs/[id]/apply.tsx` | `handleSubmit` 에서 `submitApplication` 호출 시 `provisionConsentAt: new Date().toISOString()` 전달 |
| `uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts` | `applyWithTransaction` 의 insert payload 에 `applicant_provision_consent_at` / `applicant_provision_consent_version` 추가 |
| `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts` | `APPLICATION_COLUMNS` 에 신규 컬럼 추가, `toApplication` 매핑 (선택 — 읽기 노출 필요 없으면 skip) |
| `uniqn-mobile/src/types/supabase.ts` | `mcp__supabase__generate_typescript_types` 로 재생성 (수동 편집 금지) |

### 검토만 (수정 없음)

| 경로 | 이유 |
|---|---|
| `uniqn-mobile/app/(app)/employer-register.tsx` | 이미 `LIABILITY_WAIVER_VERSION_TAG` / `EMPLOYER_TERMS_VERSION_TAG` import 해서 저장 → version bump 만으로 신규 구인자에게 자동 적용 |
| `uniqn-mobile/public/privacy.html` | source-of-truth 는 `privacyPolicy.ts` 이지만 정적 html 은 별도 생성된 사본. 메모리 `project_legal_documents_single_source` 에 따라 별도 build step 이 있는지 확인 후 결정 |

---

## 사전 작업 (Pre-Task)

### Pre-1: 브랜치 생성 + checkpoint

```bash
git checkout -b feat/third-party-consent-p0-p1-p3
git status
```

### Pre-2: privacy.html 동기화 메커니즘 확인

- [ ] `uniqn-mobile/public/privacy.html` 와 `privacyPolicy.ts` 가 어떻게 동기화되는지 확인 (수동 vs build script)
- [ ] 수동이면 Phase 5 에 "privacy.html 도 동일 본문으로 갱신" 단계 추가

### Pre-3: 기존 회원 영향 재확인

```sql
-- MCP execute_sql
SELECT role, is_active, count(*) FROM public.users GROUP BY 1, 2;
```

- [ ] 결과가 테스트 계정만 (대표/심사용/QA) 인지 확인
- [ ] 운영 계정이 있으면 plan 중단 후 옵션 B (재동의 모달) 추가 필요

---

## Phase 1: P3 — 구인자 서약서 + 이용약관 강화 (DB 영향 없음)

### 1.1 LIABILITY_WAIVER 제6조 신설

- [ ] `liabilityWaiver.ts` 에 제6조 추가:
  ```
  제6조 (구직자 개인정보 보호 의무)
  1. 구인자는 UNIQN 을 통해 받은 구직자 정보(이름, 연락처, 프로필 등)를
     해당 공고의 채용·근무 관리 목적으로만 사용한다.
  2. 다음 행위를 금지한다:
     - 다른 업체·개인에게 재제공·재판매
     - 마케팅·홍보·다른 공고 홍보 목적 사용
     - 채용 종료 후 3개월 이상 보관
  3. 위반 사실이 확인되면 회사는 사전 통지 없이 구인자 계정을 정지할 수 있으며,
     구직자에 대한 손해배상 책임은 위반한 구인자가 부담한다.
  4. 구직자로부터 정보 열람·정정·삭제 요청을 받은 경우 지체없이 응하고,
     채용 종료 후 3개월 이내에 자체 보관한 정보를 파기한다.
  ```
- [ ] `version: '1.1'` → `'1.2'`
- [ ] `publishDate` / `effectiveDate` `2026-04-10` → `2026-05-13`
- [ ] `LIABILITY_WAIVER_VERSION_TAG` 의 prefix `v4-` → `v5-`

### 1.2 EMPLOYER_TERMS 제3조 5호 격상

- [ ] 제3조 5호 (한 줄) 제거
- [ ] 제7조 (신설) 추가:
  ```
  제7조 (구직자 개인정보 보호)
  1. 구인자는 UNIQN 을 통해 제공받은 구직자 개인정보를
     해당 공고 채용·근무 관리 목적으로만 처리한다.
  2. 보유 기간은 채용 종료 후 최대 3개월이며,
     이후 자체 보관 정보는 모두 파기한다.
  3. 제3자에 대한 재제공, 마케팅 활용, 다른 공고 홍보 등 목적 외 이용은 금지된다.
  4. 위반 시 서비스 이용 제한 및 관련 법령(개인정보보호법 §17 등)에 따른 책임을 진다.
  ```
- [ ] 기존 제4조~제6조 번호 유지 (제7조는 마지막에 추가)
- [ ] `version: '1.1'` → `'1.2'`
- [ ] `publishDate` / `effectiveDate` `2026-04-10` → `2026-05-13`
- [ ] `EMPLOYER_TERMS_VERSION_TAG` 의 prefix `v4-` → `v5-`

### 1.3 검증

- [ ] `employer-register.tsx` 에서 import 가 깨지지 않는지 typecheck
- [ ] 기존 구인자 (테스트) `employer_agreements` jsonb 가 `v5-2026-05-13` 으로 누적되는지 확인

---

## Phase 2: DB 마이그레이션 (P0 + P1 컬럼)

### 2.1 마이그레이션 SQL 작성

파일: `uniqn-mobile/supabase/migrations/20260516000000_third_party_consent_columns.sql`

```sql
-- ============================================================================
-- 개인정보 제3자 제공 동의 컬럼 추가 (P0 + P1)
--
-- - users.third_party_agreed: 가입 시 [필수] 동의 (P0)
-- - applications.applicant_provision_consent_at: 지원 시점 동의 timestamp (P1)
--
-- nullable 유지: 기존 row(테스트 계정 / 기존 지원) 호환 위해 NOT NULL 강제 안 함.
-- 신규 row 는 UI/Service 레이어에서 항상 채움.
-- ============================================================================

-- P0: users 컬럼
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS third_party_agreed boolean,
  ADD COLUMN IF NOT EXISTS third_party_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS third_party_agreed_version text;

COMMENT ON COLUMN public.users.third_party_agreed IS
  '개인정보 제3자 제공 동의 (구인구직 매칭 상대방에게 이름·연락처·프로필 제공) — 개보법 §17';
COMMENT ON COLUMN public.users.third_party_agreed_version IS
  'thirdPartyConsent.ts 의 version 값 (예: v1-2026-05-13)';

-- P1: applications 컬럼
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS applicant_provision_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS applicant_provision_consent_version text;

COMMENT ON COLUMN public.applications.applicant_provision_consent_at IS
  '지원 시점 — 이 공고 구인자에게 정보 제공 동의 timestamp (포괄동의 보강)';
COMMENT ON COLUMN public.applications.applicant_provision_consent_version IS
  'thirdPartyConsent.ts 의 version 값 (예: v1-2026-05-13)';

-- 인덱스 불필요: 동의 여부 조회는 user-self 단위라 row 1개 SELECT.
-- 분쟁 대응 시 admin 조회는 user_id PK 인덱스로 충분.
```

### 2.2 적용

- [ ] MCP `mcp__supabase__apply_migration` 으로 적용 (CLI `db push` 금지)
- [ ] `mcp__supabase__list_migrations` 로 등록 확인
- [ ] `mcp__supabase__execute_sql` 로 컬럼 존재 검증:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users'
    AND column_name LIKE 'third_party%';
  -- 3 rows 기대

  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='applications'
    AND column_name LIKE 'applicant_provision%';
  -- 2 rows 기대
  ```

### 2.3 TypeScript 타입 재생성

- [ ] `mcp__supabase__generate_typescript_types` 실행
- [ ] 결과를 `uniqn-mobile/src/types/supabase.ts` 에 반영
- [ ] `npm run type-check` 통과 확인 (이 시점에는 신규 컬럼이 타입에 있고 코드에는 안 쓰여서 통과)

---

## Phase 3: P0 — 가입 시 제3자 제공 동의

### 3.1 thirdPartyConsent.ts 본문 작성

파일: `uniqn-mobile/src/constants/legal/thirdPartyConsent.ts`

본문 핵심 4고지:
- **제공받는 자:** 구인자(채용 공고 등록 사업주)
- **제공 항목:** 이름, 휴대폰 번호, 프로필 정보(경력·자기소개·프로필 사진 — 선택 등록 시)
- **제공 목적:** 구인구직 매칭, 채용 결정 통지, 근무 일정 조율
- **보유 및 이용 기간:** 매칭 종료 후 3개월
- **거부권:** 동의 거부 시 회원가입 불가 (서비스 제공 본질)

`version: '1.0'`, `effectiveDate: '2026-05-13'`.

`LegalDocument` 타입을 따른다 (다른 legal 파일과 동일 구조).

### 3.2 export 등록

- [ ] `src/constants/legal/index.ts` 에 `export { THIRD_PARTY_CONSENT, THIRD_PARTY_CONSENT_VERSION_TAG } from './thirdPartyConsent'`
- [ ] `THIRD_PARTY_CONSENT_VERSION_TAG = \`v1-${THIRD_PARTY_CONSENT.effectiveDate}\``

### 3.3 SignupStepTerms.tsx 체크박스 추가

- [ ] `TERMS` 배열 4번째 항목:
  ```ts
  {
    key: 'thirdPartyAgreed',
    label: '개인정보 제3자 제공 동의',
    required: true,
    contentKey: 'thirdParty',
  }
  ```
- [ ] `TermItem.key` 유니온에 `'thirdPartyAgreed'` 추가
- [ ] `loadTermContent` switch case 추가
- [ ] `useForm` defaultValues 에 `thirdPartyAgreed: initialData?.thirdPartyAgreed || false`
- [ ] `thirdPartyAgreed = watch('thirdPartyAgreed')`
- [ ] `requiredChecked = termsAgreed && privacyAgreed && thirdPartyAgreed`
- [ ] `allChecked = termsAgreed && privacyAgreed && thirdPartyAgreed && marketingAgreed`
- [ ] `handleAllAgree` 에 `setValue('thirdPartyAgreed', newValue, { shouldValidate: true })`
- [ ] 에러 표시 조건에 `errors.thirdPartyAgreed` 추가

### 3.4 termsContent.ts export

- [ ] `THIRD_PARTY_CONSENT` 본문을 plain text 로 변환하는 helper 적용 (다른 legal 항목과 동일 패턴)

### 3.5 zod 스키마

- [ ] `signUpTermsSchema` 에 추가:
  ```ts
  thirdPartyAgreed: z.boolean().refine((val) => val === true, {
    message: '개인정보 제3자 제공에 동의해주세요',
  }),
  ```
- [ ] `signUpSchema` 는 `...signUpTermsSchema.shape` spread 라 자동 반영됨

### 3.6 Service / Repository 매핑

- [ ] `authTypes.ts` `SignUpData` 에 `thirdPartyAgreed: boolean` 추가
- [ ] `authCoreService.ts:296-298` 부근에 `thirdPartyAgreed: data.thirdPartyAgreed` 추가
- [ ] `socialLoginService.ts:588-590` 부근에 동일하게 추가
- [ ] `UserRepository.create` 에서 zod camelCase → snake_case 매핑:
  - `third_party_agreed: input.thirdPartyAgreed`
  - `third_party_agreed_at: input.thirdPartyAgreed ? new Date().toISOString() : null`
  - `third_party_agreed_version: input.thirdPartyAgreed ? THIRD_PARTY_CONSENT_VERSION_TAG : null`
- [ ] `portOneIdentityService.ts:421-425` 재인증 모드는 `thirdPartyAgreed: true` 기본 (기존 회원 = 기 동의 가정 — 테스트 계정만 있으므로 안전)

### 3.7 검증

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] 신규 가입 흐름 수동: 약관 화면에서 [필수] 4개 보임 → 3개만 체크 → 다음 버튼 disabled → 4개 모두 체크 → 가입 진행 → DB users 에 `third_party_agreed=true`, `_at`, `_version='v1-2026-05-13'` 저장
- [ ] 소셜 로그인 흐름도 동일하게 동작

---

## Phase 4: P1 — 지원 시점 1-tap 동의

### 4.1 ApplicationForm.tsx 체크박스

- [ ] 제출 버튼 위에 단일 체크박스 + 1줄 안내:
  ```
  [✓] 이 공고 구인자에게 내 이름·연락처가 전달되는 것에 동의합니다.
       (보유 기간: 채용 종료 후 3개월)
  ```
- [ ] `useState` 로 `provisionConsentAgreed` 관리 (form state 아님 — submit 시점 1회용)
- [ ] **F3 회귀 방지:** `useEffect(() => { if (visible) setProvisionConsentAgreed(false); }, [visible])` — 모달 다시 열릴 때 상태 초기화. SheetModal 재오픈 시 stale 체크 방지
- [ ] 제출 버튼 `disabled={!provisionConsentAgreed || isSubmitting}`
- [ ] `onSubmit` 호출 시 `provisionConsentAt: new Date().toISOString()` 같이 전달 (타입 추가)

### 4.2 onSubmit signature 확장

- [ ] `ApplicationFormProps.onSubmit` 타입 변경:
  ```ts
  onSubmit: (
    assignments: Assignment[],
    message: string | undefined,
    preQuestionAnswers: PreQuestionAnswer[] | undefined,
    provisionConsent: { at: string; version: string },
  ) => void;
  ```
- [ ] `apply.tsx:122-178` `handleSubmit` 에서 새 인자 받고 `submitApplication` 에 전달

### 4.3 CreateApplicationInput / Repository

- [ ] `types/application.ts:89-94` `CreateApplicationInput` 에 추가:
  ```ts
  provisionConsentAt: string; // ISO 8601
  provisionConsentVersion: string; // THIRD_PARTY_CONSENT_VERSION_TAG
  ```
- [ ] `ApplicationRepository.applyWithTransaction` 의 최종 insert payload 에:
  - `applicant_provision_consent_at: input.provisionConsentAt`
  - `applicant_provision_consent_version: input.provisionConsentVersion`
- [ ] `applicationValidator` 가 새 필드를 거부하지 않는지 확인

### 4.4 useApplications.submit 시그니처

- [ ] hook 단의 submit mutation 도 새 인자 받도록 확장 (`useApplications.ts`)

### 4.5 검증

- [ ] `npm run type-check` 통과
- [ ] 수동 흐름: 공고 상세 → 지원 → ApplicationForm 마지막 단계에 체크박스 보임 → 미체크 시 제출 disabled → 체크 후 제출 → DB `applications` row 에 `applicant_provision_consent_at` / `_version` 저장
- [ ] 기존 hasAppliedToJob 흐름 회귀 없음

---

## Phase 5: 처리방침 §4 보강 + 버전 bump

### 5.1 privacyPolicy.ts §4 강화

이미 본문은 있지만 4고지를 더 또렷하게:

- [ ] 제4조 본문 보강:
  - 제공받는 자: **구인자(채용 공고 등록 사업주)** — 익명 다수 아님
  - 제공 항목: 이름, 휴대폰 번호, 프로필 정보 (경력·자기소개·프로필 사진 등 선택 등록 시)
  - 제공 목적: 구인구직 매칭, 채용 결정 통지, 근무 일정 조율
  - 보유 기간: 매칭 종료 후 3개월 — 이후 구인자는 자체 보관 정보 모두 파기
  - **별도 동의:** 가입 시 [필수] 동의 + 지원 시 추가 확인
- [ ] `version: '1.1'` → `'1.2'`
- [ ] `effectiveDate` / `publishDate` `2026-04-10` → `2026-05-13`

### 5.2 privacy.html 동기화 (Pre-2 결과에 따라)

- [ ] 수동 동기화 필요면 동일 본문으로 갱신
- [ ] build script 가 있으면 실행

---

## Phase 6: 통합 검증 + 회귀 테스트

### 6.1 자동 검증

- [ ] `npm run quality` (typecheck + lint + format:check)
- [ ] `npm test` — 기존 테스트 회귀 없음 (특히 `SignupStepTerms.test.tsx`, `useApplications.test.tsx`, `AppLayout.test.tsx`)
- [ ] `__tests__/SignupStepTerms.test.tsx` 의 mock 에 `signUpTermsSchema: {}` 가 있어 (현재 라인 36) 신규 필드 추가로 깨지지 않는지 확인. 깨지면 mock 갱신.

### 6.2 신규 테스트 추가 (최소)

- [ ] `SignupStepTerms.test.tsx`:
  - "필수 4개 모두 체크해야 다음 버튼 활성화"
  - "전체 동의 클릭 시 4개 모두 체크"
- [ ] `ApplicationForm.test.tsx` (없으면 신규):
  - **T4**: "제공 동의 체크 안 하면 제출 disabled"
  - **T5**: "체크 + 제출 시 onSubmit 콜백에 provisionConsent 객체 전달"
  - **T6 (F3 회귀 방지)**: "모달 닫았다가 다시 열면 동의 체크 상태 reset 됨"

### 6.3 수동 E2E 흐름

- [ ] 신규 이메일 가입: 약관 4개 체크 → 가입 → DB `users.third_party_agreed=true` 확인
- [ ] 신규 소셜 가입 (Google): 동일 흐름
- [ ] 가입 후 지원: ApplicationForm 동의 체크 → 제출 → DB `applications.applicant_provision_consent_at` 확인
- [ ] 신규 구인자 등록: employer-register 화면 → 서약서/이용약관 본문에 신규 6/7조 노출 → 등록 → `users.employer_agreements` 에 `v5-2026-05-13` 누적 확인
- [ ] 설정 > 약관 메뉴: 4개 약관 모두 최신 버전 표시 (1.2 / 1.2 / 1.2 / 1.0)

### 6.4 메모리 업데이트

- [ ] `memory/` 에 `project_third_party_consent_implementation.md` 추가 — 구현 결과 + 결정사항 요약
- [ ] `MEMORY.md` 에 한 줄 인덱스 추가

---

## Test Plan (Eng review §3)

다음 섹션의 **신규 UX 플로우 / 데이터 플로우 / 코드패스 → 테스트 매핑** 표를 참고.

## Failure Modes Registry

다음 섹션의 **실패 모드 레지스트리** 표를 참고.

## NOT in scope

- 기존 회원 재동의 모달 (옵션 B) — 운영 계정 부재로 deferred
- `notifications` 테이블에 동의 변경 이력 push 알림 — 분쟁 시 admin 조회로 충분
- 처리방침 변경 30일 사전 공지 — 본질적 신규 항목 아니므로 시행일 즉시 적용
- 구인자가 구직자 정보 조회 시 access log 테이블 — 별도 PR (감사 로그는 광범위 작업)
- 마이페이지에서 동의 철회 UI — 회원 탈퇴로 갈음 (P0 거부 시 서비스 본질 제공 불가)

## What already exists

| 요구 | 기존 코드 |
|---|---|
| 회원가입 다단계 폼 | `SignupForm.tsx` + 4 step 컴포넌트 |
| 약관 체크박스 패턴 | `SignupStepTerms.tsx:33-52` `TERMS` 배열 |
| 약관 본문 source-of-truth | `src/constants/legal/*.ts` |
| 처리방침 §4 본문 | `privacyPolicy.ts:50-61` (이미 있음 — 보강만 필요) |
| 구인자 서약서 § 1.4 / 이용약관 §3.5 | 책임 귀속 한 줄씩 (이미 있음 — 별도 조항 격상) |
| 구인자 버전 누적 jsonb | `users.employer_agreements` (이미 있음) |
| 지원 트랜잭션 | `ApplicationRepository.applyWithTransaction` |
| 본인인증 재인증 모드 | `portOneIdentityService.ts:421-425` |

---

## 위험 & 의존성

1. **마이그레이션 적용 순서**: 컬럼 추가 → 타입 재생성 → 서비스 코드 → UI. 역순으로 가면 타입 에러로 컴파일 실패.
2. **MCP apply_migration**: CLI `supabase db push` 금지 (메모리). 파일/레지스트리 timestamp 불일치는 무해.
3. **테스트 mock 회귀**: `SignupStepTerms.test.tsx` 의 `signUpTermsSchema: {}` mock 이 신규 필드로 깨질 수 있음. mock 갱신 필요.
4. **portOneIdentityService 재인증 모드**: `thirdPartyAgreed: true` 기본값은 "기존 회원 = 기 동의" 가정인데, 옵션 A (기존 = 테스트만) 이므로 안전. 운영 회원이 생기기 전에 P0 출시 필수.
5. **버전 태그 prefix 일관성**: 기존 `v4-YYYY-MM-DD` 패턴 따름. `v5-` 로 bump.

---

## Dependencies

- 메모리 `feedback_supabase_migration_workflow` — apply_migration 전용
- 메모리 `project_legal_documents_single_source` — legal 디렉토리만 수정
- 메모리 `pitfall_test_seed_zod_schema_first` — JSONB 직접 INSERT 금지 (해당 없음, scalar 컬럼)
- CLAUDE.md 커밋 규칙 — `feat(auth): ...` / `feat(legal): ...` 분할 권장

---

## 최종 커밋 시퀀스 (예상)

1. `feat(legal): P3 구인자 서약서 §6 + 이용약관 §7 신설 + v5 bump`
2. `feat(db): users + applications 제3자 제공 동의 컬럼 추가 (P0/P1 인프라)`
3. `feat(auth): P0 가입 시 제3자 제공 동의 [필수] 체크박스`
4. `feat(jobs): P1 지원 시 1-tap 제공 동의 확인`
5. `feat(legal): 처리방침 §4 4고지 보강 + v1.2 bump`
6. `test(consent): SignupStepTerms + ApplicationForm 신규 동의 테스트`
7. `docs(memory): 제3자 제공 동의 구현 기록`

---

## ENG REVIEW REPORT

> 2026-05-13 inline eng review. plan-eng-review 의 핵심 산출물(Architecture / Test Diagram / Failure Modes / Scope Challenge)만 발췌.

### Architecture Diagram

```
┌─ Signup Flow (P0) ─────────────────────────────────────────────┐
│                                                                 │
│  SignupStepTerms.tsx                                            │
│    ├─ TERMS[4]: terms, privacy, thirdParty(NEW), marketing      │
│    └─ signUpTermsSchema (zod) ── 3 [필수]=true 강제              │
│         │                                                       │
│         ▼                                                       │
│  SignupForm.tsx ── 4 step orchestrator                          │
│         │                                                       │
│         ▼                                                       │
│  authCoreService.completeSignup(SignUpData)                     │
│   /socialLoginService.completeSocialSignup(SignUpData)          │
│      - thirdPartyAgreed: data.thirdPartyAgreed                  │
│         │                                                       │
│         ▼                                                       │
│  UserRepository.create({                                        │
│    third_party_agreed,                                          │
│    third_party_agreed_at: now,                                  │
│    third_party_agreed_version: 'v1-2026-05-13',                 │
│  })                                                             │
│         │                                                       │
│         ▼                                                       │
│  Supabase users 테이블 ── 신규 3 컬럼 (nullable)                 │
└─────────────────────────────────────────────────────────────────┘

┌─ Application Flow (P1) ────────────────────────────────────────┐
│  ApplicationForm.tsx                                            │
│    ├─ useState provisionConsentAgreed (NEW, reset on open)      │
│    └─ Submit disabled until checked                             │
│         │                                                       │
│         ▼                                                       │
│  apply.tsx handleSubmit(assignments, msg, preQA, consent)       │
│         │                                                       │
│         ▼                                                       │
│  useApplications.submit → submitApplication mutation            │
│         │                                                       │
│         ▼                                                       │
│  ApplicationRepository.applyWithTransaction(                    │
│    CreateApplicationInput { …, provisionConsentAt,              │
│                                 provisionConsentVersion })      │
│    └─ INSERT applications SET                                   │
│         applicant_provision_consent_at,                         │
│         applicant_provision_consent_version                     │
└─────────────────────────────────────────────────────────────────┘

┌─ Employer Register Flow (P3) ──────────────────────────────────┐
│  employer-register.tsx ── 코드 변경 없음                         │
│    ├─ import LIABILITY_WAIVER_VERSION_TAG  (v5-2026-05-13)      │
│    └─ import EMPLOYER_TERMS_VERSION_TAG    (v5-2026-05-13)      │
│         │                                                       │
│         ▼                                                       │
│  registerAsEmployer → users.employer_agreements jsonb 누적       │
│    { v5-2026-05-13: { agreed_at, … } }                          │
└─────────────────────────────────────────────────────────────────┘
```

**판정:** 4-계층 패턴 그대로 따름. 추가 abstraction 없음. P0/P1 데이터 흐름 명확. P3 는 텍스트 + 버전 태그 변경만으로 기존 인프라 재활용 (가장 안전한 설계 선택).

### Test Diagram — 신규 코드패스 → 커버리지 매핑

| # | 신규 UX 흐름 | 코드패스 | 신규 테스트 | 기존 테스트 |
|---|---|---|---|---|
| T1 | 가입자: 약관 4개 체크 → 가입 성공 → DB 저장 확인 | `SignupStepTerms` → `signUpTermsSchema` → `authCoreService` → `UserRepository` | **필수** — `SignupStepTerms.test.tsx` 확장 (4-필드 시나리오 + handleAllAgree 4개 동기화) | 부분 — 기존 mock 갱신 필요 (`signUpTermsSchema: {}` line 36) |
| T2 | 가입자: 4개 중 3개만 체크 → 다음 버튼 disabled | `requiredChecked` 계산식 | **필수** — RTL `getByRole('button', { name: '다음' })` disabled assertion | NO |
| T3 | 소셜 가입 (Google/Kakao): 동일 흐름 | `SignupStepTerms` 공유 → `socialLoginService` | NO 신규 — 본질적으로 같은 컴포넌트 | YES (기존 social flow 테스트 있으면) |
| T4 | 지원자: 미체크 → 제출 disabled | `ApplicationForm` useState | **필수** — `ApplicationForm.test.tsx` (신규 또는 확장) | NO |
| T5 | 지원자: 체크 + 제출 → onSubmit 콜백 인자 검증 | `ApplicationForm onSubmit` → `apply.tsx handleSubmit` → `submitApplication` | **필수** — onSubmit mock 의 4번째 인자 `{ at, version }` 검증 | 부분 |
| T6 | 지원자: 모달 닫았다가 다시 열기 → 동의 상태 reset | useEffect cleanup | **필수** — Failure Mode F3 회귀 방지 | NO |
| T7 | 구인자 등록: v5 약관 노출 → 동의 → jsonb 누적 | `employer-register.tsx` (코드 변경 없음) | NO 신규 — 본문만 바뀜 | YES — 기존 통합 테스트 회귀 확인 |
| T8 | 처리방침 화면: v1.2 본문 노출 | `settings/privacy.tsx` source-of-truth import | NO 신규 — 단일 소스 패턴 보장 | YES (snapshot 있으면 갱신) |
| T9 | 회귀: 기존 SignupStepTerms 테스트 mock 깨짐 | `signUpTermsSchema: {}` mock | mock 갱신 | YES — 무조건 검증 |
| T10 | DB row 검증 (manual smoke) | Supabase `execute_sql` 직접 조회 | YES — Phase 6.3 수동 검증 체크리스트 | NO |

**판정:** T1, T2, T4, T5, T6, T9 가 critical gap. T6 (모달 reset) 는 Failure Mode F3 회귀 방지 — useEffect 추가 + 테스트 필수. **Phase 6.2 에 T6 명시 추가 필요.**

### Failure Modes Registry

| # | 시나리오 | 발생 조건 | 영향 | 완화책 | 우선순위 |
|---|---|---|---|---|---|
| F1 | 마이그레이션 적용 전 코드 배포 | CF 배포가 prod migration 보다 빨리 끝남 | 신규 가입/지원 INSERT 실패 → 가입 불가 | 배포 순서 강제: MCP `apply_migration` 먼저 → master push → CF 자동 배포 (메모리 `feedback_supabase_migration_workflow`) | **CRITICAL** |
| F2 | types/supabase.ts 재생성 누락 | Phase 2.3 스킵 | typecheck 실패 → CI 차단 | `npm run quality` gate (이미 있음) — 자동 차단됨 | LOW |
| F3 | ApplicationForm consent state stale | useState 가 unmount 시점 reset 안 됨 | 닫았다 다시 열 때 체크 유지 → 의도 없는 제출 가능 | `useEffect(() => { if (visible) setProvisionConsent(false); }, [visible])` 추가 + T6 테스트 | **HIGH** |
| F4 | portOneIdentityService 재인증 시 자동 thirdPartyAgreed=true | 운영 회원이 P0 출시 후 추가됐는데 재인증 진입 | 동의 없이 신규 버전 강제 적용 | Pre-3 검증 (운영 회원 0건 확인) + 신규 운영 회원은 P0 거치므로 무관 | MEDIUM |
| F5 | SignupStepTerms.test.tsx mock 깨짐 | 신규 필드 미반영 | 테스트 실패 | Phase 6.1 명시 검증 | LOW |
| F6 | employer_agreements jsonb 에 v5 누적 안 됨 | employer-register.tsx 변경 없음 — VERSION_TAG import 시점 자동 반영 가정 | 신규 구인자도 v4 저장 가능성 | Phase 1.3 typecheck + 실제 등록 후 jsonb 확인 (Phase 6.3) | MEDIUM |
| F7 | applications.applicant_provision_consent_at NULL row | 기존 row (테스트) 또는 마이그레이션 후 빈 배포 윈도우 | admin 분쟁 조회 시 분간 불가 | created_at 비교 추론 + 신규 row 는 항상 채움 (UI 강제) | LOW |
| F8 | privacy.html ↔ privacyPolicy.ts drift | 수동 동기화 누락 | 스토어 제출 정책 vs 앱 정책 본문 불일치 | Pre-2 / Phase 5.2 명시 | MEDIUM |
| F9 | 부분 PR 머지로 P3 만 배포 | commit 시퀀스 분할 머지 | UX 불일치 (구인자 서약서 v5 + 가입 3개 동의) | 단일 PR 로 묶기 권장 OR 머지 순서 엄수 | MEDIUM |
| F10 | RLS 가 신규 컬럼 차단 | users 테이블 RLS 가 column-level 화이트리스트 | 가입 INSERT 성공해도 후속 SELECT 시 컬럼 missing | users 테이블 RLS 확인 — UNIQN 은 row-level only 패턴 → 안전 | LOW |
| F11 | 동시 가입 race: thirdPartyAgreed 저장 트랜잭션 분리 | UserRepository.create 가 INSERT 후 별도 UPDATE | 부분 저장 가능성 | 단일 INSERT payload 에 모두 포함 (3.6 매핑 패턴) — 트랜잭션 분리 금지 | LOW |
| F12 | THIRD_PARTY_CONSENT_VERSION_TAG drift | thirdPartyConsent.ts 본문은 바꿨는데 VERSION_TAG bump 안 함 | DB version 컬럼 stale | effectiveDate ↔ VERSION_TAG 자동 동기화 패턴 (다른 legal 파일과 동일) — 휴먼 실수만 위험 | LOW |

**판정:** F1 (배포 순서) 와 F3 (consent state stale) 가 가장 위험. F1 은 절차로 막힘, F3 는 코드 + 테스트로 막아야 함.

### Scope Challenge

**플랜이 다루는 것:**
- 가입 시 동의 + 지원 시 동의 + 구인자 의무 (3 축)
- DB 컬럼 추가 (additive, nullable)
- 텍스트 + 버전 + 스키마 + 서비스 매핑

**플랜이 의도적으로 안 다루는 것** (NOT in scope 섹션에 명시):
- 기존 회원 재동의 (옵션 A — 테스트만)
- 동의 철회 UI (회원 탈퇴로 갈음)
- access log 테이블 (별도 PR 권장)
- 처리방침 30일 사전 공지

**숨은 복잡도 (확인 완료):**
- ✅ `portOneIdentityService` 재인증 모드 — 명시적 처리
- ✅ `employer_agreements` jsonb — 코드 변경 없이 자동 누적
- ✅ `privacy.html` 정적 파일 — Pre-2 에 명시
- ✅ 기존 `SignupStepTerms.test.tsx` mock — Phase 6.1 에 명시
- ⚠️ **ApplicationForm 모달 재오픈 시 state reset** — Phase 4.1 에 누락. 본 리뷰에서 보강 필요

**Eng review 보강사항:** Phase 4.1 에 useEffect reset 명시 + Phase 6.2 에 T6 테스트 추가.

### Eng Review 보강 적용 사항

- Phase 4.1 에 "useEffect 로 visible=true 진입 시 setProvisionConsent(false) reset — F3 회귀 방지" 추가 필요
- Phase 6.2 에 "T6: 모달 닫았다 다시 열 때 동의 상태 reset" 추가 필요
- Architecture diagram 의 ApplicationForm 블록에 "reset on open" 주석 추가됨 (위 다이어그램)

### Eng Review 최종 판정

| 항목 | 점수 | 코멘트 |
|---|---|---|
| Architecture 건전성 | 9/10 | 4-계층 패턴 일관, abstraction 추가 없음 |
| Test 커버리지 계획 | 7/10 | T1~T6 신규 명시 — Phase 6.2 에 T6 추가 시 8/10 |
| 보안 위협 표면 | 9/10 | RLS 변경 없음, 컬럼만 추가 — surface 최소 |
| 성능 영향 | 10/10 | scalar 컬럼 3+2 추가, 인덱스 불필요, N+1 가능성 0 |
| 에러 경로 | 8/10 | F1/F3 처리 명확, 다른 mode 들 모두 식별 |
| 배포 위험 | 7/10 | F1 절차 의존 — migration → CF push 순서 엄수 시 안전 |
| **Overall** | **8.3/10** | F3 보강 후 ship 가능 |

**Verdict: APPROVED (with F3 보강 반영 후).** Phase 4.1 + Phase 6.2 업데이트 적용 권장.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | skipped | 사용자가 사전 P0/P1/P3 확정. CEO phase 의식 불필요 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | skipped | scope 명확 — codex 의식 불필요 |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | done | 8.3/10. F3 (consent state stale) 보강 필요 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | skipped | 체크박스 3개 추가, design 영향 미미 |
| DX Review | `/plan-devex-review` | DX gaps | 0 | n/a | 사용자 대상, developer-facing 아님 |

**VERDICT:** **APPROVED — Eng review 보강 (Phase 4.1 useEffect / Phase 6.2 T6) 반영 후 ship 준비 완료.**

