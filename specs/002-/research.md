# Research: T-HOLDEM 랜딩페이지

**Date**: 2025-09-18
**Feature**: T-HOLDEM 랜딩페이지 개발

## 기술 스택 결정

### React + TypeScript 선택
**Decision**: 기존 T-HOLDEM 프로젝트의 React 18.2.0 + TypeScript 4.9.5 스택 활용
**Rationale**:
- 기존 프로젝트와의 일관성 유지
- 개발팀의 기술 스택 숙련도 활용
- 컴포넌트 재사용 가능
- 기존 디자인 시스템 (Tailwind CSS) 활용

**Alternatives considered**:
- Next.js (SSG): SEO가 불필요하다고 명시되어 제외
- 순수 HTML/CSS: 기존 프로젝트와의 통합성 부족으로 제외

### UI 라이브러리 및 스타일링
**Decision**: Tailwind CSS 3.3.3 + Heroicons React 2.2.0
**Rationale**:
- 기존 프로젝트에서 사용 중인 스타일링 시스템
- 모바일 우선 설계에 최적화됨
- 유틸리티 클래스로 빠른 프로토타이핑 가능
- 아이콘 시스템 일관성 유지

**Alternatives considered**:
- Material-UI: 기존 디자인 시스템과 충돌
- Styled Components: 번들 크기 증가 우려

### 라우팅
**Decision**: React Router Dom 6.14.2 활용
**Rationale**:
- 기존 프로젝트에서 사용 중
- 랜딩페이지를 기존 앱 내 새 라우트로 추가
- SPA 내 네비게이션 일관성 유지

### 성능 최적화 전략
**Decision**:
1. React.memo 활용한 컴포넌트 메모이제이션
2. 이미지 최적화 (WebP, lazy loading)
3. 코드 스플리팅 (React.lazy)
4. Tailwind CSS 퍼징으로 번들 크기 최소화

**Rationale**: 모바일 3G 환경에서 3초 이하 로딩 목표 달성

## 랜딩페이지 구조 설계

### 페이지 섹션 구성
**Decision**: 4개 주요 섹션
1. **Hero Section**: 핵심 가치 제안 "구인구직 원스톱 솔루션"
2. **Feature Section**: 주요 기능 소개 (토너먼트 관리, 스태프 관리, 구인 관리, 급여 정산)
3. **Target Section**: 타겟별 혜택 (대회사, 홀덤펍, 스태프)
4. **CTA Section**: 가입 유도 및 연락처

**Rationale**: 사용자 여정 최적화 (인지 → 이해 → 관심 → 행동)

### 반응형 디자인 브레이크포인트
**Decision**: Tailwind 기본 브레이크포인트 활용
- Mobile: 320px - 768px (우선순위)
- Tablet: 768px - 1024px
- Desktop: 1024px+

**Rationale**: 모바일 우선 설계 원칙 준수

## 컴포넌트 아키텍처

### 컴포넌트 구조
**Decision**:
```
pages/LandingPage/
├── index.tsx              # 메인 페이지 컴포넌트
├── components/            # 섹션별 컴포넌트
│   ├── HeroSection.tsx
│   ├── FeatureSection.tsx
│   ├── TargetSection.tsx
│   └── CTASection.tsx
└── hooks/                 # 커스텀 훅
    └── useLandingAnalytics.ts
```

**Rationale**:
- 단일 책임 원칙 준수
- 컴포넌트별 독립적 테스트 가능
- 재사용성 고려

### 상태 관리
**Decision**: 로컬 상태만 사용 (useState, useEffect)
**Rationale**:
- 랜딩페이지는 주로 정적 콘텐츠
- 복잡한 상태 관리 불필요
- 번들 크기 최소화

## 테스트 전략

### 테스트 레벨
**Decision**:
1. **Unit Tests**: 각 섹션 컴포넌트별
2. **Integration Tests**: 페이지 전체 렌더링 및 상호작용
3. **E2E Tests**: 사용자 시나리오 기반 (모바일 우선)

**Rationale**: TDD 원칙 준수, 실제 사용자 시나리오 검증

### 테스트 도구
**Decision**:
- Unit/Integration: Jest + React Testing Library (기존 설정 활용)
- E2E: Playwright (기존 설정 활용)
- 성능 테스트: Lighthouse CI

## 배포 및 호스팅

### 배포 전략
**Decision**: 기존 Firebase 호스팅 활용
**Rationale**:
- 기존 인프라 활용
- 자동 HTTPS, CDN 제공
- 기존 CI/CD 파이프라인 활용

### 도메인 및 라우팅
**Decision**: 메인 도메인의 루트 경로 (/) 또는 /landing
**Rationale**:
- 랜딩페이지의 접근성 최대화
- SEO 불필요하므로 단순한 라우팅 구조

---

**결론**: 모든 기술적 요구사항이 명확하게 정의되었으며, 기존 T-HOLDEM 프로젝트의 기술 스택과 완전히 호환되는 솔루션을 설계했습니다.