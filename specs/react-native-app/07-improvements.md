# 07. 기존 문제점 및 개선 방안

## 개선 요약

분석 결과 발견된 주요 문제점들과 React Native 앱에서의 개선 방안입니다.

---

## 1. 인증 플로우 개선

### 기존 문제점
```
❌ Login.tsx (433줄): 과도한 상태 관리
   - 6개 useState (email, password, error, showPassword, isLoading, modals)
   - 동의 확인 로직 중복 (Login + SignUp)
   - LoginBlockedError 커스텀 에러 클래스

❌ SignUp.tsx (603줄): 검증 로직 산재
   - 6개 핸들러 함수에 실시간 검증 분산
   - 비밀번호 검증 2곳 중복
   - 동의 관리자 강결합
```

### 개선 방안
```typescript
// ✅ React Hook Form + Zod 통합
// app/(auth)/login.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/schemas/auth.schema';

export default function LoginScreen() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useLoginMutation();

  return (
    <FormProvider {...form}>
      <FormField name="email" label="이메일" type="email" />
      <FormField name="password" label="비밀번호" type="password" />
      <Button
        onPress={form.handleSubmit((data) => loginMutation.mutate(data))}
        loading={loginMutation.isPending}
      >
        로그인
      </Button>
    </FormProvider>
  );
}

// ✅ 통합 인증 스키마
// src/schemas/auth.schema.ts
export const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

export const signupSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z
    .string()
    .min(8, '8자 이상 입력하세요')
    .regex(/[A-Za-z]/, '영문을 포함하세요')
    .regex(/[0-9]/, '숫자를 포함하세요'),
  confirmPassword: z.string(),
  name: z.string().min(2, '2자 이상 입력하세요'),
  phone: z.string().regex(/^01[0-9]-\d{4}-\d{4}$/, '올바른 전화번호를 입력하세요'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});
```

### 개선 효과
| 항목 | 기존 | 개선 |
|------|------|------|
| Login 코드 | 433줄 | ~100줄 |
| SignUp 코드 | 603줄 | ~150줄 |
| 검증 위치 | 6곳 분산 | 스키마 1곳 |
| 상태 관리 | 6개 useState | useForm 1개 |

---

## 2. 네비게이션 구조 개선

### 기존 문제점
```
❌ App.tsx (599줄): 모든 라우트 단일 파일
❌ 8단계 Provider 중첩
❌ Feature Flag 분산 처리
❌ PrivateRoute/RoleBasedRoute 중복 검사
```

### 개선 방안
```
✅ Expo Router 파일 기반 라우팅
✅ 그룹별 레이아웃 분리
✅ Provider 3단계로 단순화
✅ 레이아웃에서 권한 체크 통합

기존:
App.tsx (599줄) → 모든 라우트

개선:
app/
├── (auth)/_layout.tsx      # 인증 영역 레이아웃
├── (app)/_layout.tsx       # 앱 영역 레이아웃 + 인증 가드
├── (employer)/_layout.tsx  # 구인자 영역 + 권한 체크
└── (admin)/_layout.tsx     # 관리자 영역 + 권한 체크
```

---

## 3. 상태 관리 통합

### 기존 문제점
```
❌ 3가지 상태 관리 혼용
   - Context API (Auth, Theme)
   - Zustand (unified, toast, tournament, jobPosting, dateFilter)
   - React Query (서버 데이터)

❌ TournamentContextAdapter: deprecated이지만 사용 중
❌ 불명확한 책임 분리
```

### 개선 방안
```typescript
// ✅ 2가지로 통합: Zustand (클라이언트) + Query (서버)

// 클라이언트 상태 → Zustand
// src/stores/authStore.ts     (기존 AuthContext 대체)
// src/stores/themeStore.ts    (기존 ThemeContext 대체)
// src/stores/toastStore.ts    (유지)
// src/stores/modalStore.ts    (신규 - 모달 중앙 관리)
// src/stores/filterStore.ts   (기존 dateFilterStore 통합)

// 서버 상태 → TanStack Query
// - 구인공고, 지원, 스케줄, 알림, 사용자 등
```

### 책임 분리 명확화
| 상태 유형 | 관리 방식 | 예시 |
|----------|----------|------|
| UI 상태 | Zustand | 모달, 토스트, 테마 |
| 세션 데이터 | Zustand | 인증 정보 |
| 필터/폼 | Zustand | 검색 필터, 임시 폼 |
| 서버 데이터 | Query | 공고, 스케줄, 알림 |
| 실시간 데이터 | Query + 구독 | 알림, 채팅 |

---

## 4. 권한 시스템 중앙화

### 기존 문제점
```
❌ 권한 체크 3곳 분산
   - AuthContext: 패널티 체크
   - usePermissions: 기능별 권한
   - 각 페이지: role === 'admin' 직접 체크

❌ JobPostingDetailPage: 76-97줄 복잡한 필터 로직
❌ 권한 캐싱 없음 (매 렌더링 계산)
```

### 개선 방안
```typescript
// ✅ 중앙화된 권한 서비스
// src/services/permission/permissionService.ts

export const permissions = {
  // 역할 기반
  isAdmin: (role: Role) => role === 'admin',
  isEmployer: (role: Role) => role === 'admin' || role === 'employer',  // 구인자 이상
  isStaff: (role: Role) => ['admin', 'employer', 'staff'].includes(role),

  // 기능 기반
  canManageJobPostings: (role: Role) => permissions.isEmployer(role),
  canApproveJobPostings: (role: Role) => permissions.isAdmin(role),
  canManageUsers: (role: Role) => permissions.isAdmin(role),

  // 리소스 기반
  canEditJobPosting: (role: Role, userId: string, creatorId: string) =>
    permissions.isAdmin(role) || userId === creatorId,

  canManageApplicants: (role: Role, userId: string, creatorId: string) =>
    permissions.isEmployer(role) &&
    (permissions.isAdmin(role) || userId === creatorId),
};

// ✅ 훅으로 메모이제이션
// src/hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuthStore();

  return useMemo(() => ({
    isAdmin: permissions.isAdmin(user?.role),
    isEmployer: permissions.isEmployer(user?.role),
    canManageJobPostings: permissions.canManageJobPostings(user?.role),
    // ...
  }), [user?.role]);
}

// ✅ 레이아웃에서 통합 체크
// app/(employer)/_layout.tsx
export default function EmployerLayout() {
  const { canManageJobPostings, isLoading } = usePermissions();

  if (isLoading) return <LoadingScreen />;
  if (!canManageJobPostings) return <Redirect href="/(app)" />;

  return <Stack />;
}
```

---

## 5. 모달 시스템 개선

### 기존 문제점
```
❌ 모달 상태 분산
   - UserManagementPage: isDetailModalOpen, isPenaltyModalOpen, selectedUser
   - 동일 패턴 여러 페이지 반복

❌ ConfirmModal 과잉 설계
   - 별도 styles.ts 파일
   - useConfirmInput 훅
   - Portal 렌더링 (웹 전용)

❌ 모달 스택 미지원
❌ 비동기 모달 미지원 (Promise 반환)
```

### 개선 방안
```typescript
// ✅ 중앙 모달 매니저
// src/stores/modalStore.ts
export const useModalStore = create<ModalState>((set, get) => ({
  modals: [],
  activeModal: null,

  show: (config) => { /* ... */ },
  hide: (id) => { /* ... */ },
  hideAll: () => { /* ... */ },

  // 편의 메서드
  confirm: async ({ title, message, dangerous }) => {
    return new Promise((resolve) => {
      get().show({
        type: 'confirm',
        title,
        message,
        dangerous,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  },

  alert: (title, message) => { /* ... */ },
}));

// ✅ 사용 예시
async function handleDelete() {
  const confirmed = await useModalStore.getState().confirm({
    title: '삭제 확인',
    message: '정말 삭제하시겠습니까?',
    dangerous: true,
  });

  if (confirmed) {
    await deleteItem();
  }
}

// ✅ ModalManager 컴포넌트
// app/_layout.tsx에서 한 번만 렌더링
<ModalManager />
```

### 개선 효과
| 항목 | 기존 | 개선 |
|------|------|------|
| 모달 상태 | 페이지별 useState | 중앙 Store |
| 코드 중복 | 각 페이지 반복 | 재사용 |
| 모달 스택 | 미지원 | 지원 |
| Promise 반환 | 불가 | 가능 |

---

## 6. QR 시스템 개선

### 기존 문제점
```
❌ useStaffQR.ts (243줄): 과잉 설계
   - 3개 인터벌 (refresh, countdown, initial)
   - 수동 인터벌 정리 (메모리 누수 위험)
   - remainingSeconds 중복 계산
```

### 개선 방안
```typescript
// ✅ 단순화된 QR 훅
// src/hooks/useQRCode.ts
import { useCallback, useEffect, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { qrService } from '@/services/qr/qrService';

const QR_REFRESH_INTERVAL = 3 * 60 * 1000; // 3분

export function useQRCode() {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const generateQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await qrService.generatePayload();
      setQrData(data);
      setRemainingTime(QR_REFRESH_INTERVAL / 1000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // 카운트다운 (1초마다)
  useInterval(() => {
    setRemainingTime((prev) => {
      if (prev <= 1) {
        generateQR(); // 자동 갱신
        return QR_REFRESH_INTERVAL / 1000;
      }
      return prev - 1;
    });
  }, 1000);

  return {
    qrData,
    remainingTime,
    isLoading,
    refresh: generateQR,
  };
}

// ✅ useInterval 유틸 훅 (안전한 인터벌)
// src/hooks/useInterval.ts
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

---

## 7. 공고 관리 탭 개선

### 기존 문제점
```
❌ JobPostingDetailPage.tsx: 복잡한 탭 권한 로직
   - availableTabs 필터링 (76-97줄)
   - 권한 체크 중복

❌ 탭 Lazy Loading 불완전
   - Error Boundary 없음
   - 로딩 상태 없음

❌ ApplicantListTab: 500줄+ 예상
   - 일괄 선택/해제
   - 여러 액션 버튼
   - 사전질문 모달
```

### 개선 방안
```
✅ 탭 → 별도 화면으로 분리 (React Navigation)

기존:
/job-posting/:id (탭: applicants, staff, shifts, payroll)

개선:
/job-posting/:id           # 공고 상세 (수정)
/job-posting/:id/applicants  # 지원자 관리
/job-posting/:id/staff       # 확정 스태프
/job-posting/:id/shifts      # 시프트 관리
/job-posting/:id/payroll     # 정산

장점:
- 각 화면 독립적 로딩
- 권한 체크 레이아웃에서 통합
- 코드 분리 명확
- 네이티브 네비게이션 패턴
```

```typescript
// ✅ 레이아웃에서 권한 체크
// app/(employer)/job-posting/[id]/_layout.tsx
export default function JobPostingDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEditJobPosting } = usePermissions();
  const { data: job, isLoading } = useJobPosting(id);

  if (isLoading) return <LoadingScreen />;
  if (!job) return <Redirect href="/(employer)/job-posting" />;
  if (!canEditJobPosting(job.creatorId)) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '공고 상세' }} />
      <Stack.Screen name="applicants" options={{ title: '지원자 관리' }} />
      <Stack.Screen name="staff" options={{ title: '확정 스태프' }} />
      <Stack.Screen name="shifts" options={{ title: '시프트 관리' }} />
      <Stack.Screen name="payroll" options={{ title: '정산' }} />
    </Stack>
  );
}
```

---

## 8. 검증 시스템 통합

### 기존 문제점
```
❌ 3가지 검증 방식 혼용
   - emailValidator.ts (유틸)
   - Zod 스키마
   - 인라인 정규식

❌ 동일 필드 다른 검증
   - 이메일: 3곳에서 다른 방식
   - 전화번호: formatPhoneNumber + 검증 분리
```

### 개선 방안
```typescript
// ✅ Zod 스키마로 통합
// src/schemas/common.schema.ts

// 재사용 가능한 필드 스키마
export const emailField = z
  .string()
  .min(1, '이메일을 입력하세요')
  .email('유효한 이메일 형식이 아닙니다');

export const passwordField = z
  .string()
  .min(8, '8자 이상 입력하세요')
  .regex(/[A-Za-z]/, '영문을 포함하세요')
  .regex(/[0-9]/, '숫자를 포함하세요');

export const phoneField = z
  .string()
  .regex(/^01[0-9]-\d{3,4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다')
  .transform((val) => val.replace(/-/g, '')); // 저장 시 하이픈 제거

export const nameField = z
  .string()
  .min(2, '2자 이상 입력하세요')
  .max(20, '20자 이하로 입력하세요');

// 스키마 조합
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  confirmPassword: z.string(),
  name: nameField,
  phone: phoneField,
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

// ✅ 기존 유틸 함수 제거
// - emailValidator.ts → 삭제
// - passwordValidator.ts → 삭제
// - phoneValidator.ts → 삭제
```

---

## 9. 다크모드 개선

### 기존 문제점
```
❌ 테마 값 하드코딩
   - "bg-white dark:bg-gray-800" 전체 산재
   - 색상 변경 시 전체 검색/치환 필요

❌ 불일치한 색상
   - dark:border-gray-700 vs dark:border-gray-600

❌ 시스템 테마 리스너 비효율
```

### 개선 방안
```typescript
// ✅ 디자인 토큰 정의
// src/constants/colors.ts
export const semanticColors = {
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
  },
  dark: {
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
  },
};

// ✅ useColors 훅
// src/hooks/useColors.ts
export function useColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? semanticColors.dark : semanticColors.light;
}

// ✅ NativeWind 테마 설정
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        // ...
      },
    },
  },
};

// ✅ 컴포넌트에서 사용
function Card({ children }) {
  return (
    <View className="bg-surface rounded-xl p-4 border border-border">
      {children}
    </View>
  );
}
```

---

## 10. 성능 최적화

### 기존 문제점
```
❌ 가상화 미적용 리스트
❌ 이미지 최적화 미흡
❌ 검색 디바운스 미적용
❌ 불필요한 리렌더링
```

### 개선 방안
```typescript
// ✅ FlashList 적용
import { FlashList } from '@shopify/flash-list';

function JobList({ jobs }) {
  return (
    <FlashList
      data={jobs}
      renderItem={({ item }) => <JobCard job={item} />}
      estimatedItemSize={120}
      keyExtractor={(item) => item.id}
    />
  );
}

// ✅ 이미지 최적화 (expo-image)
import { Image } from 'expo-image';

function ProfileImage({ uri }) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash}
      cachePolicy="memory-disk"
      transition={200}
    />
  );
}

// ✅ 검색 디바운스
import { useDebouncedCallback } from 'use-debounce';

function SearchInput({ onSearch }) {
  const debouncedSearch = useDebouncedCallback(onSearch, 300);

  return (
    <Input
      placeholder="검색..."
      onChangeText={debouncedSearch}
    />
  );
}

// ✅ 메모이제이션
const JobCard = memo(function JobCard({ job, onPress }) {
  const handlePress = useCallback(() => {
    onPress(job.id);
  }, [job.id, onPress]);

  return (
    <Pressable onPress={handlePress}>
      {/* ... */}
    </Pressable>
  );
});
```

---

## 개선 효과 요약

| 영역 | 기존 | 개선 | 효과 |
|------|------|------|------|
| 인증 코드 | 1,036줄 | ~250줄 | 75% 감소 |
| Provider 중첩 | 8단계 | 3단계 | 63% 감소 |
| 상태 관리 | 3가지 혼용 | 2가지 통합 | 명확한 책임 |
| 권한 체크 | 3곳 분산 | 1곳 중앙화 | 유지보수 용이 |
| 모달 상태 | 페이지별 | 중앙 Store | 코드 재사용 |
| 검증 방식 | 3가지 | Zod 통합 | 일관성 확보 |
| QR 훅 | 243줄 | ~50줄 | 80% 감소 |
| 리스트 성능 | FlatList | FlashList | 60% 향상 |

---

## 마이그레이션 우선순위

### Phase 1: 기반 구축 (2주)
1. 프로젝트 설정 (Expo, Firebase, NativeWind)
2. 상태 관리 (Zustand stores, Query client)
3. 테마 시스템
4. UI 컴포넌트 기본 세트

### Phase 2: 인증 (1주)
1. 인증 서비스 + 스키마
2. 로그인/회원가입 화면
3. 권한 시스템

### Phase 3: 핵심 기능 (4주)
1. 프로필 화면
2. 구인구직 (목록, 상세, 지원)
3. 내 스케줄

### Phase 4: 관리 기능 (4주)
1. 공고 관리 (작성, 상세)
2. 지원자/스태프 관리
3. 정산

### Phase 5: 부가 기능 (2주)
1. 설정, 고객센터
2. 알림, QR
3. 관리자 기능

### Phase 6: 마무리 (2주)
1. 테스트 및 버그 수정
2. 성능 최적화
3. 앱 스토어 준비
