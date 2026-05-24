# 구인자 등록 신청 — 소개글 입력 설계

> 작성일: 2026-05-24
> 상태: 설계 승인 대기

## 1. 목적 (Conclusion First)

구인자 등록 신청 시 신청자가 **"주로 구인하는 지역/매장/대회"** 를 한 문단으로 입력하고,
관리자가 신청 검토 화면에서 이 소개글을 보고 승인/거부 판단에 활용한다.

현재 관리자는 신청자의 본인인증·프로필·약관 동의 정보만 볼 수 있어, 신청자가 실제 어떤
구인 활동을 하려는지 판단할 근거가 없다. 짧은 소개글 하나로 관리자의 검토 신뢰도를 높인다.

## 2. 범위

### 포함

- 등록 신청 화면(`employer-register.tsx`)에 소개글 멀티라인 입력 (필수, 10~300자)
- `employer_applications` 테이블에 `intro` 전용 컬럼 추가
- 신청 생성 RPC `register_as_employer` 에 `p_intro` 파라미터 추가
- 관리자 신청 상세 화면(`employer-applications/[id].tsx`)에 "구인 소개" 카드 노출

### 제외 (확정)

- `users` 테이블 변경 없음
- 관리자 사용자 상세(`(admin)/users/[id].tsx`) 노출 없음
- 승인 후 구인자의 소개글 수정 기능 없음 (별도 후속 작업)
- 신청자 본인 상태 화면(`employer-application-status.tsx`) 노출 없음
  → `get_latest_employer_application` RPC 변경 불필요

## 3. 결정 사항

| 항목        | 결정                                    | 근거                                                               |
| ----------- | --------------------------------------- | ------------------------------------------------------------------ |
| 저장 방식   | `employer_applications.intro` 전용 컬럼 | 의미 명확(소개글 ≠ 약관 스냅샷), misnomer 회피, 재신청 체인별 보존 |
| 필수 여부   | 필수 입력                               | 관리자가 항상 검토 근거 확보                                       |
| 글자 수     | 10~300자                                | 성의 없는 입력 방지(min 10) + `users.note` 와 동일 상한(max 300)   |
| 관리자 노출 | 신청 검토 화면만                        | 사용자 결정                                                        |
| 수정 가능   | 이번 범위 제외                          | 범위 축소, 빠른 출시                                               |

## 4. 데이터 흐름

```
[입력] app/(app)/employer-register.tsx
  · "주로 구인하는 지역/매장/대회" 멀티라인 TextInput (필수)
  · zod 검증: z.string().trim().min(10).max(300).refine(xssValidation)
  · canSubmit = isVerified && agreeToTerms && agreeToLiability && introValid
        │
        ▼
[서비스] registerAsEmployer(agreementsSnapshot, intro)   ← src/services/auth/profileService.ts
        │
        ▼
[리포지토리] employerApplicationRepository.register(snapshot, intro)
  · supabase.rpc('register_as_employer', { p_employer_agreements, p_intro })
        │
        ▼
[DB] register_as_employer(p_employer_agreements jsonb, p_intro text)
  · INSERT employer_applications(..., intro) VALUES (..., p_intro)
        │
        ▼  (관리자가 검토 시)
[조회] getById(applicationId) → .select(ADMIN_SELECT 에 intro 포함)
        │
        ▼
[노출] app/(admin)/employer-applications/[id].tsx
  · "구인 소개" Card (프로필 정보 카드 다음) → app.intro 표시
```

## 5. 구성 요소별 변경

### 5.1 DB 마이그레이션 (신규 1개)

- `ALTER TABLE public.employer_applications ADD COLUMN intro text;`
  - nullable (기존 신청 레코드 호환). 필수 여부는 앱 레이어에서 강제.
  - 경계 방어용 CHECK: `char_length(intro) <= 300` (NULL 허용)
- RPC 시그니처 변경 (인자 개수 변경 → 오버로드 방지 위해 DROP 필수):
  - `DROP FUNCTION IF EXISTS public.register_as_employer(jsonb);` 먼저 실행
    (`CREATE OR REPLACE` 는 인자 개수가 다르면 교체가 아닌 **오버로드 생성** → 호출 모호성)
  - `CREATE FUNCTION register_as_employer(p_employer_agreements jsonb DEFAULT NULL, p_intro text DEFAULT NULL)`
  - 기존 supersedes_id 로직(20260416200000) 그대로 보존 + INSERT 에 `intro` 추가
  - `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` 재적용
  - 클라이언트는 항상 2인자(`p_employer_agreements`, `p_intro`)로 호출하도록 동기 배포

### 5.2 타입 재생성

- `mcp__supabase__generate_typescript_types` 로 DB 타입 재생성

### 5.3 Repository (`EmployerApplicationRepository.ts`)

- `TABLE_COLUMNS` 에 `intro` 추가
- `EmployerApplication` 인터페이스에 `intro: string | null` 추가
- `register(agreementsSnapshot, intro)` 시그니처 + RPC 파라미터 `p_intro` 전달

### 5.4 Service (`profileService.ts`)

- `registerAsEmployer(agreementsSnapshot, intro)` 시그니처 확장 → repository 위임

### 5.5 등록 화면 (`employer-register.tsx`)

- "구인 소개" Card 신설 (프로필 정보 Card 다음, 동의 항목 앞)
- 멀티라인 `TextInput` (impeccable Rule 20 키보드 UX, autoFocus 금지)
  - placeholder: "주로 구인하는 지역/매장/대회를 알려주세요\n예) 강남 일대 홀덤펍, OO포커 대회 딜러 모집"
  - `maxLength={300}`, 글자 수 카운터 표시
- zod 스키마로 검증 + 에러 메시지(impeccable Rule 10: 무엇+왜+어떻게)
- `canSubmit` 게이트에 `introValid` 추가
- `handleSubmit` 에서 `registerAsEmployer(agreementsSnapshot, intro.trim())` 호출

### 5.6 관리자 상세 화면 (`employer-applications/[id].tsx`)

- "프로필 정보" Card 다음에 "구인 소개" Card 추가
- `app.intro` 표시 (없으면 "-"), 다크모드 토큰 준수
- Text truncation 정책(Rule 26): 본문 미리보기 전체 표시(긴 글이라도 잘림 없이)

### 5.7 zod 스키마

- `src/schemas/` 에 employerIntro 스키마 추가 (또는 register 화면 인라인)
  ```ts
  const employerIntroSchema = z
    .string()
    .trim()
    .min(10, { message: '소개글은 최소 10자 이상 입력해주세요' })
    .max(300, { message: '소개글은 300자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });
  ```

## 6. 에러 / 엣지 케이스

| 케이스                        | 처리                                   |
| ----------------------------- | -------------------------------------- |
| 소개글 10자 미만              | 버튼 비활성 + 인라인 에러 메시지       |
| 300자 초과                    | maxLength 로 입력 차단 + 카운터 경고색 |
| XSS 위험 문자열               | zod refine 실패 → 인라인 에러          |
| 공백만 입력                   | trim 후 min 검증 실패                  |
| 기존(소개글 없는) 신청 레코드 | intro NULL → 관리자 화면 "-" 표시      |
| 재신청(supersedes 체인)       | 각 신청이 자체 intro 보유              |

## 7. 테스트

- **zod 스키마 단위 테스트**: min/max/공백/XSS 케이스 (Red-Green)
- **Repository 단위 테스트**: `register` 가 `p_intro` 를 RPC 에 전달하는지 (mock)
- **pgTAP (선택)**: `register_as_employer` 2인자 호출 → intro 저장 확인
- **수동 검증**: localhost dev(= prod DB) 에서 신청 → 관리자 상세에서 소개글 노출 확인

## 8. 보안

- 사용자 입력 → `xssValidation` refine 필수 (CLAUDE.md 규칙)
- DB CHECK 길이 제한 = 경계 방어
- RPC 는 SECURITY DEFINER, search_path='public' 기존 패턴 유지
- intro 는 PII 아님(자기소개 텍스트), Sentry redact 대상 아님

## 9. 마이그레이션/배포 주의

- 마이그레이션은 MCP `apply_migration` 전용 (`supabase db push` 금지 — feedback 메모리)
- RPC 시그니처 변경 → 클라이언트 코드와 동시 배포 필요(2인자 호출)
- 모바일 앱 반영은 EAS OTA(`eas update`) 또는 새 빌드 필요 — 머지만으론 미반영
- 웹은 Cloudflare 재배포로 반영
