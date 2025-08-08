/**
 * 디자인 토큰 통합 익스포트
 * 모든 디자인 시스템 토큰을 한 곳에서 관리
 */

export * from './colors';
export * from './typography';
export * from './spacing';

import { colors, cssVariables as colorVars } from './colors';
import { typography, typographyCssVariables, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textClasses } from './typography';
import { 
  spacing, 
  padding, 
  margin, 
  gap, 
  borderRadius, 
  borderWidth, 
  shadows, 
  breakpoints, 
  maxWidth, 
  touchTarget, 
  zIndex,
  spacingCssVariables 
} from './spacing';

// 통합 디자인 토큰 객체
export const tokens = {
  colors,
  typography,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  spacing,
  padding,
  margin,
  gap,
  borderRadius,
  borderWidth,
  shadows,
  breakpoints,
  maxWidth,
  touchTarget,
  zIndex,
  textClasses,
} as const;

// 모든 CSS 변수 통합
export const designTokensCssVariables = {
  ...colorVars,
  ...typographyCssVariables,
  ...spacingCssVariables,
} as const;

// CSS 변수를 문자열로 변환하는 유틸리티
export const getCssVariablesString = (): string => {
  return Object.entries(designTokensCssVariables)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');
};

// 반응형 유틸리티
export const responsive = {
  isMobile: `@media (max-width: ${breakpoints.md})`,
  isTablet: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpoints.lg})`,
  isDesktop: `@media (min-width: ${breakpoints.lg})`,
  isLargeDesktop: `@media (min-width: ${breakpoints.xl})`,
};

// 테마 프리셋
export const theme = {
  light: {
    background: colors.background.primary,
    backgroundSecondary: colors.background.secondary,
    text: colors.text.primary,
    textSecondary: colors.text.secondary,
    border: colors.border.DEFAULT,
    primary: colors.primary[500],
    secondary: colors.secondary[500],
  },
  dark: {
    background: colors.gray[900],
    backgroundSecondary: colors.gray[800],
    text: colors.text.inverse,
    textSecondary: colors.gray[300],
    border: colors.gray[700],
    primary: colors.primary[400],
    secondary: colors.secondary[400],
  },
};

// 유틸리티 함수들
export const utils = {
  /**
   * 반응형 폰트 크기 반환
   */
  getResponsiveFontSize: (size: keyof typeof fontSize): string => {
    return `
      font-size: ${fontSize[size].mobile};
      @media (min-width: ${breakpoints.md}) {
        font-size: ${fontSize[size].desktop};
      }
    `;
  },

  /**
   * 반응형 패딩 반환
   */
  getResponsivePadding: (component: keyof typeof padding): string => {
    if (typeof padding[component] === 'object' && 'mobile' in padding[component]) {
      const p = padding[component] as any;
      return `
        padding: ${p.mobile};
        @media (min-width: ${breakpoints.md}) {
          padding: ${p.desktop};
        }
      `;
    }
    return `padding: ${padding[component]};`;
  },

  /**
   * 그림자 효과 with 호버
   */
  getElevation: (level: keyof typeof shadows, hoverLevel?: keyof typeof shadows): string => {
    const hover = hoverLevel || level;
    return `
      box-shadow: ${shadows[level]};
      transition: box-shadow 0.2s ease;
      &:hover {
        box-shadow: ${shadows[hover]};
      }
    `;
  },

  /**
   * 접근성 포커스 스타일
   */
  getFocusStyle: (color: 'primary' | 'error' | 'success' = 'primary'): string => {
    const focusShadow = color === 'error' ? shadows.focusError : 
                       color === 'success' ? shadows.focusSuccess : 
                       shadows.focus;
    return `
      &:focus {
        outline: none;
        box-shadow: ${focusShadow};
      }
      &:focus-visible {
        outline: none;
        box-shadow: ${focusShadow};
      }
    `;
  },
};

export type Tokens = typeof tokens;
export default tokens;