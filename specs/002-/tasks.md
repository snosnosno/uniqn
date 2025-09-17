# Tasks: T-HOLDEM 랜딩페이지

**Input**: 설계 문서들 from `/specs/002-/`
**Prerequisites**: research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## 실행 흐름 (main)
```
1. plan.md에서 기술 스택 추출: React 18.2.0 + TypeScript 4.9.5, Tailwind CSS
2. 설계 문서 로드 완료:
   → data-model.md: HeroContent, FeatureItem, TargetGroup, CTASection 엔티티
   → contracts/: / 경로, /landing 경로, /api/analytics/interaction API
   → research.md: 4개 섹션 구조, 성능 최적화 전략
   → quickstart.md: TDD 워크플로우, 테스트 시나리오
3. 태스크 카테고리별 생성:
   → Setup: 라우팅 설정, 폴더 구조
   → Tests: 컴포넌트 테스트, E2E 테스트 (TDD)
   → Core: 섹션별 컴포넌트 구현
   → Integration: 라우팅 연결, 성능 최적화
   → Polish: 유닛 테스트, 배포 준비
4. 태스크 규칙 적용:
   → 독립적인 파일 = [P] 병렬 실행 가능
   → 같은 파일 = 순차 실행
   → TDD: 테스트 먼저, 구현 나중
5. 순차 번호 부여 (T001, T002...)
6. 의존성 그래프 생성 완료
```

## 포맷: `[ID] [P?] 설명`
- **[P]**: 병렬 실행 가능 (독립적인 파일, 의존성 없음)
- 설명에 정확한 파일 경로 포함

## 경로 규칙
- **Web app**: `app2/src/` (기존 T-HOLDEM React 앱 확장)
- 기존 프로젝트 구조를 따라 `app2/src/pages/LandingPage/` 추가

## Phase 3.1: 프로젝트 설정
- [ ] T001 랜딩페이지 폴더 구조 생성 (app2/src/pages/LandingPage/)
- [ ] T002 기존 App.tsx에 /landing 라우트 추가
- [ ] T003 [P] TypeScript 인터페이스 정의 (app2/src/pages/LandingPage/types.ts)

## Phase 3.2: 테스트 우선 (TDD) ⚠️ 3.3 단계 전에 필수 완료
**중요: 이 테스트들은 먼저 작성되어야 하며 구현 전에 실패해야 함**
- [ ] T004 [P] HeroSection 컴포넌트 테스트 (app2/src/pages/LandingPage/components/HeroSection.test.tsx)
- [ ] T005 [P] FeatureSection 컴포넌트 테스트 (app2/src/pages/LandingPage/components/FeatureSection.test.tsx)
- [ ] T006 [P] TargetSection 컴포넌트 테스트 (app2/src/pages/LandingPage/components/TargetSection.test.tsx)
- [ ] T007 [P] CTASection 컴포넌트 테스트 (app2/src/pages/LandingPage/components/CTASection.test.tsx)
- [ ] T008 [P] 메인 LandingPage 컴포넌트 테스트 (app2/src/pages/LandingPage/index.test.tsx)
- [ ] T009 [P] useLandingAnalytics 훅 테스트 (app2/src/pages/LandingPage/hooks/useLandingAnalytics.test.ts)
- [ ] T010 [P] 라우팅 테스트 (/landing 경로) (app2/src/pages/LandingPage/LandingPage.route.test.tsx)

## Phase 3.3: 핵심 구현 (테스트 실패 확인 후에만)
- [ ] T011 [P] HeroSection 컴포넌트 (app2/src/pages/LandingPage/components/HeroSection.tsx)
- [ ] T012 [P] FeatureSection 컴포넌트 (app2/src/pages/LandingPage/components/FeatureSection.tsx)
- [ ] T013 [P] TargetSection 컴포넌트 (app2/src/pages/LandingPage/components/TargetSection.tsx)
- [ ] T014 [P] CTASection 컴포넌트 (app2/src/pages/LandingPage/components/CTASection.tsx)
- [ ] T015 useLandingAnalytics 훅 구현 (app2/src/pages/LandingPage/hooks/useLandingAnalytics.ts)
- [ ] T016 메인 LandingPage 컴포넌트 (app2/src/pages/LandingPage/index.tsx)

## Phase 3.4: 통합 및 연결
- [ ] T017 App.tsx에서 LandingPage 라우트 연결
- [ ] T018 반응형 스타일링 적용 (모바일/태블릿/데스크톱)
- [ ] T019 React.memo를 이용한 성능 최적화
- [ ] T020 이미지 최적화 및 lazy loading 구현
- [ ] T021 코드 스플리팅 적용 (React.lazy)

## Phase 3.5: E2E 테스트 및 품질 보증
- [ ] T022 [P] E2E 테스트: 랜딩페이지 기본 렌더링 (app2/e2e/landing-page-rendering.spec.ts)
- [ ] T023 [P] E2E 테스트: 콘텐츠 검증 (app2/e2e/landing-page-content.spec.ts)
- [ ] T024 [P] E2E 테스트: 상호작용 검증 (app2/e2e/landing-page-interaction.spec.ts)
- [ ] T025 [P] E2E 테스트: 성능 검증 (app2/e2e/landing-page-performance.spec.ts)
- [ ] T026 [P] E2E 테스트: 반응형 레이아웃 (app2/e2e/landing-page-responsive.spec.ts)

## Phase 3.6: 마무리 및 배포 준비
- [ ] T027 [P] 유닛 테스트 커버리지 보완
- [ ] T028 성능 측정 및 최적화 (<3초 로딩, LCP <2.5초)
- [ ] T029 [P] 접근성 검증 및 개선
- [ ] T030 Firebase 호스팅 배포 설정 업데이트
- [ ] T031 프로덕션 빌드 테스트 및 검증
- [ ] T032 [P] 문서 업데이트 (README.md, 사용 가이드)

## 의존성
- 테스트 (T004-T010) → 구현 (T011-T016)
- T003 → T011-T016 (타입 정의 필요)
- T011-T016 → T017 (컴포넌트 완성 후 라우팅)
- T017 → T018-T021 (라우팅 연결 후 최적화)
- T016, T017 → T022-T026 (메인 컴포넌트 완성 후 E2E 테스트)
- T021 → T028 (코드 스플리팅 후 성능 측정)

## 병렬 실행 예시
```
# T004-T010 함께 실행 (테스트 작성):
Task: "HeroSection 컴포넌트 테스트 작성 - app2/src/pages/LandingPage/components/HeroSection.test.tsx"
Task: "FeatureSection 컴포넌트 테스트 작성 - app2/src/pages/LandingPage/components/FeatureSection.test.tsx"
Task: "TargetSection 컴포넌트 테스트 작성 - app2/src/pages/LandingPage/components/TargetSection.test.tsx"
Task: "CTASection 컴포넌트 테스트 작성 - app2/src/pages/LandingPage/components/CTASection.test.tsx"

# T011-T014 함께 실행 (섹션 컴포넌트 구현):
Task: "HeroSection 컴포넌트 구현 - app2/src/pages/LandingPage/components/HeroSection.tsx"
Task: "FeatureSection 컴포넌트 구현 - app2/src/pages/LandingPage/components/FeatureSection.tsx"
Task: "TargetSection 컴포넌트 구현 - app2/src/pages/LandingPage/components/TargetSection.tsx"
Task: "CTASection 컴포넌트 구현 - app2/src/pages/LandingPage/components/CTASection.tsx"

# T022-T026 함께 실행 (E2E 테스트):
Task: "E2E 렌더링 테스트 - app2/e2e/landing-page-rendering.spec.ts"
Task: "E2E 콘텐츠 테스트 - app2/e2e/landing-page-content.spec.ts"
Task: "E2E 상호작용 테스트 - app2/e2e/landing-page-interaction.spec.ts"
```

## 주요 데이터 구조
### 기반 인터페이스 (T003에서 정의)
```typescript
interface HeroContent {
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
}

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  benefits: string[];
}

interface TargetGroup {
  id: string;
  name: string;
  title: string;
  description: string;
  benefits: string[];
  icon: string;
  ctaText: string;
}

interface CTASection {
  title: string;
  description: string;
  primaryCTA: {
    text: string;
    link: string;
    variant: 'primary' | 'secondary';
  };
  secondaryCTA?: {
    text: string;
    link: string;
    variant: 'primary' | 'secondary';
  };
}
```

## API 엔드포인트 (계약 기반)
- GET `/` → 랜딩페이지 렌더링
- GET `/landing` → 랜딩페이지 대체 경로
- POST `/api/analytics/interaction` → 사용자 상호작용 로깅

## 성능 목표
- 3G 네트워크에서 3초 이하 로딩
- LCP (Largest Contentful Paint) < 2.5초
- 번들 크기 < 500KB
- Lighthouse 성능 점수 90+

## 노트
- [P] 태스크 = 독립적인 파일, 의존성 없음
- 구현 전 테스트 실패 확인 필수
- 각 태스크 후 커밋
- 회피 사항: 모호한 태스크, 같은 파일 충돌

## 태스크 생성 규칙
*main() 실행 중 적용됨*

1. **계약서에서**:
   - 각 라우트 → 라우팅 테스트 태스크 [P]
   - 각 API → API 구현 태스크

2. **데이터 모델에서**:
   - 각 엔티티 → 인터페이스 정의 태스크 [P]
   - 컴포넌트 구조 → 컴포넌트 구현 태스크

3. **사용자 시나리오에서**:
   - 각 시나리오 → E2E 테스트 [P]
   - 퀵스타트 시나리오 → 검증 태스크

4. **순서**:
   - 설정 → 테스트 → 컴포넌트 → 라우팅 → 최적화 → 마무리
   - 의존성은 병렬 실행을 차단

## 검증 체크리스트
*main()에서 반환 전 확인*

- [x] 모든 계약에 해당하는 테스트 있음
- [x] 모든 엔티티에 모델 태스크 있음
- [x] 모든 테스트가 구현보다 먼저 옴
- [x] 병렬 태스크가 진정으로 독립적임
- [x] 각 태스크에 정확한 파일 경로 명시됨
- [x] [P] 태스크끼리 같은 파일 수정 안함

---

**준비 완료**: 총 32개 태스크가 생성되었으며, TDD 원칙에 따라 테스트 우선 개발이 가능하도록 구성되었습니다. 병렬 실행으로 개발 속도를 높일 수 있습니다.