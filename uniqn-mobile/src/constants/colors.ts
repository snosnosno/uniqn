/**
 * UNIQN Mobile - 색상 상수 정의
 *
 * @description 아이콘 및 UI 요소의 색상 중앙 관리
 * @version 3.0.0 - Black & Gold 리브랜딩
 */

// ============================================================================
// Secondary 팔레트 — 단일 진실 공급원 (RN color prop용)
// Tailwind 클래스를 쓸 수 없는 곳(아이콘·인라인 스타일)은 이 상수를 참조.
// 팔레트 변경 시 이 파일의 값만 수정하면 전체 반영됨.
// ============================================================================

export const SECONDARY_PALETTE = {
  50: '#F5F5F7',
  100: '#EBEBED',
  200: '#DCDCE0',
  300: '#C0C0C8',
  400: '#A8A8B0',
  500: '#9898A0',
  600: '#707078',
  700: '#4A4A52',
  800: '#2A2A30',
  900: '#18181E',
} as const;

// ============================================================================
// 아이콘 색상 (다크모드 지원)
// ============================================================================

export const ICON_COLORS = {
  /** 기본 아이콘 색상 */
  primary: {
    light: SECONDARY_PALETTE[700],
    dark: SECONDARY_PALETTE[300],
  },
  /** 보조 아이콘 색상 */
  secondary: {
    light: SECONDARY_PALETTE[700],
    dark: SECONDARY_PALETTE[200],
  },
  /** 고대비 아이콘 색상 */
  contrast: {
    light: '#09090B', // surface
    dark: '#F0F0F2', // text-primary
  },
  /** 비활성 아이콘 색상 */
  disabled: {
    light: SECONDARY_PALETTE[200],
    dark: SECONDARY_PALETTE[800],
  },
} as const;

export function getIconColor(
  isDarkMode: boolean,
  variant: keyof typeof ICON_COLORS = 'primary'
): string {
  return isDarkMode ? ICON_COLORS[variant].dark : ICON_COLORS[variant].light;
}

// ============================================================================
// 상태 색상
// ============================================================================

export const STATUS_COLORS = {
  success: '#22C55E',
  warning: '#D4A017',
  error: '#DC2626',
  info: '#2563EB',
} as const;

// ============================================================================
// 브랜드 색상
// ============================================================================

export const PRIMARY_COLORS = {
  50: 'rgba(212,175,55,0.06)',
  100: 'rgba(212,175,55,0.12)',
  200: '#E8C84E',
  300: '#D4AF37',
  400: '#D4AF37',
  500: '#D4AF37',
  600: '#B8962E',
  700: '#8A7228',
  800: '#6E5A1E',
  900: '#524318',
} as const;

export const ACCENT_COLORS = PRIMARY_COLORS;

export const SURFACE_COLORS = {
  DEFAULT: '#0B0B0E',
  dark: '#07070A',
  elevated: '#1C1C22',
  overlay: '#26262C',
  hover: '#2E2E34',
} as const;

// ============================================================================
// 경계선 / 텍스트 토큰 (DESIGN.md 정렬)
// ============================================================================

export const TEXT_COLORS = {
  /** Text Primary — 본문 텍스트 */
  primary: {
    light: '#09090B',
    dark: '#F0F0F2',
  },
  /** Text Secondary — 보조 정보 (뉴트럴 그레이, DESIGN.md) */
  secondary: {
    light: '#606068',
    dark: '#C0C0C8',
  },
  /** Text Muted — 플레이스홀더, 캡션 (뉴트럴 그레이, DESIGN.md) */
  muted: {
    light: '#888890',
    dark: '#9898A0',
  },
  /** Text On Gold — 골드 배경 위 */
  onGold: '#09090B',
} as const;

// ============================================================================
// Badge 색상 (v3.0)
// ============================================================================

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

// ============================================================================
// 텍스트 색상 (v3.0)
// ============================================================================

export const TEXT_CLASSES = {
  primary: 'text-secondary-900 dark:text-secondary-50',
  secondary: 'text-secondary-700 dark:text-secondary-300',
  tertiary: 'text-secondary-600 dark:text-secondary-400',
  muted: 'text-secondary-500 dark:text-secondary-500',
  link: 'text-primary-600 dark:text-primary-300',
  error: 'text-error-600 dark:text-error-500',
  success: 'text-success-600 dark:text-success-500',
} as const;

export const HEADER_CLASSES = {
  title: 'text-secondary-900 dark:text-secondary-50',
  subtitle: 'text-secondary-600 dark:text-secondary-400',
  secondaryTitle: 'text-secondary-700 dark:text-secondary-300',
  searchField: 'bg-secondary-100 dark:bg-surface-elevated',
  actionPressed: 'active:bg-secondary-100 dark:active:bg-surface-elevated',
} as const;

// ============================================================================
// 로딩 인디케이터 색상 (v3.0)
// ============================================================================

export const LOADING_COLORS = {
  primary: {
    light: '#8A7228', // primary-700
    dark: '#D4AF37', // primary-500
  },
  secondary: {
    light: SECONDARY_PALETTE[700],
    dark: SECONDARY_PALETTE[200],
  },
} as const;

export function getLoadingColor(
  isDarkMode: boolean,
  variant: keyof typeof LOADING_COLORS = 'primary'
): string {
  return isDarkMode ? LOADING_COLORS[variant].dark : LOADING_COLORS[variant].light;
}

// ============================================================================
// Layout 색상 (v3.0 - Black & Gold)
// ============================================================================

export const LAYOUT_COLORS = {
  header: { light: '#FFFFFF', dark: '#0B0B0E' },
  content: { light: SECONDARY_PALETTE[50], dark: '#0B0B0E' },
  headerTint: { light: '#09090B', dark: '#F0F0F2' },
  headerBorder: { light: SECONDARY_PALETTE[200], dark: '#1C1C22' },
  tabBarActive: { light: '#8A7228', dark: '#D4AF37' },
  tabBarInactive: { light: SECONDARY_PALETTE[600], dark: SECONDARY_PALETTE[500] },
  tabBarBg: { light: '#FFFFFF', dark: '#0B0B0E' },
  tabBarBorder: { light: SECONDARY_PALETTE[200], dark: '#141418' },
  refreshTint: { light: '#8A7228', dark: '#D4AF37' },
} as const;

export function getLayoutColor(isDarkMode: boolean, key: keyof typeof LAYOUT_COLORS): string {
  return isDarkMode ? LAYOUT_COLORS[key].dark : LAYOUT_COLORS[key].light;
}

// ============================================================================
// CSS 변수 토큰 (NativeWind vars() 주입용)
// NativeWind Metro 컴파일러가 global.css의 .dark {} CSS 변수를 네이티브에 전파하지
// 못하므로, vars() API로 루트 View에 직접 주입한다.
// global.css의 :root / .dark 블록과 값을 동기화 유지할 것.
// 동기화 검증: npm run quality → scripts/check-css-vars-sync.js
// ============================================================================

const CSS_VAR_LIGHT = {
  '--color-content-primary': '#09090B',
  '--color-content-secondary': '#606068',
  '--color-content-muted': '#888890',
  '--color-content-placeholder': '#A8A8B0',
  '--color-surface-page': '#F5F5F2',
  '--color-surface-card': '#FFFFFF',
  '--color-divider': '#D6D2CA',
} as const;

const CSS_VAR_DARK = {
  '--color-content-primary': '#F0F0F2',
  '--color-content-secondary': '#C0C0C8',
  '--color-content-muted': '#9898A0',
  '--color-content-placeholder': '#A8A8B0',
  '--color-surface-page': '#0B0B0E',
  '--color-surface-card': '#141418',
  '--color-divider': '#222228',
} as const;

export function getCssVarTokens(isDarkMode: boolean): Record<string, string> {
  return isDarkMode ? { ...CSS_VAR_DARK } : { ...CSS_VAR_LIGHT };
}
