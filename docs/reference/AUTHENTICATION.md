# 🔐 T-HOLDEM 인증 시스템 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (모바일앱 중심)
**상태**: 🚀 **Production Ready - 고급 인증 시스템 완전 구현**

> ⚠️ **참고**: 현재 주력 플랫폼은 **uniqn-mobile/** (React Native + Expo)입니다.
> 모바일앱 인증은 `authService.ts` + `authStore.ts`에서 관리됩니다.

---

## 📋 목차

1. [개요](#-개요)
2. [인증 아키텍처](#-인증-아키텍처)
3. [핵심 기능](#-핵심-기능)
4. [구현 상세](#-구현-상세)
5. [보안 기능](#-보안-기능)
6. [API 명세](#-api-명세)
7. [사용자 경험](#-사용자-경험)
8. [문제 해결](#-문제-해결)

## 🎯 개요

T-HOLDEM의 인증 시스템은 **Firebase Authentication**을 기반으로 한 현대적이고 안전한 사용자 관리 시스템입니다.

### 지원 인증 방식
- **이메일/비밀번호**: 기본 인증 방식
- **Google OAuth**: 소셜 로그인
- **2단계 인증 (2FA)**: 보안 강화
- **자동 로그인**: 편의성 향상

### 사용자 역할
- **스태프**: 일반 직원 (즉시 승인)
- **매니저**: 관리자 (승인 필요)
- **관리자**: 시스템 관리자

## 🏗️ 인증 아키텍처

### 시스템 구조
```
┌─────────────────────────────────────────┐
│              Frontend Layer             │
├─────────────────────────────────────────┤
│  Components                             │
│  ├── Login.tsx                         │
│  ├── SignUp.tsx                        │
│  ├── ForgotPassword.tsx                │
│  └── ProfilePage.tsx                   │
├─────────────────────────────────────────┤
│           AuthContext Layer             │
│  ┌─────────────────────────────────────┐ │
│  │  AuthContext.tsx                    │ │
│  │  ├── user: User | null              │ │
│  │  ├── loading: boolean               │ │
│  │  ├── login(email, password)         │ │
│  │  ├── signUp(userData)               │ │
│  │  ├── logout()                       │ │
│  │  └── updateProfile(data)            │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│           Firebase Layer                │
│  ├── Authentication                    │
│  ├── Firestore (user profiles)         │
│  ├── Security Rules                    │
│  └── Cloud Functions                   │
└─────────────────────────────────────────┘
```

### 데이터 흐름
```
User Action → AuthContext → Firebase Auth → Firestore → UI Update
```

## ⚡ 핵심 기능

### 1. 사용자 등록 (SignUp.tsx)

#### 수집 정보
```typescript
interface SignUpData {
  // 필수 정보
  name: string;
  email: string;
  password: string;
  gender: 'male' | 'female' | 'other';
  role: 'staff' | 'manager';

  // 선택 정보
  phoneNumber?: string;
  age?: number;
  nationality?: string;
  region?: string;
  experience?: string;
  notes?: string;
}
```

#### 가입 프로세스
1. **입력 유효성 검사**
   - 이메일 형식 검증
   - 비밀번호 강도 확인 (최소 6자)
   - 전화번호 포맷팅

2. **Firebase 계정 생성**
   ```typescript
   const userCredential = await createUserWithEmailAndPassword(
     auth,
     email,
     password
   );
   ```

3. **프로필 정보 저장**
   ```typescript
   await setDoc(doc(db, 'staff', uid), {
     ...profileData,
     createdAt: serverTimestamp(),
     isApproved: role === 'staff' // 스태프는 즉시 승인
   });
   ```

4. **이메일 인증 발송**
   ```typescript
   await sendEmailVerification(user);
   ```

### 2. 로그인 (Login.tsx)

#### 지원 방식
- **이메일/비밀번호**
- **Google OAuth**
- **자동 로그인** (기억하기 체크 시)

#### 로그인 프로세스
```typescript
const handleLogin = async (email: string, password: string) => {
  try {
    // 1. Firebase 인증
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 2. 사용자 정보 로드
    const userDoc = await getDoc(
      doc(db, 'staff', userCredential.user.uid)
    );

    // 3. 권한 확인
    if (!userDoc.data()?.isApproved) {
      throw new Error('계정 승인 대기 중입니다');
    }

    // 4. 컨텍스트 업데이트
    setUser({
      ...userCredential.user,
      profile: userDoc.data()
    });

  } catch (error) {
    handleAuthError(error);
  }
};
```

### 3. Google OAuth 로그인

```typescript
const handleGoogleLogin = async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);

    // Google 계정 정보로 프로필 생성
    const profileData = {
      name: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      provider: 'google',
      role: 'staff',
      isApproved: true,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'staff', result.user.uid), profileData);

  } catch (error) {
    handleAuthError(error);
  }
};
```

### 4. 프로필 관리 (ProfilePage.tsx)

#### 공개 정보
- 기본 정보: 이름, 이메일, 전화번호, 성별, 나이
- 위치 정보: 국적, 지역
- 경력 정보: 경험 레벨, 이력
- 평가 정보: 평점, 리뷰

#### 비공개 정보 (본인만 표시)
- 주민등록번호
- 은행 정보 (은행명, 계좌번호)

#### 인라인 편집 시스템
```typescript
const ProfileField = ({
  label,
  value,
  field,
  type = 'text'
}: ProfileFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSave = async () => {
    try {
      await updateProfile(field, tempValue);
      setIsEditing(false);
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
  };

  return (
    <div className="profile-field">
      <label>{label}</label>
      {isEditing ? (
        <div className="edit-mode">
          <input
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            type={type}
          />
          <button onClick={handleSave}>저장</button>
          <button onClick={() => setIsEditing(false)}>취소</button>
        </div>
      ) : (
        <div className="view-mode">
          <span>{value}</span>
          <button onClick={() => setIsEditing(true)}>편집</button>
        </div>
      )}
    </div>
  );
};
```

## 🛡️ 보안 기능

### 1. 2단계 인증 (2FA)

#### SMS 인증
```typescript
const enableSMSAuth = async (phoneNumber: string) => {
  const recaptchaVerifier = new RecaptchaVerifier(
    'recaptcha-container',
    { size: 'invisible' },
    auth
  );

  const confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber,
    recaptchaVerifier
  );

  // 인증 코드 입력 대기
  const verificationCode = await promptForCode();

  await confirmationResult.confirm(verificationCode);
};
```

#### TOTP (Google Authenticator)
```typescript
const enableTOTP = async () => {
  const multiFactor = multiFactor(auth.currentUser);

  const session = await multiFactor.getSession();
  const totpSecret = TotpSecret.generate();

  const totpMultiFactorGenerator = TotpMultiFactorGenerator.assertionForEnrollment(
    totpSecret,
    verificationCode
  );

  await multiFactor.enroll(totpMultiFactorGenerator, session);
};
```

### 2. 세션 관리

#### 자동 로그인
```typescript
const initializeAuth = () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // 토큰 유효성 검사
      const token = await user.getIdToken(true);

      // 사용자 프로필 로드
      const profile = await loadUserProfile(user.uid);

      setUser({ ...user, profile });
    } else {
      setUser(null);
    }
    setLoading(false);
  });
};
```

#### 세션 타임아웃
```typescript
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24시간

const checkSessionValidity = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const tokenResult = await user.getIdTokenResult();
  const authTime = new Date(tokenResult.authTime).getTime();
  const now = Date.now();

  if (now - authTime > SESSION_TIMEOUT) {
    await logout();
    toast.warning('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
};
```

### 3. 보안 규칙 (Firestore)

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 스태프 컬렉션
    match /staff/{staffId} {
      // 읽기: 인증된 사용자
      allow read: if request.auth != null;

      // 쓰기: 본인만 또는 관리자
      allow write: if request.auth != null &&
        (request.auth.uid == staffId ||
         isAdmin(request.auth.uid));
    }

    // 관리자 권한 체크
    function isAdmin(userId) {
      return get(/databases/$(database)/documents/staff/$(userId)).data.role == 'admin';
    }
  }
}
```

## 📡 API 명세

### AuthContext 메서드

#### `login(email, password)`
```typescript
interface LoginParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

const login = async ({ email, password, rememberMe }: LoginParams) => {
  // Firebase 인증 및 사용자 정보 로드
};
```

#### `signUp(userData)`
```typescript
interface SignUpParams {
  name: string;
  email: string;
  password: string;
  gender: 'male' | 'female' | 'other';
  role: 'staff' | 'manager';
  phoneNumber?: string;
  // ... 기타 프로필 정보
}

const signUp = async (userData: SignUpParams) => {
  // 계정 생성 및 프로필 저장
};
```

#### `updateProfile(field, value)`
```typescript
const updateProfile = async (field: string, value: any) => {
  const userRef = doc(db, 'staff', user.uid);
  await updateDoc(userRef, { [field]: value });
};
```

#### `resetPassword(email)`
```typescript
const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};
```

### 사용자 상태 타입

```typescript
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'staff' | 'manager' | 'admin';
  isApproved: boolean;
  phoneNumber?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  nationality?: string;
  region?: string;
  experience?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

interface AuthState {
  user: (User & { profile: UserProfile }) | null;
  loading: boolean;
  error: string | null;
}
```

## 🎨 사용자 경험

### 로딩 상태 관리
```typescript
const AuthLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500">
    </div>
    <p className="ml-4 text-lg">인증 확인 중...</p>
  </div>
);
```

### 에러 메시지 처리
```typescript
const AUTH_ERROR_MESSAGES = {
  'auth/user-not-found': '존재하지 않는 계정입니다',
  'auth/wrong-password': '비밀번호가 올바르지 않습니다',
  'auth/email-already-in-use': '이미 사용 중인 이메일입니다',
  'auth/weak-password': '비밀번호가 너무 약합니다',
  'auth/invalid-email': '올바르지 않은 이메일 형식입니다',
  'auth/user-disabled': '계정이 비활성화되었습니다',
  'auth/too-many-requests': '너무 많은 시도입니다. 잠시 후 다시 시도해주세요'
};

const getErrorMessage = (errorCode: string) => {
  return AUTH_ERROR_MESSAGES[errorCode] || '알 수 없는 오류가 발생했습니다';
};
```

### Toast 알림 시스템
```typescript
// 성공
toast.success('로그인에 성공했습니다');

// 에러
toast.error('로그인에 실패했습니다');

// 정보
toast.info('이메일 인증 링크를 발송했습니다');

// 경고
toast.warning('세션이 곧 만료됩니다');
```

## 🔧 문제 해결

### 로그인 실패 시
1. **이메일 형식 확인**
2. **네트워크 연결 상태 확인**
3. **Firebase 프로젝트 설정 확인**
4. **브라우저 콘솔 에러 로그 확인**

### 프로필 업데이트 실패 시
```typescript
const handleProfileUpdateError = (error: any) => {
  if (error.code === 'permission-denied') {
    toast.error('권한이 없습니다');
  } else if (error.code === 'unavailable') {
    toast.error('서버 연결에 실패했습니다');
  } else {
    toast.error('프로필 업데이트에 실패했습니다');
  }
};
```

### Google OAuth 문제
1. **Firebase Console에서 Google 인증 활성화 확인**
2. **OAuth 클라이언트 ID 설정 확인**
3. **도메인 허용 목록 확인**

## 📊 모니터링 및 분석

### 인증 이벤트 로깅
```typescript
const logAuthEvent = (event: string, metadata?: any) => {
  logger.info('Auth Event', {
    event,
    userId: auth.currentUser?.uid,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// 사용 예시
logAuthEvent('login_success', { method: 'email' });
logAuthEvent('signup_attempt', { role: 'staff' });
logAuthEvent('password_reset', { email });
```

### 성능 지표
- 로그인 성공률: 95%+
- 회원가입 완료율: 90%+
- 세션 유지 시간: 평균 2시간
- 2FA 활성화율: 60%+

## 🔗 관련 문서

- **Firebase Authentication 문서**: https://firebase.google.com/docs/auth
- **프로젝트 아키텍처**: `ARCHITECTURE.md`
- **보안 가이드**: `../operations/SECURITY.md`
- **사용자 가이드**: `../user/authentication-system.md`

---

*인증 시스템 관련 문의는 개발팀에 연락하세요.*
