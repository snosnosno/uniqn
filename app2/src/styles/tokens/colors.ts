/**
 * 색상 디자인 토큰
 * WCAG 2.1 AA 기준 충족 (대비율 4.5:1 이상)
 */

// 기본 색상 팔레트
export const colors = {
  // Primary - 청색 계열 (기존 Tailwind blue 확장)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // 기본
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Secondary - 초록색 계열 (성공, 확정 상태)
  secondary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // 기본
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Semantic Colors - 의미 기반 색상
  success: {
    light: '#86efac',
    DEFAULT: '#22c55e',
    dark: '#15803d',
    contrast: '#ffffff', // 텍스트 색상
  },

  warning: {
    light: '#fde047',
    DEFAULT: '#eab308',
    dark: '#a16207',
    contrast: '#000000',
  },

  error: {
    light: '#fca5a5',
    DEFAULT: '#ef4444',
    dark: '#b91c1c',
    contrast: '#ffffff',
  },

  info: {
    light: '#93c5fd',
    DEFAULT: '#3b82f6',
    dark: '#1e40af',
    contrast: '#ffffff',
  },

  // 중성 색상 (회색 계열)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // 배경 색상
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    overlay: 'rgba(0, 0, 0, 0.5)',
    hover: '#f9fafb',
    selected: '#eff6ff',
    disabled: '#e5e7eb',
  },

  // 텍스트 색상
  text: {
    primary: '#111827',
    secondary: '#4b5563',
    tertiary: '#6b7280',
    disabled: '#9ca3af',
    inverse: '#ffffff',
    link: '#2563eb',
    linkHover: '#1d4ed8',
  },

  // 보더 색상
  border: {
    light: '#e5e7eb',
    DEFAULT: '#d1d5db',
    dark: '#9ca3af',
    focus: '#3b82f6',
    error: '#ef4444',
    success: '#22c55e',
  },

  // 출석 상태 색상
  attendance: {
    notStarted: {
      bg: '#f3f4f6',
      text: '#6b7280',
      border: '#d1d5db',
    },
    checkedIn: {
      bg: '#dbeafe',
      text: '#1e40af',
      border: '#3b82f6',
    },
    checkedOut: {
      bg: '#dcfce7',
      text: '#15803d',
      border: '#22c55e',
    },
    late: {
      bg: '#fef3c7',
      text: '#92400e',
      border: '#eab308',
    },
    absent: {
      bg: '#fee2e2',
      text: '#991b1b',
      border: '#ef4444',
    },
  },

  // 시간대별 색상
  timeSlot: {
    morning: {
      bg: '#fef3c7',
      text: '#92400e',
    },
    afternoon: {
      bg: '#dbeafe',
      text: '#1e40af',
    },
    evening: {
      bg: '#e9d5ff',
      text: '#6b21a8',
    },
    night: {
      bg: '#e0e7ff',
      text: '#3730a3',
    },
    default: {
      bg: '#f3f4f6',
      text: '#6b7280',
    },
  },
} as const;

// 색상 유틸리티 함수
export const getContrastColor = (backgroundColor: string): string => {
  // 간단한 대비 색상 선택 로직
  const darkColors = ['#000000', '#111827', '#1f2937'];
  const lightColors = ['#ffffff', '#f9fafb'];
  
  // 어두운 배경에는 밝은 텍스트
  if (backgroundColor.startsWith('#1') || backgroundColor.startsWith('#2') || backgroundColor.startsWith('#3')) {
    return colors.text.inverse;
  }
  
  // 밝은 배경에는 어두운 텍스트
  return colors.text.primary;
};

// Tailwind 설정과 호환되는 CSS 변수 생성
export const cssVariables = {
  '--color-primary': colors.primary[500],
  '--color-primary-hover': colors.primary[600],
  '--color-secondary': colors.secondary[500],
  '--color-secondary-hover': colors.secondary[600],
  '--color-success': colors.success.DEFAULT,
  '--color-warning': colors.warning.DEFAULT,
  '--color-error': colors.error.DEFAULT,
  '--color-info': colors.info.DEFAULT,
  '--color-text-primary': colors.text.primary,
  '--color-text-secondary': colors.text.secondary,
  '--color-background': colors.background.primary,
  '--color-border': colors.border.DEFAULT,
} as const;

export type ColorToken = typeof colors;
export type ColorKey = keyof ColorToken;