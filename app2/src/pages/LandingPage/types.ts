/**
 * T-HOLDEM 랜딩페이지 TypeScript 인터페이스 정의
 *
 * @description 랜딩페이지에서 사용되는 모든 데이터 타입을 정의합니다.
 * 이 파일은 data-model.md 문서를 기반으로 작성되었습니다.
 */

// 1. 정적 콘텐츠 타입 정의

/**
 * Hero 섹션 콘텐츠 타입
 */
export interface HeroContent {
  title: string;                        // 메인 제목
  subtitle: string;                     // 부제목
  description: string;                  // 설명문
  ctaText: string;                     // CTA 버튼 텍스트
  ctaLink: string;                     // CTA 버튼 링크
  backgroundImage?: string | undefined; // 배경 이미지 (선택적)
}

/**
 * 개별 기능 아이템 타입
 */
export interface FeatureItem {
  id: string;
  title: string;             // 기능 제목
  description: string;       // 기능 설명
  icon: string;             // 아이콘 이름 (Heroicons)
  benefits: string[];       // 혜택 목록
}

/**
 * Feature 섹션 전체 타입
 */
export interface FeatureSection {
  title: string;
  subtitle: string;
  features: FeatureItem[];
}

/**
 * 타겟 그룹 타입 (대회사, 홀덤펍, 스태프)
 */
export interface TargetGroup {
  id: string;
  name: string;             // 타겟 그룹명 (대회사, 홀덤펍, 스태프)
  title: string;            // 타겟별 제목
  description: string;      // 타겟별 설명
  benefits: string[];       // 타겟별 혜택
  icon: string;            // 타겟 아이콘
  ctaText: string;         // 타겟별 CTA 텍스트
}

/**
 * CTA 버튼 타입
 */
export interface CTAButton {
  text: string;
  link: string;
  variant: 'primary' | 'secondary';
}

/**
 * CTA 섹션 타입
 */
export interface CTASection {
  title: string;
  description: string;
  primaryCTA: CTAButton;
  secondaryCTA?: CTAButton;    // 선택적 보조 CTA
}

// 2. 동적 상태 타입 정의

/**
 * 뷰포트 상태 타입
 */
export interface ViewportState {
  isMobile: boolean;          // 모바일 뷰포트 여부
  isTablet: boolean;          // 태블릿 뷰포트 여부
  scrollY: number;            // 스크롤 위치
  activeSection: string;      // 현재 활성 섹션
}

/**
 * 사용자 상호작용 타입
 */
export interface UserInteraction {
  section: string;                              // 상호작용한 섹션
  action: 'click' | 'scroll' | 'hover';        // 상호작용 유형
  element: string;                              // 상호작용한 요소
  timestamp: number;                            // 상호작용 시간
}

/**
 * 네비게이션 아이템 타입
 */
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  section: string;            // 연결된 섹션 ID
}

// 3. 컴포넌트 Props 타입 정의

/**
 * HeroSection 컴포넌트 Props
 */
export interface HeroSectionProps {
  content: HeroContent;
  onCtaClick?: (link: string) => void;
}

/**
 * FeatureSection 컴포넌트 Props
 */
export interface FeatureSectionProps {
  content: FeatureSection;
  onFeatureClick?: (featureId: string) => void;
}

/**
 * TargetSection 컴포넌트 Props
 */
export interface TargetSectionProps {
  targets: TargetGroup[];
  onTargetClick?: (targetId: string) => void;
}

/**
 * CTASection 컴포넌트 Props
 */
export interface CTASectionProps {
  content: CTASection;
  onCtaClick?: (link: string) => void;
}

/**
 * 메인 LandingPage 컴포넌트 Props
 */
export interface LandingPageProps {
  className?: string;
}

// 4. 훅 관련 타입 정의

/**
 * 분석 데이터 타입
 */
export interface AnalyticsData {
  section: string;
  action: string;
  element: string;
  timestamp: number;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
    isMobile: boolean;
  };
}

/**
 * useLandingAnalytics 훅 반환 타입
 */
export interface LandingAnalyticsHook {
  trackInteraction: (data: Omit<AnalyticsData, 'timestamp'>) => void;
  trackPageView: (section: string) => void;
  trackCtaClick: (ctaText: string, link: string) => void;
  isLoading: boolean;
  error: string | null;
}

// 5. 상수 타입 정의

/**
 * 섹션 ID 상수
 */
export type SectionId = 'hero' | 'features' | 'targets' | 'cta';

/**
 * 브레이크포인트 타입
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * 테마 타입 (향후 확장용)
 */
export type Theme = 'light' | 'dark';

// 6. 유틸리티 타입

/**
 * 선택적 필드를 가진 타입 헬퍼
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 필수 필드를 가진 타입 헬퍼
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;