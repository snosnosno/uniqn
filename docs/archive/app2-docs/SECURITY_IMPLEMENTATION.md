# 보안 강화 구현 문서

## 개요
T-HOLDEM 애플리케이션의 보안을 강화하기 위해 CSP(Content Security Policy), XSS 방지, CSRF 보호를 구현했습니다.

## 구현 내용

### 1. Content Security Policy (CSP)
**위치**: `public/index.html`

CSP 헤더를 통해 다음을 제한합니다:
- 스크립트 소스: 자체 호스트 + Firebase/Google 서비스만 허용
- 스타일 소스: 자체 호스트 + Google Fonts만 허용
- 이미지 소스: 자체 호스트 + data: URL + HTTPS만 허용
- 연결 소스: Firebase API만 허용
- iframe 소스: Firebase App만 허용
- 객체 임베딩: 완전 차단

### 2. XSS (Cross-Site Scripting) 방지

#### DOMPurify를 사용한 입력 값 정제
**위치**: `src/utils/security/sanitizer.ts`

주요 기능:
- `sanitizeHtml()`: HTML 태그 포함 텍스트를 안전하게 정제
- `sanitizeText()`: 모든 HTML 태그 제거
- `isSafeUrl()`: URL 검증 (javascript: 프로토콜 차단)
- `sanitizeFormData()`: 폼 데이터 일괄 정제

#### 사용 예시:
```typescript
import { sanitizeText, sanitizeFormData } from '../utils/security/sanitizer';

// 텍스트 입력 정제
const safeName = sanitizeText(userInput.name);

// 폼 데이터 정제
const safeFormData = sanitizeFormData({
  title: formData.title,
  description: formData.description
});
```

### 3. CSRF (Cross-Site Request Forgery) 보호

#### CSRF 토큰 관리
**위치**: `src/utils/security/csrf.ts`

주요 기능:
- 세션별 고유 CSRF 토큰 생성
- 1시간 만료 시간 설정
- 자동 토큰 갱신 (50분마다)
- HTTP 요청에 토큰 헤더 자동 추가

#### 사용 예시:
```typescript
import { ensureCsrfToken, addCsrfHeader } from '../utils/security/csrf';

// 토큰 확인/생성
const token = ensureCsrfToken();

// API 요청 시 헤더 추가
fetch('/api/data', {
  method: 'POST',
  headers: addCsrfHeader({
    'Content-Type': 'application/json'
  }),
  body: JSON.stringify(data)
});
```

### 4. React Hooks

#### useSecurity Hook
**위치**: `src/hooks/useSecurity.ts`

제공 기능:
- `renderSafeHtml()`: 안전한 HTML 렌더링
- `safeText()`: 텍스트 정제
- `safeUrl()`: URL 검증
- `getCsrfToken()`: CSRF 토큰 획득
- XSS 시도 자동 감지

#### useFrameBuster Hook
iframe 내 실행 방지 (Clickjacking 방어)

#### useSecureStorage Hook
localStorage 사용 시 XSS 패턴 자동 검사

### 5. Firebase Security Rules 강화
**위치**: `firestore.rules`

추가된 보안 검증:
- XSS 패턴 검사 함수 (`hasNoXSS`)
- SQL Injection 패턴 검사 (`hasNoSQLInjection`)
- 안전한 텍스트 검증 (`isSafeText`)
- 문자열 길이 제한

### 6. Express 서버 보안 미들웨어 (Production)
**위치**: `server/security-middleware.js`

구현 내용:
- Helmet을 통한 보안 헤더 설정
- Rate Limiting (요청 제한)
- XSS Clean
- NoSQL Injection 방지
- HTTP Parameter Pollution 방지
- CORS 설정

## 설치 및 설정

### 1. 필요한 패키지 설치
```bash
# 클라이언트 의존성
npm install dompurify @types/dompurify --save

# 서버 의존성 (production 환경용)
npm install helmet express-rate-limit express-mongo-sanitize xss-clean hpp --save-dev
```

### 2. 환경 변수 설정 (production)
```env
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
NODE_ENV=production
```

## 보안 체크리스트

### 완료된 항목 ✅
- [x] CSP 헤더 설정
- [x] XSS 방지 유틸리티 구현
- [x] CSRF 토큰 시스템 구현
- [x] 보안 관련 React Hooks
- [x] Firebase Security Rules 강화
- [x] Express 보안 미들웨어 준비

### 추가 권장 사항 📋
- [ ] HTTPS 강제 적용 (production)
- [ ] 2단계 인증 구현
- [ ] 비밀번호 복잡도 검증 강화
- [ ] 로그인 실패 시 계정 잠금
- [ ] 민감한 데이터 암호화
- [ ] 정기적인 보안 감사

## 주의사항

1. **CSP 설정 조정**
   - 새로운 외부 스크립트/스타일 추가 시 CSP 정책 업데이트 필요
   - 개발 환경에서는 'unsafe-inline' 허용, production에서는 제거 권장

2. **CSRF 토큰**
   - SPA 특성상 페이지 새로고침 없이 장시간 사용 시 토큰 만료 주의
   - 50분마다 자동 갱신되지만, 오랜 유휴 시간 후에는 재로그인 필요

3. **입력 값 정제**
   - 사용자 입력은 항상 sanitize 후 사용
   - 특히 HTML 렌더링이 필요한 경우 renderSafeHtml 사용 필수

4. **Firebase Rules**
   - 새로운 필드 추가 시 isSafeText 검증 추가
   - 텍스트 길이 제한 설정 필수

## 테스트 방법

### XSS 테스트
```javascript
// 입력 필드에 다음 시도
<script>alert('XSS')</script>
<img src=x onerror="alert('XSS')">
javascript:alert('XSS')
```

### CSRF 테스트
1. 개발자 도구 > Application > Session Storage
2. CSRF 토큰 확인
3. API 요청 시 헤더에 토큰 포함 확인

### CSP 테스트
1. 개발자 도구 > Console
2. CSP 위반 시 경고 메시지 확인
3. Network 탭에서 차단된 리소스 확인