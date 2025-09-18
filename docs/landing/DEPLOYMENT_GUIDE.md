# T-HOLDEM 랜딩페이지 배포 가이드

## 📋 배포 개요

이 가이드는 T-HOLDEM 랜딩페이지를 프로덕션 환경에 배포하기 위한 단계별 지침을 제공합니다.

## 🛠 사전 준비사항

### 필수 도구
- Node.js 18+
- npm 9+
- Git
- Firebase CLI (Firebase 배포 시)

### 환경 확인
```bash
# Node.js 버전 확인
node --version  # v18.0.0+

# npm 버전 확인
npm --version   # 9.0.0+

# Git 설치 확인
git --version
```

## 🚀 배포 프로세스

### 1. 프로덕션 빌드 생성

```bash
# 프로젝트 디렉토리로 이동
cd app2

# 의존성 설치
npm install

# TypeScript 타입 검사
npm run type-check

# 프로덕션 빌드 생성
npm run build
```

**빌드 성공 지표:**
- ✅ 메인 번들: ~281.4 kB (gzipped)
- ✅ CSS: ~13.82 kB
- ✅ 총 42개 청크로 분리
- ✅ 컴파일 오류 없음

### 2. 빌드 결과물 검증

```bash
# 빌드 폴더 확인
ls -la build/

# 정적 서버로 로컬 테스트
npx serve -s build

# 또는 Python 간단 서버
python -m http.server 3000 -d build
```

**접근 URL:** http://localhost:3000

### 3. 성능 검증

```bash
# Lighthouse 성능 테스트
npx lighthouse http://localhost:3000 --output html --output-path lighthouse-report.html

# E2E 테스트 실행
npx playwright test --project=chromium
```

**기대 성과:**
- Performance: 90+ 점
- Accessibility: 95+ 점
- Best Practices: 90+ 점
- SEO: 90+ 점

## 🌐 배포 옵션

### Option 1: Firebase Hosting (권장)

#### 설정
```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 초기화 (이미 설정됨)
firebase init hosting
```

#### 배포
```bash
# 단일 배포
firebase deploy --only hosting

# 미리보기 배포
firebase hosting:channel:deploy preview
```

#### Firebase 설정 파일 (firebase.json)
```json
{
  "hosting": {
    "public": "build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### Option 2: Vercel

```bash
# Vercel CLI 설치
npm install -g vercel

# 프로젝트 배포
vercel --prod

# 환경 변수 설정 (필요시)
vercel env add
```

### Option 3: Netlify

```bash
# Netlify CLI 설치
npm install -g netlify-cli

# 빌드 및 배포
netlify deploy --prod --dir=build
```

### Option 4: AWS S3 + CloudFront

#### S3 버킷 설정
```bash
# AWS CLI 설치 후
aws s3 mb s3://your-bucket-name
aws s3 sync build/ s3://your-bucket-name
```

#### CloudFront 배포
- S3 버킷을 Origin으로 설정
- Gzip 압축 활성화
- Cache policy 설정

## ⚙️ 환경 설정

### 환경 변수 (.env.production)
```bash
# React 앱 기본 설정
REACT_APP_VERSION=0.2.1
REACT_APP_BUILD_DATE=2025-09-18

# Firebase 설정 (필요시)
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id

# 분석 도구 (선택사항)
REACT_APP_GA_TRACKING_ID=GA-XXXXXXXXX
REACT_APP_HOTJAR_ID=your_hotjar_id
```

### package.json 스크립트
```json
{
  "scripts": {
    "build": "react-scripts build",
    "build:analyze": "npm run build && npx webpack-bundle-analyzer build/static/js/*.js",
    "deploy:firebase": "npm run build && firebase deploy --only hosting",
    "deploy:preview": "npm run build && firebase hosting:channel:deploy preview"
  }
}
```

## 🔧 최적화 설정

### 1. 웹서버 설정 (Apache/Nginx)

#### Apache (.htaccess)
```apache
# Gzip 압축
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# 브라우저 캐싱
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# React Router 지원
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/build;
    index index.html;

    # Gzip 압축
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    # 브라우저 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router 지원
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 2. CDN 설정

#### CloudFlare 설정
- **Auto Minify**: JavaScript, CSS, HTML 활성화
- **Brotli Compression**: 활성화
- **Cache Everything**: Page Rules 설정
- **Browser TTL**: 1년 설정

## 📊 모니터링 설정

### 1. Google Analytics 4

```javascript
// public/index.html에 추가
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### 2. 성능 모니터링

```javascript
// src/utils/monitoring.js
export const trackPerformance = () => {
  // Core Web Vitals 측정
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 성능 데이터 수집 및 전송
        console.log(`${entry.name}: ${entry.value}`);
      }
    });

    observer.observe({entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']});
  }
};
```

### 3. 에러 추적

```javascript
// Sentry 설정 (선택사항)
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: process.env.NODE_ENV,
});
```

## 🔍 배포 후 검증

### 1. 기능 테스트 체크리스트

- [ ] 페이지 로딩 (<3초)
- [ ] 모든 섹션 표시
- [ ] CTA 버튼 작동
- [ ] 반응형 디자인 (모바일/태블릿/데스크톱)
- [ ] 크로스 브라우저 호환성 (Chrome, Firefox, Safari)
- [ ] 접근성 (키보드 네비게이션, 스크린 리더)

### 2. 성능 검증

```bash
# Lighthouse CI 검사
npx lhci autorun

# WebPageTest 검사
# https://www.webpagetest.org/
```

### 3. SEO 검증

- [ ] 메타 태그 확인
- [ ] Open Graph 태그
- [ ] Schema.org 마크업
- [ ] Sitemap 접근 가능
- [ ] robots.txt 설정

## 🚨 트러블슈팅

### 일반적인 문제들

#### 1. 빌드 실패
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# TypeScript 오류 해결
npm run type-check
```

#### 2. 라우팅 404 오류
- SPA 라우팅 설정 확인
- 웹서버 rewrites 규칙 설정

#### 3. 정적 리소스 로딩 실패
- 상대 경로 vs 절대 경로 확인
- CDN 설정 검토
- CORS 정책 확인

#### 4. 성능 이슈
```bash
# 번들 분석
npm run build:analyze

# 중복 코드 제거
npx webpack-bundle-analyzer build/static/js/*.js
```

## 🎯 배포 성공 기준

### 필수 지표
- ✅ **Build Size**: 메인 번들 <500KB (현재: 281.4KB)
- ✅ **Load Time**: <3초 (목표: <2초)
- ✅ **Lighthouse Score**: Performance 90+
- ✅ **Accessibility**: WCAG 2.1 AA 준수
- ✅ **Cross-Browser**: Chrome, Firefox, Safari 호환

### 선택 지표
- 📊 **Core Web Vitals**: 모든 지표 녹색
- 📱 **Mobile Performance**: 90+ 점
- 🔍 **SEO Score**: 90+ 점
- 🛡️ **Security**: HTTPS, Security Headers

## 📞 지원 및 문의

배포 과정에서 문제가 발생하면:

1. **문서 확인**: 이 가이드의 트러블슈팅 섹션
2. **로그 검토**: 빌드 및 배포 로그 분석
3. **성능 테스트**: Lighthouse 및 E2E 테스트 실행
4. **브라우저 개발자 도구**: 네트워크 및 콘솔 확인

---

*배포 가이드 작성일: 2025년 9월 18일*
*최신 업데이트: v0.2.1 Production Ready*