/**
 * UNIQN Mobile - 색상 상수 정의
 *
 * @description 아이콘 및 UI 요소의 색상 중앙 관리
 * @version 3.0.0 - Black & Gold 리브랜딩
 */

// ============================================================================
// 아이콘 색상 (다크모드 지원)
// ============================================================================

export const ICON_COLORS = {
  /** 기본 아이콘 색상 */
  primary: {
    light: '#5C5546', // secondary-700
    dark: '#C4B898', // secondary-300
  },
  /** 보조 아이콘 색상 */
  secondary: {
    light: '#5C5546', // secondary-700
    dark: '#D6D2CA', // secondary-200
  },
  /** 고대비 아이콘 색상 */
  contrast: {
    light: '#09090B', // surface
    dark: '#F0F0F2', // text-primary
  },
  /** 비활성 아이콘 색상 */
  disabled: {
    light: '#D6D2CA', // secondary-200
    dark: '#3A3530', // secondary-800
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
  error: '#EF4444',
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
  DEFAULT: '#09090B',
  dark: '#050506',
  elevated: '#111113',
  overlay: '#19191D',
} as const;

export function getSurfaceColor(variant: keyof typeof SURFACE_COLORS = 'DEFAULT'): string {
  return SURFACE_COLORS[variant];
}

// ============================================================================
// Badge 색상 (v3.0)
// ============================================================================

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export const BADGE_CLASSES = {
  container: {
    default: 'bg-secondary-100 dark:bg-surface-overlay',
    primary: 'bg-primary-50 dark:bg-primary-50',
    secondary: 'bg-secondary-200 dark:bg-surface-elevated',
    success: 'bg-success-50 dark:bg-success-50',
    warning: 'bg-warning-50 dark:bg-warning-50',
    error: 'bg-error-50 dark:bg-error-50',
  },
  text: {
    default: 'text-secondary-700 dark:text-secondary-300',
    primary: 'text-primary-700 dark:text-primary-300',
    secondary: 'text-secondary-600 dark:text-secondary-200',
    success: 'text-success-700 dark:text-success-500',
    warning: 'text-warning-700 dark:text-warning-500',
    error: 'text-error-700 dark:text-error-500',
  },
  dot: {
    default: 'bg-secondary-500',
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-400',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  },
} as const;

export function getBadgeClasses(variant: BadgeVariant = 'default'): {
  container: string;
  text: string;
  dot: string;
} {
  return {
    container: BADGE_CLASSES.container[variant],
    text: BADGE_CLASSES.text[variant],
    dot: BADGE_CLASSES.dot[variant],
  };
}

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

// ============================================================================
// 카드 색상 (v3.0)
// ============================================================================

export const CARD_CLASSES = {
  default: 'bg-white dark:bg-surface-elevated',
  elevated: 'bg-white dark:bg-surface-elevated',
  highlighted: 'bg-primary-50 dark:bg-primary-50',
  success: 'bg-success-50 dark:bg-success-50',
  warning: 'bg-warning-50 dark:bg-warning-50',
  error: 'bg-error-50 dark:bg-error-50',
} as const;

// ============================================================================
// 보더 색상 (v3.0)
// ============================================================================

export const BORDER_CLASSES = {
  default: 'border-secondary-200 dark:border-surface-overlay',
  light: 'border-secondary-100 dark:border-surface-overlay',
  focus: 'border-primary-500 dark:border-primary-300',
  error: 'border-error-500 dark:border-error-500',
} as const;

export const HEADER_CLASSES = {
  title: 'text-secondary-900 dark:text-secondary-50',
  subtitle: 'text-secondary-600 dark:text-secondary-400',
  secondaryTitle: 'text-secondary-700 dark:text-secondary-300',
  searchField: 'bg-secondary-100 dark:bg-surface-elevated',
  actionPressed: 'active:bg-secondary-100 dark:active:bg-surface-elevated',
} as const;

// ============================================================================
// 차트 색상 (v3.0)
// ============================================================================

export const CHART_COLORS = {
  background: {
    light: '#FFFFFF',
    dark: '#09090B',
  },
  text: {
    light: '#09090B',
    dark: '#F0F0F2',
  },
  grid: {
    light: '#D6D2CA',
    dark: '#19191D',
  },
  series: {
    light: ['#8A7228', '#16A34A', '#A16207', '#B91C1C', '#1D4ED8'],
    dark: ['#D4AF37', '#22C55E', '#D4A017', '#EF4444', '#3B82F6'],
  },
} as const;

export function getChartColors(isDarkMode: boolean) {
  return {
    background: isDarkMode ? CHART_COLORS.background.dark : CHART_COLORS.background.light,
    text: isDarkMode ? CHART_COLORS.text.dark : CHART_COLORS.text.light,
    grid: isDarkMode ? CHART_COLORS.grid.dark : CHART_COLORS.grid.light,
    series: isDarkMode ? CHART_COLORS.series.dark : CHART_COLORS.series.light,
  };
}

// ============================================================================
// 플레이스홀더 색상 (v3.0)
// ============================================================================

export const PLACEHOLDER_COLORS = {
  light: '#8A8272', // secondary-600
  dark: '#A89C84', // secondary-400
} as const;

export function getPlaceholderColor(isDarkMode: boolean): string {
  return isDarkMode ? PLACEHOLDER_COLORS.dark : PLACEHOLDER_COLORS.light;
}

// ============================================================================
// 로딩 인디케이터 색상 (v3.0)
// ============================================================================

export const LOADING_COLORS = {
  primary: {
    light: '#8A7228', // primary-700
    dark: '#D4AF37', // primary-500
  },
  secondary: {
    light: '#5C5546', // secondary-700
    dark: '#D6D2CA', // secondary-200
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
  header: { light: '#FFFFFF', dark: '#09090B' },
  content: { light: '#F5F5F2', dark: '#09090B' },
  headerTint: { light: '#09090B', dark: '#F0F0F2' },
  headerBorder: { light: '#D6D2CA', dark: '#19191D' },
  tabBarActive: { light: '#8A7228', dark: '#D4AF37' },
  tabBarInactive: { light: '#8A8272', dark: '#9A9078' },
  tabBarBg: { light: '#FFFFFF', dark: '#09090B' },
  tabBarBorder: { light: '#D6D2CA', dark: '#111113' },
  refreshTint: { light: '#8A7228', dark: '#D4AF37' },
} as const;

export function getLayoutColor(isDarkMode: boolean, key: keyof typeof LAYOUT_COLORS): string {
  return isDarkMode ? LAYOUT_COLORS[key].dark : LAYOUT_COLORS[key].light;
}
