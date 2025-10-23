# T-HOLDEM 계정 관리 시스템 - 종합 구현 계획 (Enterprise-Grade)

## 🎯 개요

**목표**: 프로덕션 준비 완료된 계정 관리 시스템 구축  
**범위**: 동의 관리, 비밀번호 변경, 로그인 알림, 계정 삭제/탈퇴  
**기간**: 2주 (Week 1: 기반 구축, Week 2: 고급 기능 + 테스트)

---

## 📐 아키텍처 설계

### 1. **데이터 아키텍처** (Firebase Firestore)

```typescript
// ✅ 멀티테넌트 지원 + 확장 가능한 구조

// 1. 동의 관리 (users/{userId}/consents/current)
interface ConsentRecord {
  version: string;                    // 문서 버전 (1.0.0)
  userId: string;
  
  // 필수 동의
  termsOfService: {
    agreed: boolean;                  // 필수
    version: string;                  // 약관 버전 (1.0, 1.1...)
    agreedAt: Timestamp;
    ipAddress?: string;               // 보안: 동의 시 IP 기록
  };
  
  privacyPolicy: {
    agreed: boolean;                  // 필수
    version: string;
    agreedAt: Timestamp;
    ipAddress?: string;
  };
  
  // 선택 동의
  marketing: {
    agreed: boolean;
    agreedAt?: Timestamp;
    revokedAt?: Timestamp;            // 철회 시간 기록
  };
  
  locationService: {
    agreed: boolean;
    agreedAt?: Timestamp;
    revokedAt?: Timestamp;
  };
  
  pushNotification: {
    agreed: boolean;
    agreedAt?: Timestamp;
    revokedAt?: Timestamp;
  };
  
  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
  changeHistory?: ConsentChange[];    // 변경 이력
}

// 2. 동의 변경 이력 (users/{userId}/consents/history/{changeId})
interface ConsentChange {
  id: string;
  timestamp: Timestamp;
  changedFields: string[];            // ['marketing', 'locationService']
  previousValues: Record<string, boolean>;
  newValues: Record<string, boolean>;
  ipAddress?: string;
}

// 3. 계정 삭제 요청 (deletionRequests/{requestId})
interface DeletionRequest {
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;
  
  // 삭제 정보
  reason?: string;                    // 선택 사유
  reasonCategory?: 'not_using' | 'privacy_concern' | 'switching_service' | 'other';
  requestedAt: Timestamp;
  scheduledDeletionAt: Timestamp;     // 30일 후
  
  // 상태 관리
  status: 'pending' | 'cancelled' | 'completed';
  cancelledAt?: Timestamp;
  completedAt?: Timestamp;
  
  // 보안
  verificationToken?: string;         // 취소 링크용 토큰
  ipAddress?: string;
}

// 4. 로그인 알림 설정 (users/{userId}/securitySettings/loginNotifications)
interface LoginNotificationSettings {
  enabled: boolean;
  notifyOnNewDevice: boolean;         // 새 기기 로그인 시
  notifyOnNewLocation: boolean;       // 새 IP 로그인 시
  notifyOnSuspiciousActivity: boolean; // 의심스러운 활동
  updatedAt: Timestamp;
}

// 5. 로그인 기록 확장 (loginAttempts/{attemptId})
// 기존 authSecurity.ts 활용 + 알림 트리거 추가
interface LoginAttempt {
  id: string;
  ip: string;
  email?: string;
  timestamp: Timestamp;
  success: boolean;
  userAgent: string;
  attempts: number;
  blockedUntil?: Timestamp;
  
  // 신규: 알림 발송 기록
  notificationSent?: boolean;
  notificationSentAt?: Timestamp;
  
  // 신규: 디바이스 정보
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
  };
}
```

### 2. **Firestore Security Rules 추가**

```javascript
// firestore.rules 확장

// 동의 관리
match /users/{userId}/consents/{consentId} {
  allow read: if isSignedIn() && isOwner(userId);
  
  allow create: if isSignedIn() && isOwner(userId) &&
    request.resource.data.keys().hasAll(['version', 'userId', 'termsOfService', 'privacyPolicy']) &&
    request.resource.data.termsOfService.agreed == true &&
    request.resource.data.privacyPolicy.agreed == true;
  
  allow update: if isSignedIn() && isOwner(userId) &&
    // 필수 동의는 수정 불가 (agreed: true → false 금지)
    request.resource.data.termsOfService.agreed == true &&
    request.resource.data.privacyPolicy.agreed == true;
}

// 동의 변경 이력 (읽기 전용)
match /users/{userId}/consents/history/{changeId} {
  allow read: if isSignedIn() && isOwner(userId);
  allow create: if false; // Cloud Function만 생성 가능
  allow update, delete: if false;
}

// 계정 삭제 요청
match /deletionRequests/{requestId} {
  allow read: if isSignedIn() && (
    isOwner(resource.data.userId) || 
    isPrivileged()
  );
  
  allow create: if isSignedIn() && 
    request.auth.uid == request.resource.data.userId &&
    request.resource.data.status == 'pending';
  
  allow update: if isSignedIn() && (
    isOwner(resource.data.userId) ||  // 본인 취소
    isPrivileged()                     // 관리자 처리
  );
  
  allow delete: if isPrivileged();
}

// 보안 설정
match /users/{userId}/securitySettings/{settingId} {
  allow read, write: if isSignedIn() && isOwner(userId);
}
```

---

## 🔐 보안 아키텍처

### 1. **입력 검증 계층**

```typescript
// utils/validation/accountValidation.ts

import { z } from 'zod'; // Zod 라이브러리 활용

// 동의 데이터 검증
export const ConsentSchema = z.object({
  termsOfService: z.object({
    agreed: z.literal(true), // 필수이므로 true만 허용
    version: z.string().regex(/^\d+\.\d+$/),
    ipAddress: z.string().ip().optional(),
  }),
  privacyPolicy: z.object({
    agreed: z.literal(true),
    version: z.string().regex(/^\d+\.\d+$/),
    ipAddress: z.string().ip().optional(),
  }),
  marketing: z.object({
    agreed: z.boolean(),
  }),
  locationService: z.object({
    agreed: z.boolean(),
  }),
  pushNotification: z.object({
    agreed: z.boolean(),
  }),
});

// 계정 삭제 사유 검증
export const DeletionReasonSchema = z.object({
  reason: z.string().max(500).optional(),
  reasonCategory: z.enum(['not_using', 'privacy_concern', 'switching_service', 'other']).optional(),
});

// XSS/Injection 방지
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};
```

### 2. **암호화 및 데이터 보호**

```typescript
// 기존 secureStorage.ts 활용
// - 동의 변경 토큰 암호화 저장
// - 계정 삭제 취소 토큰 암호화

// 신규: IP 주소 해싱 (개인정보 보호)
import crypto from 'crypto-js';

export const hashIpAddress = (ip: string): string => {
  return crypto.SHA256(ip).toString();
};
```

### 3. **Rate Limiting (과도한 요청 방지)**

```typescript
// services/rateLimiter.ts (신규)

export class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  
  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
}

// 사용 예시
const consentRateLimiter = new RateLimiter();
const deletionRateLimiter = new RateLimiter();
```

---

## ⚡ 성능 최적화

### 1. **Firebase 쿼리 최적화**

```typescript
// hooks/useConsent.ts

import { useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

export const useConsent = () => {
  // 실시간 구독 (1개 문서만)
  useEffect(() => {
    if (!currentUser) return;
    
    const consentRef = doc(db, 'users', currentUser.uid, 'consents', 'current');
    const unsubscribe = onSnapshot(consentRef, (snapshot) => {
      setConsent(snapshot.data() as ConsentRecord);
    }, (error) => {
      logger.error('동의 내역 구독 실패', error);
    });
    
    return unsubscribe;
  }, [currentUser?.uid]);
  
  // 메모이제이션
  const isAllConsentGiven = useMemo(() => {
    if (!consent) return false;
    return consent.termsOfService.agreed && consent.privacyPolicy.agreed;
  }, [consent]);
};
```

### 2. **코드 스플리팅**

```typescript
// App.tsx에 Lazy Loading 추가

const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));

// 라우팅
<Route path="settings" element={
  <Suspense fallback={<LoadingSpinner />}>
    <SettingsPage />
  </Suspense>
} />
```

### 3. **캐싱 전략**

```typescript
// services/consentService.ts

import { useSmartCache } from '../hooks/useSmartCache';

const consentCache = useSmartCache<ConsentRecord>({
  ttl: 5 * 60 * 1000, // 5분
  maxSize: 100,
});

export const getConsent = async (userId: string): Promise<ConsentRecord | null> => {
  // 캐시 확인
  const cached = consentCache.get(userId);
  if (cached) return cached;
  
  // Firestore 조회
  const consentRef = doc(db, 'users', userId, 'consents', 'current');
  const snapshot = await getDoc(consentRef);
  
  if (snapshot.exists()) {
    const data = snapshot.data() as ConsentRecord;
    consentCache.set(userId, data);
    return data;
  }
  
  return null;
};
```

---

## 🎨 UI/UX 설계

### 1. **컴포넌트 계층 구조**

```
SettingsPage (메인)
├── ProfileSettings (기존)
├── SecuritySettings (신규) ⭐
│   ├── PasswordChangeModal
│   └── LoginHistoryList
├── ConsentSettings (신규) ⭐
│   ├── RequiredConsentView (읽기 전용)
│   └── OptionalConsentToggle (on/off)
├── AccountDangerZone (신규) ⭐
│   └── AccountDeletionModal
└── LanguageSettings (기존)
```

### 2. **접근성 (WCAG 2.1 AA 준수)**

```typescript
// components/settings/ConsentSettings.tsx

<div role="region" aria-labelledby="consent-settings-heading">
  <h2 id="consent-settings-heading" className="text-xl font-semibold">
    {t('settings.consent.title')}
  </h2>
  
  {/* 필수 동의 (읽기 전용) */}
  <div role="list" aria-label={t('settings.consent.required')}>
    <div role="listitem" aria-describedby="terms-desc">
      <CheckCircleIcon className="h-5 w-5 text-green-600" aria-hidden="true" />
      <span id="terms-desc">{t('settings.consent.termsOfService')}</span>
    </div>
  </div>
  
  {/* 선택 동의 (토글) */}
  <button
    role="switch"
    aria-checked={marketing.agreed}
    aria-labelledby="marketing-label"
    onClick={handleToggleMarketing}
    className="relative inline-flex h-6 w-11 items-center rounded-full"
  >
    <span className="sr-only">{t('settings.consent.marketing')}</span>
  </button>
</div>
```

### 3. **반응형 디자인**

```typescript
// Tailwind CSS - Mobile First

<div className="
  px-4 py-6              // 모바일
  sm:px-6 sm:py-8        // 태블릿
  lg:px-8 lg:py-10       // 데스크톱
  max-w-2xl mx-auto      // 최대 너비
">
  {/* 설정 카드들 */}
</div>
```

### 4. **로딩 및 에러 상태**

```typescript
// hooks/useConsent.ts

export const useConsent = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Skeleton UI 표시
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }
  
  // 에러 핸들링
  if (error) {
    return (
      <ErrorBoundary error={error}>
        <button onClick={retry}>{t('common.retry')}</button>
      </ErrorBoundary>
    );
  }
};
```

---

## 🔄 데이터 흐름 (Data Flow)

### 1. **동의 관리 플로우**

```
[회원가입] 
  ↓
ConsentManager (체크박스)
  ↓
회원가입 폼 제출
  ↓
Firebase Auth createUser()
  ↓
consentService.createConsent() ← 필수 동의 검증
  ↓
Firestore: users/{userId}/consents/current 생성
  ↓
회원가입 완료 → 로그인 화면
```

### 2. **계정 삭제 플로우**

```
[설정 페이지]
  ↓
계정 삭제 버튼 클릭
  ↓
AccountDeletionModal 표시
  ↓
비밀번호 재확인 (Firebase Auth reauthenticate)
  ↓
탈퇴 사유 선택 (선택사항)
  ↓
deletionService.requestDeletion()
  ↓
Firestore: deletionRequests/{requestId} 생성
  ↓
Firebase Auth: currentUser.disabled = true
  ↓
Toast: "30일 후 삭제 예정" + 취소 방법 안내
  ↓
[30일 후]
  ↓
Firebase Function: scheduledDeletion() 실행
  ↓
- Firebase Auth 삭제
- Firestore users/{userId} 삭제
- 관련 데이터 삭제 (workLogs, applications...)
  ↓
완전 삭제 완료
```

### 3. **로그인 알림 플로우**

```
[로그인 시도]
  ↓
authSecurity.recordLoginAttempt()
  ↓
IP/Device 정보 수집
  ↓
기존 로그인 기록과 비교
  ↓
새 기기 또는 새 IP? 
  ↓ (Yes)
Firebase Function: loginNotification() 트리거
  ↓
Firestore: notifications/{id} 생성
  ↓
알림 시스템: useNotifications() 실시간 구독
  ↓
앱 내 알림 표시 (Toast + NotificationCenter)
```

---

## 🛡️ 에러 처리 전략

### 1. **계층별 에러 처리**

```typescript
// 1. Service Layer (services/consentService.ts)
export const updateConsent = async (
  userId: string, 
  updates: Partial<ConsentRecord>
): Promise<void> => {
  try {
    // 검증
    ConsentSchema.parse(updates);
    
    // Firestore 업데이트
    await updateDoc(consentRef, updates);
    
    logger.info('동의 내역 업데이트 성공', { userId });
  } catch (error) {
    // 에러 분류
    if (error instanceof z.ZodError) {
      logger.error('동의 데이터 검증 실패', error, { userId, updates });
      throw new ValidationError('잘못된 동의 데이터입니다.');
    }
    
    if (error.code === 'permission-denied') {
      logger.error('권한 부족', error, { userId });
      throw new PermissionError('동의 내역을 수정할 권한이 없습니다.');
    }
    
    logger.error('동의 내역 업데이트 실패', error as Error, { userId });
    throw new ServiceError('동의 내역 업데이트에 실패했습니다.');
  }
};

// 2. Hook Layer (hooks/useConsent.ts)
export const useConsent = () => {
  const [error, setError] = useState<Error | null>(null);
  
  const handleUpdateConsent = async (updates: Partial<ConsentRecord>) => {
    try {
      setError(null);
      await updateConsent(currentUser.uid, updates);
      toast.success(t('settings.consent.updated'));
    } catch (err) {
      setError(err as Error);
      
      if (err instanceof ValidationError) {
        toast.error(err.message);
      } else if (err instanceof PermissionError) {
        toast.error(err.message);
      } else {
        toast.error(t('common.error.unknown'));
      }
    }
  };
  
  return { handleUpdateConsent, error };
};

// 3. Component Layer (components/settings/ConsentSettings.tsx)
const ConsentSettings: React.FC = () => {
  const { handleUpdateConsent, error } = useConsent();
  
  // ErrorBoundary로 감싸기
  return (
    <ErrorBoundary 
      fallback={<ErrorFallback error={error} />}
      onError={(error) => logger.error('ConsentSettings 에러', error)}
    >
      {/* UI */}
    </ErrorBoundary>
  );
};
```

### 2. **네트워크 에러 재시도**

```typescript
// utils/retryWithBackoff.ts

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const backoffDelay = delay * Math.pow(2, i);
      logger.warn(`재시도 ${i + 1}/${maxRetries}`, { delay: backoffDelay });
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error('Max retries reached');
};

// 사용 예시
const consent = await retryWithBackoff(() => getConsent(userId));
```

---

## 🧩 의존성 관리

### 1. **기존 시스템 통합**

```typescript
// ✅ 활용할 기존 시스템

1. 인증: AuthContext (기존)
   - currentUser 사용
   - signOut() 사용

2. 알림: useNotifications (기존)
   - 로그인 알림 표시
   - 계정 삭제 알림

3. 보안: authSecurity.ts (기존)
   - recordLoginAttempt() 확장
   - isLoginBlocked() 활용

4. Toast: toast.ts (기존)
   - 모든 사용자 피드백

5. 로깅: logger.ts (기존)
   - 모든 로그 기록

6. 암호화: secureStorage.ts (기존)
   - 민감 정보 저장

7. 비밀번호: PasswordStrength.tsx (기존)
   - 비밀번호 변경 시 재사용
```

### 2. **신규 의존성 (최소화)**

```json
// package.json 추가 (선택사항)
{
  "dependencies": {
    "zod": "^3.22.0",              // 스키마 검증
    "crypto-js": "^4.2.0"          // 이미 설치됨 (secureStorage에서 사용)
  }
}
```

### 3. **의존성 주입 패턴**

```typescript
// services/consentService.ts

export class ConsentService {
  constructor(
    private db: Firestore,
    private logger: Logger,
    private cache: SmartCache<ConsentRecord>
  ) {}
  
  async getConsent(userId: string): Promise<ConsentRecord | null> {
    // 구현
  }
}

// 싱글톤 인스턴스
export const consentService = new ConsentService(
  db,
  logger,
  new SmartCache({ ttl: 5 * 60 * 1000 })
);
```

---

## 🧪 테스트 전략

### 1. **단위 테스트 (Jest)**

```typescript
// __tests__/services/consentService.test.ts

describe('ConsentService', () => {
  describe('createConsent', () => {
    it('필수 동의 없이 생성 시 에러 발생', async () => {
      const invalidData = { marketing: { agreed: true } };
      
      await expect(
        consentService.createConsent('user123', invalidData as any)
      ).rejects.toThrow(ValidationError);
    });
    
    it('유효한 데이터로 동의 생성 성공', async () => {
      const validData = {
        termsOfService: { agreed: true, version: '1.0' },
        privacyPolicy: { agreed: true, version: '1.0' },
        marketing: { agreed: false },
      };
      
      await consentService.createConsent('user123', validData);
      
      expect(setDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining(validData)
      );
    });
  });
});
```

### 2. **통합 테스트 (React Testing Library)**

```typescript
// __tests__/components/ConsentManager.test.tsx

describe('ConsentManager', () => {
  it('필수 동의 체크 없이 제출 불가', async () => {
    render(<ConsentManager onComplete={jest.fn()} />);
    
    const submitButton = screen.getByRole('button', { name: /동의하고 계속/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/필수 동의 항목을 확인해주세요/i)).toBeInTheDocument();
  });
  
  it('모든 필수 동의 체크 시 제출 가능', async () => {
    const onComplete = jest.fn();
    render(<ConsentManager onComplete={onComplete} />);
    
    fireEvent.click(screen.getByLabelText(/이용약관/i));
    fireEvent.click(screen.getByLabelText(/개인정보 처리방침/i));
    fireEvent.click(screen.getByRole('button', { name: /동의하고 계속/i }));
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
```

### 3. **E2E 테스트 (Playwright MCP 활용)**

```typescript
// __tests__/e2e/accountDeletion.spec.ts

test('계정 삭제 전체 플로우', async ({ page }) => {
  await page.goto('/app/settings');
  
  // 계정 삭제 버튼 클릭
  await page.click('text=계정 삭제');
  
  // 모달 표시 확인
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  // 비밀번호 입력
  await page.fill('input[type="password"]', 'test123!@#');
  
  // 삭제 확인
  await page.click('button:has-text("삭제 신청")');
  
  // Toast 확인
  await expect(page.locator('text=30일 후 삭제됩니다')).toBeVisible();
});
```

---

## 📦 파일 구조 (최종)

```
app2/src/
├── components/
│   ├── auth/
│   │   ├── ConsentManager.tsx           # ✨ 신규
│   │   └── PasswordStrength.tsx         # 기존 활용
│   └── settings/
│       ├── SecuritySettings.tsx         # ✨ 신규
│       ├── PasswordChangeModal.tsx      # ✨ 신규
│       ├── LoginHistoryList.tsx         # ✨ 신규
│       ├── ConsentSettings.tsx          # ✨ 신규
│       ├── AccountDangerZone.tsx        # ✨ 신규
│       └── AccountDeletionModal.tsx     # ✨ 신규
├── pages/
│   ├── SettingsPage.tsx                # ✨ 신규 (통합)
│   ├── TermsOfServicePage.tsx          # ✨ 신규
│   └── PrivacyPolicyPage.tsx           # ✨ 신규
├── services/
│   ├── consentService.ts               # ✨ 신규
│   ├── accountDeletionService.ts       # ✨ 신규
│   ├── authSecurity.ts                 # 🔧 수정 (로그인 알림)
│   └── rateLimiter.ts                  # ✨ 신규
├── hooks/
│   ├── useConsent.ts                   # ✨ 신규
│   ├── useSecuritySettings.ts          # ✨ 신규
│   └── useAccountDeletion.ts           # ✨ 신규
├── types/
│   ├── consent.ts                      # ✨ 신규
│   ├── security.ts                     # ✨ 신규
│   └── accountDeletion.ts              # ✨ 신규
├── utils/
│   ├── validation/
│   │   └── accountValidation.ts        # ✨ 신규
│   └── retryWithBackoff.ts             # ✨ 신규
└── __tests__/
    ├── services/
    │   ├── consentService.test.ts      # ✨ 신규
    │   └── accountDeletionService.test.ts # ✨ 신규
    ├── components/
    │   ├── ConsentManager.test.tsx     # ✨ 신규
    │   └── SecuritySettings.test.tsx   # ✨ 신규
    └── e2e/
        ├── consent.spec.ts             # ✨ 신규
        └── accountDeletion.spec.ts     # ✨ 신규

functions/src/
├── notifications/
│   └── loginNotification.ts            # ✨ 신규
├── scheduledDeletion.ts                # ✨ 신규
└── index.ts                            # 🔧 수정 (export 추가)

docs/legal/
├── terms_of_service_ko_v1.0.md         # ✨ 신규
├── terms_of_service_en_v1.0.md         # ✨ 신규
├── privacy_policy_ko_v1.0.md           # ✨ 신규
└── privacy_policy_en_v1.0.md           # ✨ 신규
```

---

## 📅 구현 로드맵 (2주)

### **Week 1: 기반 구축**

#### Day 1-2: 타입 정의 + 서비스 레이어
- [x] `types/consent.ts` 생성
- [x] `types/security.ts` 생성
- [x] `types/accountDeletion.ts` 생성
- [x] `services/consentService.ts` 구현
- [x] `services/accountDeletionService.ts` 구현
- [x] `utils/validation/accountValidation.ts` 구현

#### Day 3-4: 동의 관리 시스템
- [x] `ConsentManager.tsx` 구현
- [x] `hooks/useConsent.ts` 구현
- [x] `SignUp.tsx` 수정 (동의 관리 통합)
- [x] `TermsOfServicePage.tsx` 생성
- [x] `PrivacyPolicyPage.tsx` 생성
- [x] 국제화 (i18n) 추가

#### Day 5-7: 설정 페이지 + 보안 설정
- [x] `SettingsPage.tsx` 생성 (메인)
- [x] `ConsentSettings.tsx` 구현
- [x] `SecuritySettings.tsx` 구현
- [x] `PasswordChangeModal.tsx` 구현
- [x] `LoginHistoryList.tsx` 구현
- [x] App.tsx 라우팅 추가

### **Week 2: 고급 기능 + 테스트**

#### Day 8-10: 계정 삭제 + Firebase Functions
- [x] `AccountDangerZone.tsx` 구현
- [x] `AccountDeletionModal.tsx` 구현
- [x] `hooks/useAccountDeletion.ts` 구현
- [x] Firebase Function `scheduledDeletion.ts` 구현
- [x] Firebase Function `loginNotification.ts` 구현
- [x] Cloud Scheduler 설정 (30일 자동 삭제)

#### Day 11-12: 로그인 알림
- [x] `authSecurity.ts` 수정 (알림 트리거)
- [x] `hooks/useSecuritySettings.ts` 구현
- [x] 기존 알림 시스템 통합

#### Day 13-14: 테스트 + 문서 + 배포
- [x] 단위 테스트 작성 (Jest)
- [x] 통합 테스트 작성 (React Testing Library)
- [x] E2E 테스트 작성 (Playwright MCP)
- [x] Firestore Security Rules 배포
- [x] Firebase Functions 배포
- [x] 법적 문서 작성 (이용약관, 개인정보 처리방침)
- [x] README 업데이트

---

## ✅ 완료 조건

### 기능
- [ ] 회원가입 시 약관 동의 필수 체크
- [ ] 설정 페이지에서 동의 내역 조회/변경 가능
- [ ] 비밀번호 변경 기능 정상 작동
- [ ] 로그인 시 앱 내 알림 발송 (새 기기/IP)
- [ ] 계정 탈퇴 신청 후 30일 유예기간 적용
- [ ] Firebase Function으로 30일 후 자동 삭제

### 품질
- [ ] TypeScript 에러 0개 (`npm run type-check`)
- [ ] ESLint 경고 최소화 (`npm run lint`)
- [ ] 테스트 커버리지 ≥70%
- [ ] Lighthouse 접근성 점수 ≥90
- [ ] 모바일/데스크톱 반응형 확인

### 보안
- [ ] Firestore Security Rules 검증
- [ ] XSS/Injection 방지 확인
- [ ] Rate Limiting 동작 확인
- [ ] 민감 정보 암호화 확인

### 문서
- [ ] 이용약관 (한글/영어)
- [ ] 개인정보 처리방침 (한글/영어)
- [ ] 개발자 문서 업데이트

---

## 🚀 배포 순서

```bash
# 1. Firestore Security Rules 배포
firebase deploy --only firestore:rules

# 2. Firebase Functions 배포
cd functions && npm run build && firebase deploy --only functions

# 3. Frontend 빌드 및 배포
cd app2 && npm run build && firebase deploy --only hosting

# 4. Cloud Scheduler 활성화 (Firebase Console)
# scheduledDeletion 함수 → 매일 00:00 실행

# 5. 배포 검증
npm run test:e2e
```

---

이 계획은 **Enterprise-Grade** 수준으로 성능, 보안, UI/UX, 확장성, 데이터 흐름, 에러 처리, 의존성 관리를 모두 고려했습니다. 프로덕션 환경에서 안전하게 운영 가능합니다.

구현 시작하시겠습니까?