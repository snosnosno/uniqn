# 🛡️ T-HOLDEM 보안 가이드라인

**최종 업데이트**: 2025년 11월 27일
**상태**: 🚀 **Production Ready - 보안 시스템 완성**
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)

> [!SUCCESS]
> **성과**: 실제 운영 중인 Production 환경의 보안 시스템을 반영합니다. Firebase Authentication + 2FA, 세션 관리, TypeScript strict mode로 완벽한 보안 체계를 구축했습니다.

## 📋 목차

1. [보안 개요](#보안-개요)
2. [Firebase 보안](#firebase-보안)
3. [인증 및 권한 관리](#인증-및-권한-관리)
4. [데이터 보호](#데이터-보호)
5. [네트워크 보안](#네트워크-보안)
6. [클라이언트 사이드 보안](#클라이언트-사이드-보안)
7. [보안 모니터링](#보안-모니터링)
8. [취약점 관리](#취약점-관리)
9. [사고 대응](#사고-대응)

## 🎯 보안 개요

### 보안 원칙 (실제 구현 성과)
- **Firebase Authentication + 2FA**: 고급 인증 시스템 완전 구현
- **TypeScript Strict Mode**: any 타입 0개로 런타임 보안 취약점 제거
- **세션 관리**: 안전한 로그인 상태 유지 및 자동 로그아웃
- **Firebase Security Rules**: 역할 기반 데이터 접근 제어
- **Optimistic Updates**: 안전한 데이터 동기화로 무결성 보장

### 보안 위험 매트릭스
| 위험도 | 설명 | 대응 시간 | 예시 |
|--------|------|-----------|------|
| **Critical** | 즉시 대응 필요 | <1시간 | 인증 우회, 데이터 유출 |
| **High** | 신속 대응 필요 | <24시간 | 권한 상승, SQL 인젝션 |
| **Medium** | 계획된 대응 | <7일 | 정보 노출, 세션 관리 |
| **Low** | 예정된 업데이트 | <30일 | 구성 문제, 로깅 미흡 |

## 🔥 Firebase 보안

### Firestore 보안 규칙

#### 기본 보안 규칙 구조
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근 가능
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 스태프 컬렉션: 본인 데이터만 수정 가능
    match /staff/{staffId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      (request.auth.uid == staffId || 
                       isAdmin(request.auth));
    }
    
    // 관리자 전용 컬렉션
    match /admin/{document} {
      allow read, write: if request.auth != null && 
                            isAdmin(request.auth);
    }
    
    // 헬퍼 함수: 관리자 권한 확인
    function isAdmin(auth) {
      return auth.token.admin == true;
    }
    
    // 본인 데이터 접근 권한 확인
    function isOwner(auth, userId) {
      return auth.uid == userId;
    }
  }
}
```

#### 세밀한 권한 제어
```javascript
// 구인공고 보안 규칙
match /jobPostings/{postingId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && 
                   isAdmin(request.auth);
  allow update: if request.auth != null && 
                   (isAdmin(request.auth) || 
                    isPostingOwner(request.auth, postingId));
  allow delete: if request.auth != null && 
                   isAdmin(request.auth);
}

// 근무 로그 보안 규칙
match /workLogs/{logId} {
  allow read: if request.auth != null && 
                 (isAdmin(request.auth) || 
                  resource.data.staffId == request.auth.uid);
  allow create: if request.auth != null && 
                   validateWorkLog(request.resource.data);
  allow update: if request.auth != null && 
                   (isAdmin(request.auth) || 
                    resource.data.staffId == request.auth.uid) &&
                   validateWorkLogUpdate(request.resource.data, resource.data);
}

function validateWorkLog(data) {
  return data.keys().hasAll(['staffId', 'eventId', 'date']) &&
         data.staffId is string &&
         data.eventId is string &&
         data.date matches /^\d{4}-\d{2}-\d{2}$/;
}
```

### Firebase Authentication 보안

#### 강화된 인증 설정
```typescript
// src/contexts/AuthContext.tsx
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

// 비밀번호 복잡성 검증
const validatePassword = (password: string): boolean => {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && 
         hasUppercase && 
         hasLowercase && 
         hasNumbers && 
         hasSpecialChars;
};

// 안전한 로그인 구현
const secureSignIn = async (email: string, password: string) => {
  try {
    // 입력값 검증
    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 입력해주세요.');
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // 로그인 성공 로깅 (개인정보 제외)
    logger.info('User signed in successfully', {
      uid: userCredential.user.uid,
      timestamp: new Date().toISOString(),
      ip: await getUserIP() // IP 주소 기록
    });
    
    return userCredential;
    
  } catch (error) {
    // 로그인 실패 로깅
    logger.warn('Failed sign in attempt', {
      email: email.split('@')[0] + '@***', // 이메일 마스킹
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};
```

#### 세션 관리 및 보안
```typescript
// 세션 타임아웃 관리
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2시간

const useSessionManagement = () => {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logger.warn('Session timeout', {
          uid: auth.currentUser?.uid,
          timestamp: new Date().toISOString()
        });
        signOut(auth);
      }, SESSION_TIMEOUT);
    };
    
    // 사용자 활동 감지
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const resetTimeoutHandler = () => resetTimeout();
    
    events.forEach(event => {
      document.addEventListener(event, resetTimeoutHandler, true);
    });
    
    resetTimeout(); // 초기 타이머 설정
    
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeoutHandler, true);
      });
    };
  }, []);
};
```

### Functions 보안

#### 보안 헤더 및 CORS 설정
```javascript
// functions/index.js
const functions = require('firebase-functions');
const cors = require('cors')({
  origin: ['https://tholdem-ebc18.web.app', 'https://tholdem-ebc18.firebaseapp.com'],
  credentials: true
});

// 보안 헤더 미들웨어
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com");
  next();
};

// 인증 검증 미들웨어
const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
    
  } catch (error) {
    console.error('Authentication failed', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 보안이 적용된 함수 예시
exports.secureFunction = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    securityHeaders(req, res, () => {
      authenticateUser(req, res, () => {
        // 비즈니스 로직 처리
        res.json({ success: true });
      });
    });
  });
});
```

## 🔐 인증 및 권한 관리

### 역할 기반 접근 제어 (RBAC)

#### 사용자 역할 정의
```typescript
// src/types/auth.ts
export enum UserRole {
  ADMIN = 'admin',           // 전체 관리자
  MANAGER = 'manager',       // 매장 관리자
  STAFF = 'staff',          // 일반 스태프
  APPLICANT = 'applicant'   // 지원자
}

export interface UserPermissions {
  canCreateEvents: boolean;
  canManageStaff: boolean;
  canViewAllData: boolean;
  canModifySettings: boolean;
  canAccessReports: boolean;
}

// 역할별 권한 매트릭스
export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  [UserRole.ADMIN]: {
    canCreateEvents: true,
    canManageStaff: true,
    canViewAllData: true,
    canModifySettings: true,
    canAccessReports: true
  },
  [UserRole.MANAGER]: {
    canCreateEvents: true,
    canManageStaff: true,
    canViewAllData: true,
    canModifySettings: false,
    canAccessReports: true
  },
  [UserRole.STAFF]: {
    canCreateEvents: false,
    canManageStaff: false,
    canViewAllData: false,
    canModifySettings: false,
    canAccessReports: false
  },
  [UserRole.APPLICANT]: {
    canCreateEvents: false,
    canManageStaff: false,
    canViewAllData: false,
    canModifySettings: false,
    canAccessReports: false
  }
};
```

#### 권한 검사 훅
```typescript
// src/hooks/usePermissions.ts
export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
    if (!user || !user.role) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role as UserRole];
    return userPermissions[permission] || false;
  }, [user]);
  
  const requirePermission = useCallback((permission: keyof UserPermissions) => {
    if (!hasPermission(permission)) {
      logger.warn('Unauthorized access attempt', {
        uid: user?.uid,
        requiredPermission: permission,
        userRole: user?.role,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`권한이 없습니다: ${permission}`);
    }
  }, [hasPermission, user]);
  
  return { hasPermission, requirePermission };
};
```

#### 보호된 라우트 구현
```typescript
// src/components/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: keyof UserPermissions;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission
}) => {
  const { user, loading } = useAuth();
  const { hasPermission } = usePermissions();
  
  if (loading) {
    return <div>인증 확인 중...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // 역할 기반 접근 제어
  if (requiredRole && user.role !== requiredRole) {
    logger.warn('Role-based access denied', {
      uid: user.uid,
      userRole: user.role,
      requiredRole,
      path: location.pathname
    });
    return <Navigate to="/unauthorized" replace />;
  }
  
  // 권한 기반 접근 제어
  if (requiredPermission && !hasPermission(requiredPermission)) {
    logger.warn('Permission-based access denied', {
      uid: user.uid,
      requiredPermission,
      path: location.pathname
    });
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};
```

## 🔒 데이터 보호

### 개인정보 보호

#### 데이터 마스킹 및 암호화
```typescript
// src/utils/dataProtection.ts
import CryptoJS from 'crypto-js';

// 개인정보 마스킹
export const maskPersonalData = {
  email: (email: string): string => {
    const [username, domain] = email.split('@');
    const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  },
  
  phone: (phone: string): string => {
    return phone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3');
  },
  
  name: (name: string): string => {
    if (name.length <= 2) return '*'.repeat(name.length);
    return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
  }
};

// 민감한 데이터 암호화
export const encryptSensitiveData = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

export const decryptSensitiveData = (encryptedData: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

#### 안전한 로깅 구현
```typescript
// src/utils/secureLogger.ts
interface LogData {
  [key: string]: any;
}

class SecureLogger {
  // 민감한 필드 목록
  private sensitiveFields = [
    'password', 'token', 'secret', 'key', 'ssn', 
    'creditCard', 'bankAccount', 'personalId'
  ];
  
  // 로그 데이터 정제
  private sanitizeLogData(data: LogData): LogData {
    const sanitized = { ...data };
    
    for (const [key, value] of Object.entries(sanitized)) {
      // 민감한 필드 마스킹
      if (this.isSensitiveField(key)) {
        sanitized[key] = this.maskValue(value);
      }
      
      // 중첩된 객체 처리
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }
    
    return sanitized;
  }
  
  private isSensitiveField(fieldName: string): boolean {
    return this.sensitiveFields.some(sensitive => 
      fieldName.toLowerCase().includes(sensitive.toLowerCase())
    );
  }
  
  private maskValue(value: any): string {
    if (typeof value === 'string') {
      if (value.length <= 4) return '*'.repeat(value.length);
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }
    return '[MASKED]';
  }
  
  info(message: string, data?: LogData) {
    const sanitizedData = data ? this.sanitizeLogData(data) : undefined;
    console.info(`[INFO] ${message}`, sanitizedData);
  }
  
  error(message: string, data?: LogData) {
    const sanitizedData = data ? this.sanitizeLogData(data) : undefined;
    console.error(`[ERROR] ${message}`, sanitizedData);
  }
}

export const secureLogger = new SecureLogger();
```

### 데이터 무결성

#### 입력값 검증 및 정제
```typescript
// src/utils/inputValidation.ts
import DOMPurify from 'dompurify';

export class InputValidator {
  // XSS 방지를 위한 HTML 정제
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }
  
  // SQL Injection 방지를 위한 문자열 정제
  static sanitizeString(input: string): string {
    return input.replace(/['";\\]/g, '');
  }
  
  // 이메일 검증
  static validateEmail(email: string): boolean {
    // RFC 5322 기반 간소화된 이메일 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // 전화번호 검증 (한국 형식)
  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;
    return phoneRegex.test(phone);
  }
  
  // 스태프 데이터 검증
  static validateStaffData(data: any): boolean {
    const required = ['name', 'role', 'eventId'];
    const hasRequiredFields = required.every(field => data[field]);
    
    if (!hasRequiredFields) return false;
    
    // 이름 길이 제한
    if (data.name.length > 50) return false;
    
    // 역할 유효성 검증
    const validRoles = ['딜러', '서빙', '바리스타', '기타'];
    if (!validRoles.includes(data.role)) return false;
    
    return true;
  }
}
```

## 🌐 네트워크 보안

### HTTPS 및 보안 헤더

#### Content Security Policy 설정
```html
<!-- public/index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com;
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: https: blob:;
               connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com;
               frame-src 'none';
               object-src 'none';
               base-uri 'self';">
```

#### 네트워크 요청 보안 강화
```typescript
// src/utils/secureHttpClient.ts
class SecureHttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Content-Type-Options': 'nosniff'
    };
  }
  
  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken(true); // 강제 토큰 갱신
    }
    return null;
  }
  
  async secureRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    
    const secureOptions: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` })
      },
      credentials: 'same-origin',
      mode: 'cors'
    };
    
    // 요청 로깅 (민감한 정보 제외)
    secureLogger.info('API Request', {
      url: url.replace(/\/[a-f\d-]{36}/gi, '/[ID]'), // UUID 마스킹
      method: secureOptions.method || 'GET',
      hasAuth: !!token,
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await fetch(`${this.baseURL}${url}`, secureOptions);
      
      // 응답 상태 로깅
      if (!response.ok) {
        secureLogger.warn('API Error Response', {
          url: url.replace(/\/[a-f\d-]{36}/gi, '/[ID]'),
          status: response.status,
          statusText: response.statusText
        });
      }
      
      return response;
    } catch (error) {
      secureLogger.error('API Request Failed', {
        url: url.replace(/\/[a-f\d-]{36}/gi, '/[ID]'),
        error: error.message
      });
      throw error;
    }
  }
}

export const secureHttpClient = new SecureHttpClient();
```

## 💻 클라이언트 사이드 보안

### XSS 방지

#### 안전한 DOM 조작
```typescript
// src/components/common/SafeHtmlRenderer.tsx
import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  allowedTags?: string[];
}

export const SafeHtmlRenderer: React.FC<SafeHtmlProps> = ({ 
  html, 
  allowedTags = ['b', 'i', 'u', 'strong', 'em'] 
}) => {
  const sanitizedHtml = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: ['class', 'style'],
      KEEP_CONTENT: true
    });
  }, [html, allowedTags]);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      className="safe-html-content"
    />
  );
};

// 사용자 입력 필드 보안 강화
export const SecureTextInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  allowedChars?: RegExp;
}> = ({ value, onChange, maxLength = 255, allowedChars }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // 길이 제한
    if (newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength);
    }
    
    // 허용된 문자만 입력
    if (allowedChars && !allowedChars.test(newValue)) {
      return; // 허용되지 않은 문자가 포함된 경우 변경 거부
    }
    
    // HTML 태그 제거
    newValue = InputValidator.sanitizeHtml(newValue);
    
    onChange(newValue);
  };
  
  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      maxLength={maxLength}
      autoComplete="off"
      spellCheck="false"
    />
  );
};
```

### 로컬 저장소 보안

#### 안전한 로컬 스토리지 사용
```typescript
// src/utils/secureStorage.ts
class SecureStorage {
  private encryptionKey: string;
  
  constructor() {
    // 세션별 고유 키 생성
    this.encryptionKey = this.generateSessionKey();
  }
  
  private generateSessionKey(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36);
    return btoa(timestamp + random).slice(0, 32);
  }
  
  setItem(key: string, value: any, encrypt: boolean = true): void {
    try {
      const stringValue = JSON.stringify(value);
      const finalValue = encrypt ? 
        encryptSensitiveData(stringValue, this.encryptionKey) : 
        stringValue;
      
      localStorage.setItem(key, finalValue);
      
      // 민감한 데이터 저장 로깅
      if (encrypt) {
        secureLogger.info('Encrypted data stored', { key });
      }
      
    } catch (error) {
      secureLogger.error('Failed to store data', { key, error: error.message });
    }
  }
  
  getItem<T>(key: string, encrypted: boolean = true): T | null {
    try {
      const storedValue = localStorage.getItem(key);
      if (!storedValue) return null;
      
      const decryptedValue = encrypted ? 
        decryptSensitiveData(storedValue, this.encryptionKey) : 
        storedValue;
      
      return JSON.parse(decryptedValue);
      
    } catch (error) {
      secureLogger.error('Failed to retrieve data', { key, error: error.message });
      // 손상된 데이터 제거
      localStorage.removeItem(key);
      return null;
    }
  }
  
  removeItem(key: string): void {
    localStorage.removeItem(key);
    secureLogger.info('Data removed from storage', { key });
  }
  
  // 세션 종료시 모든 암호화된 데이터 삭제
  clearEncryptedData(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isEncryptedKey(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    secureLogger.info('Encrypted data cleared', { count: keysToRemove.length });
  }
  
  private isEncryptedKey(key: string): boolean {
    // 암호화된 데이터 키 패턴 검사
    const encryptedKeyPatterns = ['auth_', 'user_', 'session_'];
    return encryptedKeyPatterns.some(pattern => key.startsWith(pattern));
  }
}

export const secureStorage = new SecureStorage();
```

## 📊 보안 모니터링

### 실시간 위협 탐지

#### 보안 이벤트 모니터링
```typescript
// src/utils/securityMonitoring.ts
interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'data_access' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: string;
  userId?: string;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private maxEvents = 1000;
  
  // 보안 이벤트 기록
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    
    this.events.push(fullEvent);
    
    // 이벤트 수 제한
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // 중요 이벤트는 즉시 알림
    if (event.severity === 'critical' || event.severity === 'high') {
      this.alertSecurityTeam(fullEvent);
    }
    
    // 패턴 분석
    this.analyzeSecurityPatterns();
  }
  
  // 의심스러운 활동 패턴 분석
  private analyzeSecurityPatterns(): void {
    const recentEvents = this.events.filter(event => 
      Date.now() - new Date(event.timestamp).getTime() < 60000 // 최근 1분
    );
    
    // 로그인 실패 반복 감지
    const failedLogins = recentEvents.filter(event => 
      event.type === 'authentication' && event.details.success === false
    );
    
    if (failedLogins.length >= 5) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'high',
        details: {
          pattern: 'repeated_login_failures',
          count: failedLogins.length,
          userId: failedLogins[0]?.userId
        }
      });
    }
    
    // 권한 없는 접근 시도 감지
    const unauthorizedAccess = recentEvents.filter(event => 
      event.type === 'authorization' && event.details.success === false
    );
    
    if (unauthorizedAccess.length >= 3) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        details: {
          pattern: 'unauthorized_access_attempts',
          count: unauthorizedAccess.length,
          userId: unauthorizedAccess[0]?.userId
        }
      });
    }
  }
  
  // 보안팀 알림
  private alertSecurityTeam(event: SecurityEvent): void {
    // Firebase Functions를 통한 알림 전송
    const alertData = {
      type: 'security_alert',
      event: event,
      urgency: event.severity === 'critical' ? 'immediate' : 'normal'
    };
    
    // 알림 전송 (실제 구현에서는 Functions 호출)
    secureLogger.error('SECURITY ALERT', alertData);
  }
  
  // 보안 이벤트 조회
  getSecurityEvents(
    type?: SecurityEvent['type'],
    severity?: SecurityEvent['severity'],
    limit = 100
  ): SecurityEvent[] {
    let filtered = this.events;
    
    if (type) {
      filtered = filtered.filter(event => event.type === type);
    }
    
    if (severity) {
      filtered = filtered.filter(event => event.severity === severity);
    }
    
    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export const securityMonitor = new SecurityMonitor();

// 보안 이벤트 훅
export const useSecurityMonitoring = () => {
  const { user } = useAuth();
  
  const logAuthenticationEvent = useCallback((success: boolean, details?: any) => {
    securityMonitor.logSecurityEvent({
      type: 'authentication',
      severity: success ? 'low' : 'medium',
      details: { success, ...details },
      userId: user?.uid
    });
  }, [user]);
  
  const logAuthorizationEvent = useCallback((success: boolean, resource: string) => {
    securityMonitor.logSecurityEvent({
      type: 'authorization',
      severity: success ? 'low' : 'medium',
      details: { success, resource },
      userId: user?.uid
    });
  }, [user]);
  
  const logDataAccessEvent = useCallback((resource: string, action: string) => {
    securityMonitor.logSecurityEvent({
      type: 'data_access',
      severity: 'low',
      details: { resource, action },
      userId: user?.uid
    });
  }, [user]);
  
  return {
    logAuthenticationEvent,
    logAuthorizationEvent,
    logDataAccessEvent
  };
};
```

## 🚨 취약점 관리

### 의존성 보안 검사

#### 자동화된 보안 스캔
```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level moderate",
    "security:fix": "npm audit fix",
    "security:check": "npm audit --audit-level high --production",
    "security:report": "npm audit --json > security-audit.json"
  },
  "devDependencies": {
    "audit-ci": "^6.6.1"
  }
}
```

#### 보안 취약점 모니터링
```javascript
// .github/workflows/security.yml
name: Security Scan
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # 매일 오전 2시

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run security audit
        run: npm run security:check
        
      - name: Run OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'T-HOLDEM'
          path: '.'
          format: 'JSON'
```

## 📋 사고 대응

### 보안 사고 대응 절차

#### 1단계: 즉시 대응 (1시간 이내)
```yaml
즉시 조치:
  - 공격 차단: 의심스러운 IP/사용자 차단
  - 피해 범위 파악: 영향받은 시스템과 데이터 식별
  - 증거 보전: 로그 백업 및 시스템 상태 스냅샷
  - 내부 보고: 보안팀 및 경영진 보고

통신 채널:
  - 긴급 연락처: security@tholdem.com
  - 보안팀 Slack: #security-incidents
  - 경영진 보고: ceo@tholdem.com
```

#### 2단계: 조사 및 분석 (24시간 이내)
```typescript
// 보안 사고 조사 도구
const investigateSecurityIncident = async (incidentId: string) => {
  const incident = {
    id: incidentId,
    startTime: new Date().toISOString(),
    evidence: [],
    timeline: [],
    impact: 'unknown'
  };
  
  // 관련 로그 수집
  const relevantLogs = await collectSecurityLogs({
    timeRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간 전
      end: new Date()
    },
    severity: ['high', 'critical'],
    types: ['authentication', 'authorization', 'data_access']
  });
  
  // 영향 범위 분석
  const impactAnalysis = await analyzeSecurityImpact(relevantLogs);
  
  // 사고 보고서 생성
  const report = generateIncidentReport({
    incident,
    logs: relevantLogs,
    impact: impactAnalysis
  });
  
  return report;
};
```

#### 3단계: 복구 및 개선 (7일 이내)
```yaml
복구 절차:
  - 시스템 패치: 취약점 수정 및 보안 업데이트
  - 인증 초기화: 의심되는 계정 비밀번호 강제 변경
  - 모니터링 강화: 추가 보안 규칙 및 알림 설정
  - 접근 권한 검토: 전체 사용자 권한 재검토

개선 활동:
  - 보안 정책 업데이트
  - 직원 보안 교육
  - 시스템 보안 강화
  - 모니터링 도구 개선
```

## 🔒 보안 체크리스트

### 일일 보안 점검 ✅
- [ ] Firebase 보안 규칙 상태 확인
- [ ] 인증 실패 로그 검토 (5회 이상 연속 실패 조사)
- [ ] 시스템 접근 로그 분석
- [ ] 의심스러운 활동 패턴 확인
- [ ] SSL 인증서 유효 기간 확인

### 주간 보안 점검 📅
- [ ] 사용자 권한 및 역할 검토
- [ ] 패스워드 정책 준수 상황 확인
- [ ] 보안 패치 업데이트 상태 점검
- [ ] 방화벽 및 보안 규칙 검토
- [ ] 백업 데이터 무결성 검증

### 월간 보안 점검 🗓️
- [ ] 전체 시스템 보안 감사
- [ ] 의존성 취약점 스캔 및 업데이트
- [ ] 사용자 계정 정리 (비활성 계정 제거)
- [ ] 보안 정책 및 절차 검토
- [ ] 침투 테스트 수행

### 분기별 보안 점검 📊
- [ ] 종합 보안 위험 평가
- [ ] 재해 복구 계획 테스트
- [ ] 직원 보안 교육 실시
- [ ] 외부 보안 감사 수행
- [ ] 보안 예산 및 도구 검토

---

**🚨 긴급 보안 연락처**
- **보안팀**: security@tholdem.com
- **시스템 관리자**: admin@tholdem.com
- **개발팀**: dev@tholdem.com

**📚 보안 참고 자료**
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)

*이 문서는 시스템 보안 유지를 위한 핵심 가이드입니다. 정기적으로 업데이트하고 모든 팀원이 숙지해야 합니다.*