# Quickstart: T-HOLDEM 랜딩페이지

**목적**: T-HOLDEM 랜딩페이지 개발, 테스트, 배포를 위한 빠른 시작 가이드

## 🚀 빠른 시작

### 1. 개발 환경 설정
```bash
# T-HOLDEM 프로젝트 루트로 이동
cd T-HOLDEM/app2

# 의존성 설치 (이미 설치된 경우 건너뛰기)
npm install

# 개발 서버 시작
npm start
```

### 2. 랜딩페이지 접속
- **로컬 개발**: http://localhost:3000/landing
- **기본 경로**: http://localhost:3000/ (설정에 따라)

## 📁 프로젝트 구조

```
app2/src/pages/LandingPage/
├── index.tsx                 # 메인 랜딩페이지 컴포넌트
├── components/               # 섹션별 컴포넌트
│   ├── HeroSection.tsx      # 히어로 섹션
│   ├── FeatureSection.tsx   # 기능 소개 섹션
│   ├── TargetSection.tsx    # 타겟별 정보 섹션
│   └── CTASection.tsx       # 가입 유도 섹션
└── hooks/
    └── useLandingAnalytics.ts # 사용자 상호작용 추적
```

## 🧪 테스트 실행

### Unit & Integration Tests
```bash
# 모든 테스트 실행
npm test

# 랜딩페이지 테스트만 실행
npm test -- --testPathPattern=LandingPage

# 커버리지와 함께 테스트
npm run test:coverage
```

### E2E Tests
```bash
# Playwright E2E 테스트
npm run test:e2e

# 헤드리스 모드로 실행
npm run test:e2e:headed

# 디버그 모드로 실행
npm run test:e2e:debug
```

## 🎯 핵심 검증 시나리오

### 1. 기본 렌더링 검증
- [ ] 랜딩페이지가 `/landing` 경로에서 로드됨
- [ ] 모든 섹션(Hero, Feature, Target, CTA)이 렌더링됨
- [ ] 모바일, 태블릿, 데스크톱에서 반응형 레이아웃 정상 작동

### 2. 콘텐츠 검증
- [ ] Hero 섹션에 "구인구직 원스톱 솔루션" 메시지 표시
- [ ] Feature 섹션에 4개 주요 기능 소개
- [ ] Target 섹션에 3개 타겟 그룹 정보 표시
- [ ] CTA 섹션에 가입 버튼과 연락처 정보 표시

### 3. 상호작용 검증
- [ ] CTA 버튼 클릭 시 가입 페이지로 이동
- [ ] 스크롤 시 섹션별 애니메이션 정상 작동
- [ ] 모바일에서 터치 상호작용 정상 작동

### 4. 성능 검증
- [ ] 초기 로딩 시간 < 3초 (3G 네트워크 시뮬레이션)
- [ ] LCP (Largest Contentful Paint) < 2.5초
- [ ] 이미지 지연 로딩 정상 작동

## 🛠 개발 워크플로우

### 1. 새 컴포넌트 추가
```bash
# 1. 테스트 먼저 작성
touch src/pages/LandingPage/components/NewComponent.test.tsx

# 2. 컴포넌트 구현
touch src/pages/LandingPage/components/NewComponent.tsx

# 3. 테스트 실행하여 RED 확인
npm test -- --testPathPattern=NewComponent

# 4. 구현하여 GREEN 달성
# 5. 리팩토링 (필요시)
```

### 2. 스타일링 가이드라인
```typescript
// Tailwind CSS 클래스 사용 예시
<section className="py-16 px-4 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-8">
      구인구직 원스톱 솔루션
    </h2>
  </div>
</section>
```

### 3. 반응형 디자인 체크리스트
- [ ] 모바일 (320px-768px): 단일 컬럼, 터치 친화적 버튼
- [ ] 태블릿 (768px-1024px): 2컬럼 레이아웃
- [ ] 데스크톱 (1024px+): 3-4컬럼 레이아웃

## 🚀 배포

### 프로덕션 빌드
```bash
# 프로덕션 빌드 생성
npm run build

# 빌드 결과 확인
npm run analyze

# Firebase 배포
npm run deploy:all
```

### 배포 검증
- [ ] https://tholdem-ebc18.web.app/landing 접속 가능
- [ ] 모든 리소스 정상 로드
- [ ] HTTPS 적용 확인
- [ ] 모바일 브라우저에서 접속 테스트

## 🔧 문제해결

### 일반적인 문제
1. **컴포넌트가 렌더링되지 않음**
   - React Router 설정 확인
   - 컴포넌트 export/import 확인

2. **스타일이 적용되지 않음**
   - Tailwind CSS 클래스명 확인
   - 빌드 시 CSS 퍼징 설정 확인

3. **모바일에서 레이아웃 깨짐**
   - 뷰포트 메타 태그 확인
   - 반응형 클래스 적용 확인

### 성능 이슈
1. **로딩 속도 느림**
   - 이미지 최적화 (WebP 변환)
   - 번들 크기 분석 (`npm run analyze:bundle`)
   - 불필요한 의존성 제거

2. **스크롤 성능 저하**
   - 스크롤 이벤트 디바운싱 적용
   - Intersection Observer API 활용

## 📊 성능 모니터링

### Lighthouse 점수 목표
- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 95+
- **SEO**: N/A (불필요)

### 측정 도구
```bash
# Lighthouse CI 실행
npm run lighthouse

# 번들 분석
npm run analyze:bundle

# 성능 프로파일링
npm run analyze:bundle:interactive
```

---

**성공 기준**: 위의 모든 검증 시나리오가 통과하고, 성능 목표를 달성하면 랜딩페이지가 성공적으로 구현된 것입니다.