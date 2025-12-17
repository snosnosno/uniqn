# Phase 2: 인증 + 구인구직 개발 프롬프트

## 컨텍스트

### Phase 1 완료 상태 (2025-12-17)
```yaml
완료 항목:
  - 프로젝트 초기화 (Expo SDK 54, RN 0.81, React 19)
  - 핵심 기반 시스템 (Firebase, NativeWind, Expo Router, Zustand, React Query)
  - 에러 처리 체계 (AppError 계층, 에러 코드 E1xxx~E7xxx, 한글 메시지)
  - 로깅 전략 (LoggerService, 환경별 로그 레벨)
  - 핵심 UI 컴포넌트 15개 (Button, Input, Card, Modal, Toast 등)
  - 테스트 인프라 (Jest + Testing Library, 160개 테스트 통과)
  - 코드 품질 (ESLint 0 에러, TypeScript strict 0 에러)

기존 파일 (재사용 필수):
  - src/stores/authStore.ts: 인증 상태, ROLE_HIERARCHY, hasPermission()
  - src/stores/toastStore.ts: 토스트 알림
  - src/stores/modalStore.ts: 모달 관리
  - src/lib/firebase.ts: Firebase 초기화
  - src/lib/queryClient.ts: Query Keys 중앙 관리
  - src/errors/: AppError, AuthError, NetworkError 등
  - src/components/ui/: 15개 기본 컴포넌트
  - src/hooks/useAppInitialize.ts, useAuthGuard.ts
```

### 프로젝트 구조
```
uniqn-mobile/
├── app/                      # Expo Router
│   ├── (auth)/              # 인증 플로우 (로그인, 회원가입)
│   ├── (app)/               # 로그인 필수 영역
│   │   ├── (tabs)/          # 하단 탭 (홈, 스케줄, QR, 알림, 프로필)
│   │   ├── jobs/[id]/       # 공고 상세
│   │   └── settings/        # 설정
│   └── _layout.tsx          # 루트 레이아웃
├── src/
│   ├── components/
│   │   ├── ui/              # 기본 UI (Phase 1 완료)
│   │   ├── auth/            # 인증 컴포넌트 (Phase 2)
│   │   └── jobs/            # 구인구직 컴포넌트 (Phase 2)
│   ├── services/            # Firebase 서비스 (Phase 2)
│   ├── stores/              # Zustand 스토어
│   ├── hooks/               # Custom Hooks
│   ├── schemas/             # Zod 스키마
│   └── types/               # TypeScript 타입
└── specs/react-native-app/  # 스펙 문서 참조
```

---

## Phase 2 목표

### 2.1 인증 시스템 [P0]
```yaml
인증 방식:
  - ID/PW (이메일/비밀번호) 로그인
  - 소셜 로그인: Apple(P0), Google(P1), 카카오(P1)
  - ⚠️ 이메일 인증 사용 안함 → 휴대폰 본인인증으로 대체

회원가입 (4단계):
  1. 계정 정보 (이메일/비밀번호 또는 소셜 로그인)
  2. 휴대폰 본인인증 (필수) - PASS 또는 카카오 인증
  3. 프로필 정보 (닉네임, 역할 선택)
  4. 약관 동의

구현 항목:
  - 로그인 (ID/PW + 소셜)
  - 회원가입 (4단계)
  - 휴대폰 본인인증 (Mock - Phase 6에서 실제 연동)
  - 비밀번호 찾기
  - Apple 소셜 로그인 (P0, iOS 필수)
  - 세션 관리 (토큰 갱신)

P1 항목 (출시 전):
  - Google 소셜 로그인
  - 카카오 소셜 로그인

P2 항목 (출시 후):
  - 생체 인증
```

### 2.2 회원탈퇴 + 개인정보 관리 [P0]
```yaml
필수 구현 (법적 요구사항):
  - 탈퇴 화면 UI (사유 선택, 경고)
  - 탈퇴 확인 절차 (비밀번호 재입력)
  - 계정 비활성화 → 30일 유예 → 완전 삭제
  - 개인정보 열람/수정/삭제 요청
  - 데이터 내보내기 (JSON)
```

### 2.3 구인구직 [P0]
```yaml
구현 항목:
  - 공고 목록 (FlashList + 무한스크롤)
  - 공고 상세
  - 지원하기
  - 지원 내역

P1 항목:
  - 필터/검색
  - 찜하기
```

### 2.4 비즈니스 에러 클래스 추가
```typescript
// src/errors/BusinessError.ts
export class InsufficientChipsError extends AppError {}  // 칩 부족
export class AlreadyAppliedError extends AppError {}     // 중복 지원
export class ApplicationClosedError extends AppError {}  // 지원 마감
export class MaxCapacityReachedError extends AppError {} // 정원 초과
```

---

## 구현 순서 (의존성 기반)

### Step 1: 스키마 + 타입 정의
```yaml
우선순위: 최우선
파일:
  - src/schemas/auth.ts: passwordSchema, loginSchema, signupSchema
  - src/schemas/job.ts: jobPostingSchema, applicationSchema
  - src/types/auth.ts: LoginCredentials, SignupData
  - src/types/job.ts: JobPosting, Application, ApplicationStatus

참조: app2/src/schemas/, app2/src/types/
작업: 기존 스키마 복사 후 RN 호환 수정
```

### Step 2: 서비스 레이어
```yaml
우선순위: 높음
파일:
  - src/services/authService.ts: login, signup, resetPassword, socialLogin
  - src/services/jobService.ts: getJobPostings, getJobDetail
  - src/services/applicationService.ts: applyJob, getMyApplications

참조: app2/src/services/
특이사항:
  - 트랜잭션 필수: 지원 시 applications + jobPostings 동시 업데이트
  - 에러 핸들링: Firebase 에러 → BusinessError 변환
```

### Step 3: 인증 컴포넌트
```yaml
우선순위: 높음
컴포넌트:
  - src/components/auth/LoginForm.tsx
  - src/components/auth/SignupForm.tsx (4단계: AccountStep → IdentityStep → ProfileStep → TermsStep)
  - src/components/auth/IdentityVerification.tsx (본인인증 - Mock)
  - src/components/auth/PasswordStrength.tsx
  - src/components/auth/StepIndicator.tsx
  - src/components/auth/SocialLoginButtons.tsx (Google, Apple, 카카오)
  - src/components/auth/ForgotPasswordForm.tsx

화면:
  - app/(auth)/login.tsx
  - app/(auth)/signup.tsx (4단계 플로우)
  - app/(auth)/forgot-password.tsx

참고:
  - 이메일 인증 사용 안함
  - 휴대폰 본인인증 필수 (Phase 2는 Mock, Phase 6에서 실제 연동)
```

### Step 4: 구인구직 컴포넌트
```yaml
우선순위: 높음
컴포넌트:
  - src/components/jobs/JobCard.tsx
  - src/components/jobs/JobList.tsx (FlashList)
  - src/components/jobs/JobDetail.tsx
  - src/components/jobs/ApplicationStatus.tsx
  - src/components/jobs/ApplyButton.tsx

화면:
  - app/(app)/(tabs)/index.tsx (홈 = 공고 목록)
  - app/(app)/jobs/[id]/index.tsx (공고 상세)
  - app/(app)/jobs/[id]/apply.tsx (지원 화면)
  - app/(app)/applications/index.tsx (지원 내역)
```

### Step 5: 회원탈퇴 + 개인정보
```yaml
우선순위: 중간 (법적 필수)
파일:
  - src/services/accountDeletionService.ts
  - src/components/settings/AccountDeletionScreen.tsx
  - src/components/settings/MyDataScreen.tsx
  - app/(app)/settings/delete-account.tsx
  - app/(app)/settings/my-data.tsx
```

### Step 6: 테스트
```yaml
우선순위: 필수
테스트:
  - src/services/__tests__/authService.test.ts
  - src/services/__tests__/applicationService.test.ts
  - src/components/auth/__tests__/LoginForm.test.tsx
  - src/components/jobs/__tests__/JobCard.test.tsx

커버리지 목표:
  - services/: 70%+
  - components/: 60%+
```

---

## 기술적 결정 사항

### 비밀번호 정책 (Zod 스키마)
```typescript
// src/schemas/auth.ts
export const passwordSchema = z.string()
  .min(8, '최소 8자 이상')
  .max(128, '최대 128자 이하')
  .regex(/[A-Z]/, '대문자 1개 이상')
  .regex(/[a-z]/, '소문자 1개 이상')
  .regex(/[0-9]/, '숫자 1개 이상')
  .regex(/[!@#$%^&*]/, '특수문자 1개 이상')
  .refine(
    (val) => !/(.)\1\1/.test(val),
    '3자 이상 연속 문자 금지'
  );
```

### Firebase 트랜잭션 (지원하기)
```typescript
// src/services/applicationService.ts
export async function applyJob(jobId: string, userId: string) {
  return firestore().runTransaction(async (transaction) => {
    // 1. 읽기
    const jobRef = doc(db, 'jobPostings', jobId);
    const jobDoc = await transaction.get(jobRef);

    // 2. 검증
    if (jobDoc.data()?.applicantCount >= jobDoc.data()?.maxApplicants) {
      throw new MaxCapacityReachedError('정원이 마감되었습니다');
    }

    // 3. 쓰기 (원자적)
    const applicationRef = doc(collection(db, 'applications'));
    transaction.set(applicationRef, { ... });
    transaction.update(jobRef, { applicantCount: increment(1) });
  });
}
```

### Query Keys 사용
```typescript
// 기존 queryKeys 활용 (src/lib/queryClient.ts)
import { queryKeys } from '@/lib/queryClient';

// 공고 목록
useQuery({
  queryKey: queryKeys.jobPostings.list({ status: 'active' }),
  queryFn: () => jobService.getJobPostings(filters),
});

// 지원 내역
useQuery({
  queryKey: queryKeys.applications.mine(),
  queryFn: () => applicationService.getMyApplications(),
});
```

### 권한 체크 (기존 hasPermission 활용)
```typescript
// 기존 authStore 활용
import { hasPermission, useAuthStore } from '@/stores/authStore';

// 지원하기 버튼 (staff 이상만)
const { role } = useAuthStore();
const canApply = hasPermission(role, 'staff');
```

---

## 품질 기준

### 필수 검증 (매 작업 후)
```bash
cd uniqn-mobile
npm run type-check  # TypeScript 에러 0개
npm run lint        # ESLint 에러 0개, 경고 최소화
npm test            # 테스트 통과
```

### Phase 2 완료 기준
```
□ ID/PW 회원가입 (4단계) → 로그인 완료
□ 휴대폰 본인인증 Mock UI 동작
□ Apple 소셜 로그인 동작 (iOS)
□ 공고 목록 무한스크롤 동작
□ 공고 상세 → 지원하기 완료
□ 지원 내역 확인 가능
□ 회원탈퇴 절차 동작
□ 비즈니스 에러 발생 시 한글 메시지 표시
□ 테스트 커버리지: services 70%+
□ ESLint 에러 0개, TypeScript 에러 0개
```

---

## 참조 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 스크린 스펙 | specs/react-native-app/04-screens.md | 화면 구성 |
| Firebase 스펙 | specs/react-native-app/06-firebase.md | DB 구조 |
| 에러 처리 | specs/react-native-app/09-error-handling.md | 에러 체계 |
| 컴포넌트 스펙 | specs/react-native-app/05-components.md | UI 설계 |
| 개발 체크리스트 | specs/react-native-app/DEVELOPMENT_CHECKLIST.md | 진행 추적 |

---

## 주의사항

1. **기존 코드 재사용**: app2/src/에서 복사 후 RN 호환 수정
2. **TODO [출시 전] 주석**: 누락된 기능은 주석으로 명시
3. **체크리스트 업데이트**: 각 항목 완료 시 DEVELOPMENT_CHECKLIST.md 체크
4. **커밋 단위**: 기능 단위로 커밋 (인증, 구인구직, 회원탈퇴 분리)
5. **테스트 작성**: 서비스 레이어 테스트 필수

---

## 시작 명령

```
Phase 2를 시작합니다.

체크리스트 참조: specs/react-native-app/DEVELOPMENT_CHECKLIST.md (Phase 2 섹션)

Step 1부터 순서대로 진행하되:
1. 각 Step 완료 시 npm run type-check && npm run lint 실행
2. 서비스 레이어는 테스트 코드 함께 작성
3. 완료된 항목은 체크리스트에 [x] 표시
4. TODO [출시 전] 주석으로 누락 항목 명시

기존 구현 파일들 (authStore, queryClient, errors/) 활용 필수.
```
