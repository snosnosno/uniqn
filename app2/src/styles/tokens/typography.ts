/**
 * 타이포그래피 디자인 토큰
 * 8단계 계층 구조로 명확한 정보 위계 제공
 * 모바일 최소 14px, 데스크톱 최소 16px 보장
 */

// 폰트 패밀리
export const fontFamily = {
  sans: [
    'Pretendard',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    'sans-serif',
  ].join(', '),
  mono: ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'].join(', '),
};

// 폰트 크기 - rem 기반 (1rem = 16px)
export const fontSize = {
  // 캡션 - 최소 크기
  xs: {
    mobile: '0.875rem', // 14px
    desktop: '0.875rem', // 14px
  },
  // 본문 작은 크기
  sm: {
    mobile: '0.875rem', // 14px
    desktop: '0.9375rem', // 15px
  },
  // 본문 기본
  base: {
    mobile: '1rem', // 16px
    desktop: '1rem', // 16px
  },
  // 본문 큰 크기
  lg: {
    mobile: '1.125rem', // 18px
    desktop: '1.125rem', // 18px
  },
  // 제목 6
  xl: {
    mobile: '1.25rem', // 20px
    desktop: '1.25rem', // 20px
  },
  // 제목 5
  '2xl': {
    mobile: '1.375rem', // 22px
    desktop: '1.5rem', // 24px
  },
  // 제목 4
  '3xl': {
    mobile: '1.5rem', // 24px
    desktop: '1.875rem', // 30px
  },
  // 제목 3
  '4xl': {
    mobile: '1.875rem', // 30px
    desktop: '2.25rem', // 36px
  },
  // 제목 2
  '5xl': {
    mobile: '2.25rem', // 36px
    desktop: '3rem', // 48px
  },
  // 제목 1
  '6xl': {
    mobile: '2.5rem', // 40px
    desktop: '3.75rem', // 60px
  },
};

// 폰트 두께
export const fontWeight = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

// 줄 높이
export const lineHeight = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '1.75',
  body: '1.8', // 본문 최적
  heading: '1.2', // 제목 최적
};

// 자간 (letter spacing)
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
  korean: '-0.02em', // 한글 최적화
};

// 타이포그래피 스타일 프리셋
export const typography = {
  // 제목
  h1: {
    fontSizeMobile: fontSize['6xl'].mobile,
    fontSizeDesktop: fontSize['6xl'].desktop,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.heading,
    letterSpacing: letterSpacing.korean,
    marginBottom: '2rem',
  },
  h2: {
    fontSizeMobile: fontSize['5xl'].mobile,
    fontSizeDesktop: fontSize['5xl'].desktop,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.heading,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1.75rem',
  },
  h3: {
    fontSizeMobile: fontSize['4xl'].mobile,
    fontSizeDesktop: fontSize['4xl'].desktop,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.heading,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1.5rem',
  },
  h4: {
    fontSizeMobile: fontSize['3xl'].mobile,
    fontSizeDesktop: fontSize['3xl'].desktop,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1.25rem',
  },
  h5: {
    fontSizeMobile: fontSize['2xl'].mobile,
    fontSizeDesktop: fontSize['2xl'].desktop,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1rem',
  },
  h6: {
    fontSizeMobile: fontSize.xl.mobile,
    fontSizeDesktop: fontSize.xl.desktop,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.korean,
    marginBottom: '0.875rem',
  },

  // 본문
  body: {
    fontSizeMobile: fontSize.base.mobile,
    fontSizeDesktop: fontSize.base.desktop,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.body,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1rem',
  },
  bodyLarge: {
    fontSizeMobile: fontSize.lg.mobile,
    fontSizeDesktop: fontSize.lg.desktop,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.korean,
    marginBottom: '1rem',
  },
  bodySmall: {
    fontSizeMobile: fontSize.sm.mobile,
    fontSizeDesktop: fontSize.sm.desktop,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.korean,
    marginBottom: '0.75rem',
  },

  // 캡션
  caption: {
    fontSizeMobile: fontSize.xs.mobile,
    fontSizeDesktop: fontSize.xs.desktop,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    marginBottom: '0.5rem',
  },

  // 버튼
  button: {
    fontSizeMobile: fontSize.sm.mobile,
    fontSizeDesktop: fontSize.base.desktop,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.wide,
    textTransform: 'none' as const,
  },

  // 라벨
  label: {
    fontSizeMobile: fontSize.sm.mobile,
    fontSizeDesktop: fontSize.sm.desktop,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.korean,
    marginBottom: '0.25rem',
  },

  // 링크
  link: {
    fontSizeMobile: 'inherit',
    fontSizeDesktop: 'inherit',
    fontWeight: fontWeight.normal,
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textDecoration: 'underline',
  },

  // 코드
  code: {
    fontFamily: fontFamily.mono,
    fontSizeMobile: fontSize.sm.mobile,
    fontSizeDesktop: fontSize.sm.desktop,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
};

// Tailwind 클래스 매핑
export const textClasses = {
  h1: 'text-4xl md:text-6xl font-bold leading-tight',
  h2: 'text-3xl md:text-5xl font-bold leading-tight',
  h3: 'text-2xl md:text-4xl font-semibold leading-snug',
  h4: 'text-xl md:text-3xl font-semibold leading-snug',
  h5: 'text-lg md:text-2xl font-medium leading-normal',
  h6: 'text-base md:text-xl font-medium leading-normal',
  body: 'text-base leading-relaxed',
  bodyLarge: 'text-lg leading-relaxed',
  bodySmall: 'text-sm md:text-base leading-normal',
  caption: 'text-sm leading-normal',
  button: 'text-sm md:text-base font-medium',
  label: 'text-sm font-medium',
  link: 'underline hover:no-underline',
  code: 'font-mono text-sm',
};

// CSS 변수 생성
export const typographyCssVariables = {
  '--font-sans': fontFamily.sans,
  '--font-mono': fontFamily.mono,
  '--text-xs': fontSize.xs.mobile,
  '--text-sm': fontSize.sm.mobile,
  '--text-base': fontSize.base.mobile,
  '--text-lg': fontSize.lg.mobile,
  '--text-xl': fontSize.xl.mobile,
  '--leading-normal': lineHeight.normal,
  '--leading-relaxed': lineHeight.relaxed,
  '--leading-body': lineHeight.body,
};

export type TypographyToken = typeof typography;
export type TypographyKey = keyof TypographyToken;
