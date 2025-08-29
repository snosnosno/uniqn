# 🔒 T-HOLDEM 보안 정책

**버전**: 1.0.0 | **업데이트**: 2025년 1월 30일

## 🚨 보안 취약점 보고

보안 취약점을 발견하셨다면, **공개 이슈로 보고하지 마시고** 다음 절차를 따라주세요:

1. 이메일로 보고: [보안 담당자 이메일]
2. 취약점 상세 설명 포함
3. 재현 가능한 단계 제공
4. 가능한 경우 해결 방안 제안

응답 시간: 48시간 이내

## 📋 보안 체크리스트

### 개발 환경
- [ ] `.env` 파일이 `.gitignore`에 포함되었는가?
- [ ] 민감한 정보가 코드에 하드코딩되지 않았는가?
- [ ] 서비스 계정 키가 저장소에 포함되지 않았는가?
- [ ] `console.log`로 민감한 정보를 출력하지 않는가?

### Firebase 보안
- [ ] Firestore 보안 규칙이 적절히 설정되었는가?
- [ ] Storage 보안 규칙이 설정되었는가?
- [ ] Functions에 인증 검증이 구현되었는가?
- [ ] API 키가 도메인 제한이 설정되었는가?

### 코드 보안
- [ ] 사용자 입력이 sanitize되는가?
- [ ] XSS 방지 처리가 되어있는가?
- [ ] CSRF 토큰이 구현되었는가?
- [ ] SQL Injection 방지 처리가 되어있는가?

### 인증 및 권한
- [ ] 비밀번호 최소 요구사항이 설정되었는가?
- [ ] 역할 기반 접근 제어(RBAC)가 구현되었는가?
- [ ] 세션 타임아웃이 설정되었는가?
- [ ] 다중 인증(MFA) 옵션이 제공되는가?

## 🛡️ 보안 설정

### 1. 환경 변수 관리

**절대 하지 말아야 할 것:**
```javascript
// ❌ 잘못된 예
const API_KEY = "AIzaSyA..."; // 하드코딩 금지
```

**올바른 방법:**
```javascript
// ✅ 올바른 예
const API_KEY = process.env.REACT_APP_FIREBASE_API_KEY;
```

### 2. Firestore 보안 규칙

```javascript
// 기본 보안 규칙
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근
    function isSignedIn() {
      return request.auth != null;
    }
    
    // 역할 확인
    function hasRole(role) {
      return request.auth.token.role == role;
    }
    
    // XSS 방지
    function hasNoXSS(text) {
      return !text.matches('.*<script.*>.*</script>.*');
    }
  }
}
```

### 3. XSS 방지

```typescript
// sanitizer.ts 사용
import { sanitizeText, sanitizeHtml } from '@/utils/security/sanitizer';

// 사용자 입력 처리
const safeInput = sanitizeText(userInput);
const safeHtml = sanitizeHtml(htmlContent);
```

### 4. CSRF 방지

```typescript
// csrf.ts 사용
import { ensureCsrfToken, validateCsrfToken } from '@/utils/security/csrf';

// 요청 시 토큰 포함
const token = ensureCsrfToken();
headers['X-CSRF-Token'] = token;

// 검증
if (!validateCsrfToken(requestToken)) {
  throw new Error('Invalid CSRF token');
}
```

## 🔐 민감한 정보 관리

### 금지된 파일 패턴
`.gitignore`에 반드시 포함:
- `*.env`
- `*.key`
- `*.pem`
- `*.cert`
- `*-service-account.json`
- `*-adminsdk-*.json`
- `serviceAccountKey*.json`

### 서비스 계정 키 관리
1. **절대 Git에 커밋하지 않기**
2. 환경 변수 또는 시크릿 매니저 사용
3. 정기적으로 키 순환
4. 최소 권한 원칙 적용

## 🚑 비상 대응 절차

### 보안 사고 발생 시

#### 1단계: 즉시 차단
```bash
# Firebase 프로젝트 일시 중단
firebase hosting:disable

# API 키 비활성화 (Firebase Console에서)
```

#### 2단계: 평가
- 영향 범위 파악
- 침해 경로 분석
- 데이터 유출 여부 확인

#### 3단계: 복구
- 취약점 패치
- 새 API 키 생성
- 비밀번호 재설정 요구
- 보안 감사 실시

#### 4단계: 사후 조치
- 사고 보고서 작성
- 재발 방지 대책 수립
- 보안 교육 실시

## 📊 보안 감사

### 정기 점검 (월 1회)
- [ ] npm audit 실행
- [ ] 의존성 업데이트
- [ ] 보안 규칙 검토
- [ ] 접근 로그 분석

### 분기별 점검
- [ ] 침투 테스트
- [ ] 코드 보안 검토
- [ ] 권한 감사
- [ ] 인증서 만료 확인

## 🔧 보안 도구

### 의존성 검사
```bash
# npm 보안 감사
npm audit

# 자동 수정
npm audit fix

# 강제 수정 (주의 필요)
npm audit fix --force
```

### Git 히스토리 정리
```bash
# BFG Repo-Cleaner 사용 (권장)
java -jar bfg.jar --delete-files "*.key" .
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 또는 git filter-branch 사용
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch serviceAccountKey.json" \
  --prune-empty --tag-name-filter cat -- --all
```

## 📚 보안 리소스

- [Firebase 보안 체크리스트](https://firebase.google.com/docs/rules/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React 보안 가이드](https://reactjs.org/docs/security.html)
- [npm 보안 가이드](https://docs.npmjs.com/packages-and-modules/securing-your-code)

## 🏆 보안 기여자

보안 취약점을 책임감 있게 보고해주신 분들께 감사드립니다.

---

*이 문서는 지속적으로 업데이트됩니다. 최신 버전은 저장소에서 확인하세요.*