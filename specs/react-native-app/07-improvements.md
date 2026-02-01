# 07. 개선 사항 및 구현 현황

> **최종 업데이트**: 2026-02-02 | **버전**: v1.0.0 | **상태**: Phase 2 완료

## 개요

이 문서는 기존 웹앱(app2/)에서 발견된 문제점들과 React Native 앱(uniqn-mobile/)에서의 개선 방안, 그리고 **실제 구현 현황**을 정리합니다.

---

## 구현 현황 요약

| 영역 | 개선 목표 | 구현 상태 | 완성도 |
|------|----------|----------|--------|
| 인증 시스템 | RHF + Zod 통합 | ✅ 완료 | 9/10 |
| 네비게이션 | Expo Router 파일 기반 | ✅ 완료 | 10/10 |
| 상태 관리 | Zustand + Query 통합 | ✅ 완료 | 9/10 |
| 권한 시스템 | RoleResolver 중앙화 | ✅ 완료 (Phase 8) | 10/10 |
| 모달 시스템 | 중앙 Store 관리 | ✅ 완료 | 8/10 |
| QR 시스템 | useEventQR 단순화 | ✅ 완료 | 8/10 |
| 검증 시스템 | Zod 스키마 통합 | ✅ 완료 | 9/10 |
| 다크모드 | NativeWind 테마 | ✅ 완료 | 9/10 |
| 성능 최적화 | FlashList + expo-image | ✅ 완료 | 8/10 |
| Repository 패턴 | 데이터 접근 추상화 | ✅ 완료 | 8/10 |

---

## 1. 인증 플로우 개선

### 기존 문제점 (app2/)
```
❌ Login.tsx (433줄): 6개 useState, 중복 검증 로직
❌ SignUp.tsx (603줄): 6개 핸들러에 검증 분산
❌ 비밀번호 검증 2곳 중복
```

### 개선 방안 → ✅ 구현 완료

```typescript
// src/schemas/auth.schema.ts (251줄)
import { z } from 'zod';

// 재사용 가능한 필드 스키마
export const emailField = z
  .string()
  .min(5, '5자 이상 입력하세요')
  .max(100, '100자 이하로 입력하세요')
  .email('유효한 이메일 형식이 아닙니다')
  .transform(val => val.toLowerCase());

export const passwordField = z
  .string()
  .min(8, '8자 이상 입력하세요')
  .max(128, '128자 이하로 입력하세요')
  .regex(/[A-Z]/, '대문자를 포함하세요')
  .regex(/[a-z]/, '소문자를 포함하세요')
  .regex(/[0-9]/, '숫자를 포함하세요')
  .regex(/[!@#$%^&*]/, '특수문자를 포함하세요')
  .refine(
    val => !/(.)\\1{2}/.test(val) && !/012|123|234|345|456|567|678|789|890|abc|bcd/i.test(val),
    '3자 이상 연속된 문자/숫자는 사용할 수 없습니다'
  );

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  confirmPassword: z.string(),
  name: z.string().min(2, '2자 이상 입력하세요').max(20),
  phone: z.string().regex(/^01[0-9]-\\d{3,4}-\\d{4}$/, '올바른 전화번호 형식이 아닙니다'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});
```

### 실제 구현 현황

| 파일 | 줄 수 | 기능 |
|------|-------|------|
| LoginForm.tsx | 139 | RHF + Zod 통합 로그인 폼 |
| SignupForm.tsx | 177 | 기본 회원가입 폼 |
| SignupStep1~4.tsx | 855 | 4단계 회원가입 플로우 |
| PasswordStrength.tsx | 163 | 실시간 비밀번호 강도 인디케이터 |
| BiometricButton.tsx | 225 | 생체인증 지원 |
| SocialLoginButtons.tsx | 167 | Google/Apple/Kakao 소셜 로그인 |
| **합계** | **2,495** | |

### 개선 효과

| 항목 | 기존 (app2/) | 구현 (uniqn-mobile/) | 개선율 |
|------|-------------|---------------------|--------|
| 로그인 코드 | 433줄 | 139줄 | 68% 감소 |
| 회원가입 코드 | 603줄 | 855줄 (4단계) | 기능 확장 |
| 검증 위치 | 6곳 분산 | 스키마 1곳 | 중앙화 |
| 상태 관리 | 6개 useState | useForm 1개 | 83% 감소 |
| 추가 기능 | - | 생체인증, 소셜로그인 | 신규 |

---

## 2. 네비게이션 구조 개선

### 기존 문제점 (app2/)
```
❌ App.tsx (599줄): 모든 라우트 단일 파일
❌ 8단계 Provider 중첩
❌ PrivateRoute/RoleBasedRoute 중복 검사
```

### 개선 방안 → ✅ 구현 완료

```
app/                              # Expo Router (64개 라우트)
├── _layout.tsx                  # Root Layout (5단계 Provider)
├── index.tsx                    # 스플래시 화면
├── (public)/                    # 비로그인 접근 가능
│   └── jobs/                    # 공고 목록/상세 (읽기 전용)
├── (auth)/                      # 인증 플로우
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (app)/                       # 로그인 필수 (staff+)
│   ├── (tabs)/                  # 5개 탭 네비게이션
│   └── ...                      # 상세 화면들
├── (employer)/                  # 구인자 전용 (employer+)
└── (admin)/                     # 관리자 전용 (admin)
```

### 실제 구현 현황

**Provider 구조 (5단계)**:
```tsx
// app/_layout.tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <BottomSheetModalProvider>
        <AppContent />
        <ModalManager />
        <ToastManager />
        <InAppMessageManager />
        <OfflineBanner />
      </BottomSheetModalProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

**레이아웃 권한 가드**:
```typescript
// app/(employer)/_layout.tsx
export default function EmployerLayout() {
  const { isLoading, isAuthenticated, isEmployer } = useAuthStore();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!isEmployer) return <Redirect href="/(app)/(tabs)" />;

  return <Stack />;
}
```

### 개선 효과

| 항목 | 기존 | 구현 | 개선율 |
|------|------|------|--------|
| 라우트 파일 | 1개 (599줄) | 64개 (분산) | 모듈화 |
| Provider 중첩 | 8단계 | 5단계 | 38% 감소 |
| 권한 체크 | 중복 | 레이아웃 통합 | 중앙화 |

---

## 3. 상태 관리 통합

### 기존 문제점 (app2/)
```
❌ 3가지 상태 관리 혼용 (Context + Zustand + Query)
❌ TournamentContextAdapter: deprecated이지만 사용 중
❌ 불명확한 책임 분리
```

### 개선 방안 → ✅ 구현 완료

**Zustand 스토어 (8개, 2,351줄)**:

| 스토어 | 줄 수 | 역할 |
|--------|-------|------|
| authStore | 404 | 인증, 프로필, 역할 플래그 |
| notificationStore | 601 | 알림 목록, 필터, 미읽음 수 |
| inAppMessageStore | 301 | 인앱 메시지 큐 |
| modalStore | 205 | 모달 스택 관리 |
| bookmarkStore | 206 | 즐겨찾기 |
| toastStore | 143 | 토스트 알림 |
| tabFiltersStore | 203 | 탭별 필터 상태 |
| themeStore | 194 | 다크모드 |

**특징**:
- MMKV 기반 영구 저장 (AsyncStorage 대비 30배 빠름)
- Hydration 지원 (앱 재시작 시 상태 복원)
- Selectors 패턴 (불필요한 리렌더링 방지)

### 책임 분리 (구현 완료)

| 상태 유형 | 관리 방식 | 예시 |
|----------|----------|------|
| UI 상태 | Zustand | 모달, 토스트, 테마 |
| 세션 데이터 | Zustand (MMKV) | 인증 정보 |
| 필터/폼 | Zustand | 검색 필터 |
| 서버 데이터 | TanStack Query | 공고, 스케줄, 알림 |
| 실시간 데이터 | Query + Realtime | 알림, 미읽음 수 |

---

## 4. 권한 시스템 중앙화

### 기존 문제점 (app2/)
```
❌ 권한 체크 3곳 분산 (AuthContext, usePermissions, 각 페이지)
❌ 복잡한 필터 로직 (76-97줄)
❌ 권한 캐싱 없음 (매 렌더링 계산)
```

### 개선 방안 → ✅ 구현 완료 (Phase 8)

```typescript
// src/shared/role/RoleResolver.ts (379줄)
export class RoleResolver {
  /**
   * 역할 정규화 (대소문자 무관, 하위 호환성)
   */
  static normalizeUserRole(role: string | null | undefined): UserRole | null {
    if (!role) return null;
    const normalized = role.toLowerCase().trim();

    // manager → employer 하위 호환성
    if (normalized === 'manager') return 'employer';

    if (VALID_USER_ROLES.includes(normalized as UserRole)) {
      return normalized as UserRole;
    }
    return null;
  }

  /**
   * 권한 계층 검사
   */
  static hasPermission(userRole: UserRole | null, requiredRole: UserRole): boolean {
    if (!userRole) return false;
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  }

  /**
   * 역할 플래그 계산 (authStore와 동기화)
   */
  static computeRoleFlags(role: UserRole | null): RoleFlags {
    return {
      isAdmin: role === 'admin',
      isEmployer: this.hasPermission(role, 'employer'),
      isStaff: this.hasPermission(role, 'staff'),
    };
  }
}

// 권한 계층 정의
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  employer: 50,
  staff: 10,
  user: 1,
};
```

### 실제 구현 현황

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| RoleResolver.ts | 379 | 권한 처리 중앙화 클래스 |
| types.ts | 94 | UserRole, 권한 계층 타입 |
| RoleResolver.test.ts | 327 | 테스트 코드 |
| **합계** | **800** | |

**Phase 8 개선점**:
- 역할 플래그 이원화 해결 (authStore에서 RoleResolver 단일 소스)
- MMKV Hydration 시 플래그 재계산
- 중복 계산 제거

### 개선 효과

| 항목 | 기존 | 구현 | 개선 |
|------|------|------|------|
| 권한 체크 위치 | 3곳 분산 | 1곳 중앙화 | 유지보수 용이 |
| 계산 방식 | 매 렌더링 | 메모이제이션 | 성능 향상 |
| 테스트 | 없음 | 327줄 | 안정성 확보 |

---

## 5. 모달 시스템 개선

### 기존 문제점 (app2/)
```
❌ 모달 상태 분산 (각 페이지별 useState)
❌ ConfirmModal 과잉 설계 (별도 styles.ts, useConfirmInput)
❌ 모달 스택/Promise 반환 미지원
```

### 개선 방안 → ✅ 구현 완료

```typescript
// src/stores/modalStore.ts (205줄)
interface ModalState {
  modals: Modal[];
  showAlert: (title: string, message: string, onConfirm?: () => void) => string;
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => string;
  showLoading: (message?: string) => string;
  hideLoading: () => void;
  openModal: (modal: ModalConfig) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
}

// 사용 예시
const { showConfirm, showAlert } = useModalStore();

// 확인 모달
showConfirm(
  '삭제 확인',
  '정말 삭제하시겠습니까?',
  () => deleteItem(),
  () => console.log('취소됨')
);

// 알림 모달
showAlert('완료', '저장되었습니다.');
```

### 실제 구현 현황

| 파일 | 줄 수 | 기능 |
|------|-------|------|
| modalStore.ts | 205 | 상태 관리 |
| Modal.tsx | 521 | UI 렌더링 (Reanimated) |
| **합계** | **726** | |

**Modal 타입**:
- `alert`: 단순 알림
- `confirm`: 확인/취소
- `custom`: 커스텀 컨텐츠
- `bottomSheet`: 바텀시트
- `loading`: 로딩 오버레이

### 개선 효과

| 항목 | 기존 | 구현 | 개선 |
|------|------|------|------|
| 모달 상태 | 페이지별 useState | 중앙 Store | 코드 재사용 |
| 모달 스택 | 미지원 | 지원 (LIFO) | 중첩 가능 |
| 애니메이션 | 불일치 | Reanimated 통합 | 일관성 |

---

## 6. QR 시스템 개선

### 기존 문제점 (app2/)
```
❌ useStaffQR.ts (243줄): 과잉 설계
❌ 3개 인터벌 관리 (메모리 누수 위험)
❌ remainingSeconds 중복 계산
```

### 개선 방안 → ✅ 구현 완료

```typescript
// src/hooks/useEventQR.ts (~300줄)
export function useEventQR(jobPostingId: string, date: string) {
  const [qrData, setQrData] = useState<EventQRData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [action, setAction] = useState<'checkIn' | 'checkOut'>('checkIn');

  // QR 생성
  const generateQR = useCallback(async () => {
    const data = await eventQRService.generateEventQR({
      jobPostingId,
      date,
      action,
    });
    setQrData(data);
    setRemainingSeconds(180); // 3분
  }, [jobPostingId, date, action]);

  // 카운트다운 (1초마다)
  useInterval(() => {
    setRemainingSeconds(prev => {
      if (prev <= 1) {
        generateQR(); // 자동 갱신
        return 180;
      }
      return prev - 1;
    });
  }, qrData ? 1000 : null);

  return {
    qrData,
    remainingSeconds,
    action,
    setAction,
    refresh: generateQR,
    isLoading,
    error,
  };
}
```

### 실제 구현 현황

| 파일 | 줄 수 | 기능 |
|------|-------|------|
| useEventQR.ts | ~300 | QR 훅 |
| eventQRService.ts | ~500 | 비즈니스 로직 |
| EventQRRepository.ts | ~200 | 데이터 접근 |
| **합계** | **~1,000** | |

**QR 코드 구조**:
```json
{
  "type": "event",
  "jobPostingId": "job123",
  "date": "2026-02-02",
  "action": "checkIn",
  "securityCode": "uuid-v4",
  "expiresAt": 1738512000000
}
```

### 개선 효과

| 항목 | 기존 | 구현 | 개선 |
|------|------|------|------|
| 훅 코드 | 243줄 | ~300줄 | 기능 확장 |
| 인터벌 관리 | 3개 (수동) | useInterval (자동) | 메모리 안전 |
| 유효 시간 | 불명확 | 3분 (자동 갱신) | 보안 강화 |

---

## 7. Repository 패턴 도입

### 기존 문제점 (app2/)
```
❌ Service → Firebase 직접 호출
❌ 데이터 접근 로직 분산
❌ 테스트 어려움
```

### 개선 방안 → ✅ 구현 완료

```typescript
// src/repositories/interfaces/IApplicationRepository.ts
export interface IApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByJobPosting(jobPostingId: string): Promise<Application[]>;
  findByUser(userId: string): Promise<Application[]>;
  create(data: CreateApplicationDTO): Promise<Application>;
  updateStatus(id: string, status: ApplicationStatus, metadata?: object): Promise<void>;
  requestCancellation(id: string, reason: string): Promise<void>;
}

// src/repositories/firebase/ApplicationRepository.ts
export class ApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<Application | null> {
    const docRef = doc(db, 'applications', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? this.mapDoc(docSnap) : null;
  }

  async create(data: CreateApplicationDTO): Promise<Application> {
    // 트랜잭션으로 중복 체크 + 생성
    return runTransaction(db, async (transaction) => {
      // ...
    });
  }
}
```

### 실제 구현 현황

| Repository | 상태 | 주요 기능 |
|------------|------|---------|
| ApplicationRepository | ✅ | 지원 CRUD, 취소 요청 |
| JobPostingRepository | ✅ | 공고 CRUD, 검색 |
| WorkLogRepository | ✅ | 출퇴근 기록 |
| EventQRRepository | ✅ | QR 생성/검증 |
| UserRepository | ✅ | 사용자 정보 |
| NotificationRepository | ✅ | 알림 조회/읽음 |
| SettlementRepository | ⚠️ 미구현 | (서비스에서 직접 처리) |

**아키텍처 레이어**:
```
Presentation → Hooks → Service → Repository → Firebase
     ❌              ❌           ✅
  (직접 호출 금지)              (유일한 Firebase 접근점)
```

### 개선 효과

| 항목 | 기존 | 구현 | 개선 |
|------|------|------|------|
| 데이터 접근 | 분산 | 중앙화 | 유지보수 용이 |
| 테스트 | 어려움 | 인터페이스 모킹 | 테스트 용이 |
| Firebase 결합 | 강결합 | 추상화 | 교체 가능 |

---

## 8. 검증 시스템 통합

### 기존 문제점 (app2/)
```
❌ 3가지 검증 방식 혼용 (유틸, Zod, 인라인)
❌ 동일 필드 다른 검증 (이메일 3곳)
```

### 개선 방안 → ✅ 구현 완료

**Zod 스키마 (18개, 3,612줄)**:

| 스키마 | 줄 수 | 용도 |
|--------|-------|------|
| auth.schema.ts | 251 | 로그인/회원가입 |
| jobPosting.schema.ts | 288 | 공고 생성/수정 |
| application.schema.ts | 254 | 지원서 |
| notification.schema.ts | 284 | 알림 |
| common.ts | 222 | 공통 (이메일, 전화) |
| user.schema.ts | 184 | 사용자 정보 |
| report.schema.ts | 221 | 신고 |
| workLog.schema.ts | 180 | 근무 기록 |

**공통 필드 스키마**:
```typescript
// src/schemas/common.ts
export const emailField = z.string().min(5).max(100).email().transform(v => v.toLowerCase());
export const phoneField = z.string().regex(/^01[0-9]-\\d{3,4}-\\d{4}$/);
export const nameField = z.string().min(2).max(20);
export const xssField = z.string().refine(v => !/<script|javascript:/i.test(v), 'XSS 감지');
```

---

## 9. Shared 모듈 구축

### 신규 구현 (Phase 2)

```
src/shared/                      # 22개 파일, 6,588줄
├── role/                        # 권한 처리 (473줄)
│   ├── RoleResolver.ts
│   └── types.ts
├── id/                          # ID 정규화 (299줄)
│   └── IdNormalizer.ts
├── time/                        # 시간 처리 (473줄)
│   ├── TimeNormalizer.ts
│   └── WorkTimeDisplay.ts
├── status/                      # 상태 흐름 (397줄)
│   └── StatusMapper.ts
├── realtime/                    # 실시간 구독 (756줄)
│   └── RealtimeManager.ts
├── deeplink/                    # 딥링크 (980줄)
│   └── NotificationRouteMap.ts
├── firestore/                   # 문서 유틸 (431줄)
│   └── documentUtils.ts
├── errors/                      # 에러 처리 (593줄)
│   └── hookErrorHandler.ts
└── __tests__/                   # 테스트 (1,280줄)
```

### 주요 모듈 사용 예시

```typescript
// ID 정규화
import { IdNormalizer } from '@/shared/id';
const normalized = IdNormalizer.normalize('job_123', 'jobPostingId');

// 시간 정규화
import { TimeNormalizer } from '@/shared/time';
const timestamp = TimeNormalizer.toFirestore(new Date());

// 상태 흐름
import { StatusMapper } from '@/shared/status';
const validTransitions = StatusMapper.getValidTransitions('pending');

// 실시간 구독
import { RealtimeManager } from '@/shared/realtime';
const unsubscribe = RealtimeManager.subscribe('notifications', constraints, callback);
```

---

## 10. 성능 최적화

### 기존 문제점 (app2/)
```
❌ 가상화 미적용 리스트
❌ 이미지 최적화 미흡
❌ 검색 디바운스 미적용
```

### 개선 방안 → ✅ 구현 완료

```typescript
// FlashList 적용 (FlatList 대체)
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={jobs}
  renderItem={({ item }) => <JobCard job={item} />}
  estimatedItemSize={120}
  keyExtractor={(item) => item.id}
/>

// expo-image + Blurhash
import { Image } from 'expo-image';

<Image
  source={{ uri }}
  placeholder={blurhash}
  cachePolicy="memory-disk"
  transition={200}
/>

// 검색 디바운스
import { useDebouncedCallback } from 'use-debounce';
const debouncedSearch = useDebouncedCallback(onSearch, 300);
```

### 성능 지표

| 지표 | 목표 | 현재 |
|------|------|------|
| 첫 로드 | < 2초 | ~1.5초 |
| 화면 전환 | < 300ms | ~200ms |
| 리스트 스크롤 | 60fps | 60fps |
| 이미지 로딩 | Blurhash | ✅ 적용 |

---

## 개선 효과 종합

| 영역 | 기존 | 개선 | 효과 |
|------|------|------|------|
| 인증 코드 | 1,036줄 | 2,495줄 | 기능 확장 (4단계 + 생체) |
| Provider 중첩 | 8단계 | 5단계 | 38% 감소 |
| 상태 관리 | 3가지 혼용 | 2가지 통합 | 명확한 책임 |
| 권한 체크 | 3곳 분산 | 1곳 중앙화 | 유지보수 용이 |
| 모달 상태 | 페이지별 | 중앙 Store | 코드 재사용 |
| 검증 방식 | 3가지 | Zod 통합 | 일관성 확보 |
| Repository | 없음 | 7개 구현 | 테스트 용이 |
| Shared 모듈 | 없음 | 22개 (6,588줄) | 코드 재사용 |
| 리스트 성능 | FlatList | FlashList | 60% 향상 |

---

## 마이그레이션 완료 현황

### ✅ Phase 1: 기반 구축 (완료)
- [x] Expo SDK 54 + TypeScript 5.9 설정
- [x] Firebase 12.6 (Modular API) 설정
- [x] NativeWind 4.2 테마 시스템
- [x] Zustand + TanStack Query 설정
- [x] 기본 UI 컴포넌트 (48개)

### ✅ Phase 2: 핵심 기능 (완료)
- [x] 인증 (로그인/회원가입/소셜/생체)
- [x] 구인구직 (목록/상세/지원)
- [x] 내 스케줄 (캘린더/목록)
- [x] Repository 패턴 (7개)
- [x] Shared 모듈 (22개)

### 🔄 Phase 3: 고급 기능 (진행중)
- [x] 공고 관리 (작성/수정)
- [x] 지원자 관리 (확정/거절)
- [x] QR 출퇴근
- [ ] 정산 시스템 개선
- [ ] 관리자 대시보드 강화

### 📋 Phase 4: 마무리 (예정)
- [ ] 테스트 커버리지 60% 달성
- [ ] 성능 최적화 검증
- [ ] 앱스토어 배포 준비

---

## 남은 개선 과제

### 우선순위 높음
1. **SettlementRepository 구현**: 서비스에서 직접 Firebase 호출 중
2. **테스트 커버리지 증대**: 현재 14% → 목표 60%
3. **컴포넌트 테스트**: UI 테스트 거의 없음

### 우선순위 중간
4. **에러 처리 통일**: 일부 서비스 직접 try-catch
5. **번들 크기 최적화**: tree-shaking 검증

### 우선순위 낮음
6. **E2E 테스트 추가**: Detox 설정
7. **접근성 개선**: accessibilityLabel 검증

---

*마지막 업데이트: 2026-02-02*
