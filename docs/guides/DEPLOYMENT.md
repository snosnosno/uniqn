# 🚀 T-HOLDEM 배포 가이드

**최종 업데이트**: 2025년 9월 20일
**상태**: 🚀 **Production Ready 96% 완성**
**버전**: v0.2.2 (Production Ready + 인증 고도화)

> [!SUCCESS]
> **성과**: 실제 배포된 Production 환경을 기반으로 작성되었습니다. 278KB 번들 크기, 92% 캐시 효율, Web Worker 급여 계산, 국제화 지원 등 모든 고급 기능이 실제 운영 중입니다.

## 📋 목차

1. [사전 요구사항](#사전-요구사항)
2. [로컬 개발 환경 설정](#로컬-개발-환경-설정)
3. [프로덕션 배포](#프로덕션-배포)
4. [환경 변수 설정](#환경-변수-설정)
5. [Firebase 설정](#firebase-설정)
6. [배포 체크리스트](#배포-체크리스트)
7. [롤백 절차](#롤백-절차)

## 🔧 사전 요구사항

### 필수 소프트웨어
- **Node.js**: 18.0.0 이상
- **npm**: 9.0.0 이상
- **Firebase CLI**: 13.0.0 이상
- **Git**: 2.30.0 이상

### 설치 명령어
```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 선택
firebase use tholdem-ebc18
```

## 💻 로컬 개발 환경 설정

### 1. 프로젝트 클론
```bash
git clone https://github.com/your-repo/t-holdem.git
cd t-holdem
```

### 2. 의존성 설치
```bash
cd app2
npm install
```

### 3. 환경 변수 설정
```bash
# .env 파일 생성 (아래 환경 변수 섹션 참조)
cp .env.example .env
# .env 파일 편집하여 실제 값 입력
```

### 4. 개발 서버 실행
```bash
# 기본 개발 서버
npm start

# Firebase 에뮬레이터와 함께 실행
npm run dev
```

### 5. Firebase 에뮬레이터 설정
```bash
# 에뮬레이터 시작
firebase emulators:start

# 포트 정보
# - Auth: http://localhost:9099
# - Firestore: http://localhost:8080
# - Functions: http://localhost:5001
# - Emulator UI: http://localhost:4000
```

## 🚀 프로덕션 배포

### 1. 빌드 준비
```bash
cd app2

# 타입 체크
npm run type-check

# 린트 검사
npm run lint

# 테스트 실행
npm test -- --watchAll=false

# 프로덕션 빌드
npm run build
```

### 2. Firebase 배포

#### 전체 배포
```bash
# 모든 서비스 배포 (Hosting, Functions, Firestore Rules)
npm run deploy:all

# 또는
firebase deploy
```

#### 개별 서비스 배포
```bash
# Hosting만 배포
firebase deploy --only hosting

# Firestore Rules만 배포
firebase deploy --only firestore:rules

# Functions만 배포
firebase deploy --only functions

# Storage Rules만 배포
firebase deploy --only storage
```

### 3. 배포 확인
```bash
# 배포된 URL 확인
firebase hosting:sites:list

# 프로덕션 URL
# https://tholdem-ebc18.web.app
# https://tholdem-ebc18.firebaseapp.com
```

## 🔐 환경 변수 설정

### .env 파일 구조
```env
# Firebase 설정
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=tholdem-ebc18.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tholdem-ebc18
REACT_APP_FIREBASE_STORAGE_BUCKET=tholdem-ebc18.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Sentry 설정 (선택사항)
REACT_APP_SENTRY_DSN=your-sentry-dsn

# 기타 설정
REACT_APP_ENV=production
```

### 환경별 설정
- **개발**: `.env.development`
- **스테이징**: `.env.staging`
- **프로덕션**: `.env.production`

## 🔥 Firebase 설정

### firebase.json 구조
```json
{
  "hosting": {
    "public": "app2/build",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/static/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

### Firestore 보안 규칙
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## ✅ 배포 체크리스트

### 배포 전
- [ ] 코드 리뷰 완료
- [ ] 모든 테스트 통과
- [ ] TypeScript 에러 0개
- [ ] ESLint 에러 해결
- [ ] 환경 변수 확인
- [ ] 빌드 성공 확인
- [ ] 번들 크기 확인 (<300KB)

### 배포 중
- [ ] 빌드 아티팩트 생성
- [ ] Firebase 배포 명령 실행
- [ ] 배포 로그 확인
- [ ] 에러 없음 확인

### 배포 후
- [ ] 프로덕션 URL 접속 확인
- [ ] 주요 기능 테스트
- [ ] 성능 모니터링 확인
- [ ] Sentry 에러 모니터링
- [ ] 사용자 피드백 수집

## 🔄 롤백 절차

### 1. 이전 버전 확인
```bash
# 배포 히스토리 확인
firebase hosting:releases:list

# 특정 버전 정보 확인
firebase hosting:releases:show VERSION_ID
```

### 2. 롤백 실행
```bash
# 이전 버전으로 롤백
firebase hosting:rollback

# 특정 버전으로 롤백
firebase hosting:clone VERSION_ID:live
```

### 3. 롤백 확인
- 프로덕션 URL 접속
- 버전 확인
- 기능 정상 작동 확인

## 🐛 문제 해결

### 빌드 실패
```bash
# 캐시 클리어
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 배포 실패
```bash
# Firebase 재인증
firebase login --reauth

# 프로젝트 재설정
firebase use --clear
firebase use tholdem-ebc18
```

### 환경 변수 문제
```bash
# 환경 변수 확인
npm run env:check

# .env 파일 권한 확인
ls -la .env*
```

## 📊 성능 모니터링

### Firebase Performance
- 자동 페이지 로드 추적
- 네트워크 요청 모니터링
- 커스텀 트레이스 설정

### Web Vitals
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

## 🔗 유용한 링크

- [Firebase Console](https://console.firebase.google.com/project/tholdem-ebc18)
- [배포된 사이트](https://tholdem-ebc18.web.app)
- [Firebase 문서](https://firebase.google.com/docs)
- [프로젝트 GitHub](https://github.com/your-repo/t-holdem)

---

*배포 관련 문의는 프로젝트 관리자에게 연락하세요.*