# Data Model: T-HOLDEM 랜딩페이지

**Date**: 2025-09-18
**Feature**: T-HOLDEM 랜딩페이지

## 엔티티 정의

### 1. Page Content (정적 콘텐츠)

#### HeroContent
```typescript
interface HeroContent {
  title: string;           // 메인 제목
  subtitle: string;        // 부제목
  description: string;     // 설명문
  ctaText: string;        // CTA 버튼 텍스트
  ctaLink: string;        // CTA 버튼 링크
  backgroundImage?: string; // 배경 이미지 (선택적)
}
```

#### FeatureItem
```typescript
interface FeatureItem {
  id: string;
  title: string;          // 기능 제목
  description: string;    // 기능 설명
  icon: string;          // 아이콘 이름 (Heroicons)
  benefits: string[];    // 혜택 목록
}

interface FeatureSection {
  title: string;
  subtitle: string;
  features: FeatureItem[];
}
```

#### TargetGroup
```typescript
interface TargetGroup {
  id: string;
  name: string;          // 타겟 그룹명 (대회사, 홀덤펍, 스태프)
  title: string;         // 타겟별 제목
  description: string;   // 타겟별 설명
  benefits: string[];    // 타겟별 혜택
  icon: string;         // 타겟 아이콘
  ctaText: string;      // 타겟별 CTA 텍스트
}
```

#### CTASection
```typescript
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

### 2. Component State (동적 상태)

#### ViewportState
```typescript
interface ViewportState {
  isMobile: boolean;     // 모바일 뷰포트 여부
  isTablet: boolean;     // 태블릿 뷰포트 여부
  scrollY: number;       // 스크롤 위치
  activeSection: string; // 현재 활성 섹션
}
```

#### UserInteraction
```typescript
interface UserInteraction {
  section: string;       // 상호작용한 섹션
  action: 'click' | 'scroll' | 'hover'; // 상호작용 유형
  element: string;       // 상호작용한 요소
  timestamp: number;     // 상호작용 시간
}
```

### 3. Navigation State

#### NavigationItem
```typescript
interface NavigationItem {
  id: string;
  label: string;
  href: string;
  section: string;       // 연결된 섹션 ID
}
```

## 데이터 흐름

### 정적 데이터 흐름
1. **콘텐츠 로딩**: 하드코딩된 콘텐츠 데이터를 컴포넌트에 전달
2. **섹션 렌더링**: 각 섹션 컴포넌트가 해당 데이터를 받아 렌더링
3. **반응형 조정**: 뷰포트 상태에 따라 레이아웃 조정

### 동적 상태 관리
1. **뷰포트 감지**: useEffect + window resize 이벤트
2. **스크롤 추적**: useEffect + window scroll 이벤트
3. **상호작용 로깅**: 클릭/호버 이벤트 핸들러

## 검증 규칙

### 콘텐츠 검증
- 모든 텍스트 필드는 빈 문자열이 아니어야 함
- CTA 링크는 유효한 URL 형식이어야 함
- 아이콘 이름은 Heroicons에 존재하는 아이콘이어야 함

### 상태 검증
- 스크롤 위치는 0 이상이어야 함
- 활성 섹션은 존재하는 섹션 ID여야 함
- 뷰포트 상태는 하나만 true여야 함 (모바일 OR 태블릿 OR 데스크톱)

## 성능 고려사항

### 메모이제이션
- 정적 콘텐츠 데이터는 useMemo로 메모이제이션
- 이벤트 핸들러는 useCallback으로 메모이제이션
- 섹션 컴포넌트는 React.memo로 래핑

### 지연 로딩
- 이미지는 Intersection Observer API 활용
- 하단 섹션은 필요시에만 렌더링

---

**결론**: 랜딩페이지의 모든 데이터 구조가 명확히 정의되었으며, 성능과 유지보수성을 고려한 설계가 완료되었습니다.