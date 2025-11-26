/**
 * 간격(Spacing) 디자인 토큰
 * 4px 기반 그리드 시스템으로 일관된 레이아웃 제공
 */

// 기본 단위 (4px)
const BASE_UNIT = 4;

// 간격 스케일 - px 값
export const spacing = {
  0: '0px',
  px: '1px',
  0.5: `${BASE_UNIT * 0.5}px`, // 2px
  1: `${BASE_UNIT * 1}px`, // 4px
  1.5: `${BASE_UNIT * 1.5}px`, // 6px
  2: `${BASE_UNIT * 2}px`, // 8px
  2.5: `${BASE_UNIT * 2.5}px`, // 10px
  3: `${BASE_UNIT * 3}px`, // 12px
  3.5: `${BASE_UNIT * 3.5}px`, // 14px
  4: `${BASE_UNIT * 4}px`, // 16px
  5: `${BASE_UNIT * 5}px`, // 20px
  6: `${BASE_UNIT * 6}px`, // 24px
  7: `${BASE_UNIT * 7}px`, // 28px
  8: `${BASE_UNIT * 8}px`, // 32px
  9: `${BASE_UNIT * 9}px`, // 36px
  10: `${BASE_UNIT * 10}px`, // 40px
  11: `${BASE_UNIT * 11}px`, // 44px
  12: `${BASE_UNIT * 12}px`, // 48px
  14: `${BASE_UNIT * 14}px`, // 56px
  16: `${BASE_UNIT * 16}px`, // 64px
  20: `${BASE_UNIT * 20}px`, // 80px
  24: `${BASE_UNIT * 24}px`, // 96px
  28: `${BASE_UNIT * 28}px`, // 112px
  32: `${BASE_UNIT * 32}px`, // 128px
  36: `${BASE_UNIT * 36}px`, // 144px
  40: `${BASE_UNIT * 40}px`, // 160px
  44: `${BASE_UNIT * 44}px`, // 176px
  48: `${BASE_UNIT * 48}px`, // 192px
  52: `${BASE_UNIT * 52}px`, // 208px
  56: `${BASE_UNIT * 56}px`, // 224px
  60: `${BASE_UNIT * 60}px`, // 240px
  64: `${BASE_UNIT * 64}px`, // 256px
  72: `${BASE_UNIT * 72}px`, // 288px
  80: `${BASE_UNIT * 80}px`, // 320px
  96: `${BASE_UNIT * 96}px`, // 384px
} as const;

// 컴포넌트별 패딩 프리셋
export const padding = {
  // 버튼
  button: {
    xs: { x: spacing[2], y: spacing[1] }, // 8px 4px
    sm: { x: spacing[3], y: spacing[1.5] }, // 12px 6px
    md: { x: spacing[4], y: spacing[2] }, // 16px 8px
    lg: { x: spacing[6], y: spacing[3] }, // 24px 12px
    xl: { x: spacing[8], y: spacing[4] }, // 32px 16px
  },

  // 입력 필드
  input: {
    sm: { x: spacing[2], y: spacing[1.5] }, // 8px 6px
    md: { x: spacing[3], y: spacing[2] }, // 12px 8px
    lg: { x: spacing[4], y: spacing[3] }, // 16px 12px
  },

  // 카드
  card: {
    sm: spacing[3], // 12px
    md: spacing[4], // 16px
    lg: spacing[6], // 24px
    xl: spacing[8], // 32px
  },

  // 모달
  modal: {
    mobile: spacing[4], // 16px
    desktop: spacing[6], // 24px
  },

  // 섹션
  section: {
    mobile: { x: spacing[4], y: spacing[6] }, // 16px 24px
    desktop: { x: spacing[8], y: spacing[12] }, // 32px 48px
  },

  // 컨테이너
  container: {
    mobile: spacing[4], // 16px
    tablet: spacing[6], // 24px
    desktop: spacing[8], // 32px
  },
};

// 컴포넌트별 마진 프리셋
export const margin = {
  // 제목
  heading: {
    h1: { bottom: spacing[8] }, // 32px
    h2: { bottom: spacing[7] }, // 28px
    h3: { bottom: spacing[6] }, // 24px
    h4: { bottom: spacing[5] }, // 20px
    h5: { bottom: spacing[4] }, // 16px
    h6: { bottom: spacing[3.5] }, // 14px
  },

  // 문단
  paragraph: {
    bottom: spacing[4], // 16px
  },

  // 리스트
  list: {
    item: spacing[2], // 8px
    group: spacing[4], // 16px
  },

  // 폼 요소
  form: {
    field: spacing[4], // 16px
    group: spacing[6], // 24px
    section: spacing[8], // 32px
  },

  // 버튼 그룹
  buttonGroup: {
    gap: spacing[2], // 8px
  },

  // 카드 그리드
  cardGrid: {
    gap: spacing[4], // 16px
    gapLarge: spacing[6], // 24px
  },
};

// 갭(Gap) 프리셋 - Flexbox/Grid용
export const gap = {
  xs: spacing[1], // 4px
  sm: spacing[2], // 8px
  md: spacing[3], // 12px
  lg: spacing[4], // 16px
  xl: spacing[6], // 24px
  '2xl': spacing[8], // 32px
  '3xl': spacing[12], // 48px
};

// 반올림(Border Radius) 값
export const borderRadius = {
  none: '0px',
  sm: '2px',
  DEFAULT: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
};

// 보더 두께
export const borderWidth = {
  0: '0px',
  DEFAULT: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
};

// 그림자 효과
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  // 포커스 그림자
  focus: '0 0 0 3px rgba(59, 130, 246, 0.5)',
  focusError: '0 0 0 3px rgba(239, 68, 68, 0.5)',
  focusSuccess: '0 0 0 3px rgba(34, 197, 94, 0.5)',
};

// 브레이크포인트 - 반응형 디자인용
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// 컨테이너 최대 너비
export const maxWidth = {
  xs: '320px',
  sm: '384px',
  md: '448px',
  lg: '512px',
  xl: '576px',
  '2xl': '672px',
  '3xl': '768px',
  '4xl': '896px',
  '5xl': '1024px',
  '6xl': '1152px',
  '7xl': '1280px',
  full: '100%',
  prose: '65ch',
};

// 최소 터치 타겟 크기 (WCAG 지침)
export const touchTarget = {
  min: '44px', // WCAG 2.1 AA 기준
  recommended: '48px', // 권장 크기
};

// Z-index 레이어
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
  spinner: 90,
};

// CSS 변수 생성
export const spacingCssVariables = {
  '--spacing-base': `${BASE_UNIT}px`,
  '--spacing-xs': spacing[1],
  '--spacing-sm': spacing[2],
  '--spacing-md': spacing[4],
  '--spacing-lg': spacing[6],
  '--spacing-xl': spacing[8],
  '--radius-default': borderRadius.DEFAULT,
  '--radius-lg': borderRadius.lg,
  '--shadow-default': shadows.DEFAULT,
  '--shadow-lg': shadows.lg,
};

export type SpacingToken = typeof spacing;
export type SpacingKey = keyof SpacingToken;
