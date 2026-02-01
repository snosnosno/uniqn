/**
 * UNIQN Mobile - 색상 상수 정의
 *
 * @description 아이콘 및 UI 요소의 색상 중앙 관리
 * @version 2.0.0 - 프리미엄 퍼플/골드 리브랜딩
 */

// ============================================================================
// 아이콘 색상 (다크모드 지원)
// ============================================================================

/**
 * 아이콘 색상 상수
 *
 * @description 다크모드 대응 아이콘 색상 정의
 * - primary: 기본 아이콘 (닫기 버튼 등)
 * - secondary: 보조 아이콘 (화살표, 셰브론 등)
 * - contrast: 고대비 아이콘 (뒤로가기 버튼 등)
 *
 * @example
 * ```tsx
 * const colorScheme = useColorScheme();
 * const isDarkMode = colorScheme === 'dark';
 * const iconColor = isDarkMode ? ICON_COLORS.primary.dark : ICON_COLORS.primary.light;
 *
 * <XMarkIcon size={18} color={iconColor} />
 * ```
 */
export const ICON_COLORS = {
  /** 기본 아이콘 색상 (닫기 버튼, 일반 아이콘) */
  primary: {
    light: '#6B7280', // gray-500
    dark: '#9CA3AF', // gray-400
  },
  /** 보조 아이콘 색상 (화살표, 셰브론, 비활성 상태) */
  secondary: {
    light: '#6B7280', // gray-500
    dark: '#D1D5DB', // gray-300
  },
  /** 고대비 아이콘 색상 (뒤로가기 버튼) */
  contrast: {
    light: '#111827', // gray-900
    dark: '#FFFFFF', // white
  },
  /** 비활성 아이콘 색상 */
  disabled: {
    light: '#D1D5DB', // gray-300
    dark: '#4B5563', // gray-600
  },
} as const;

/**
 * 다크모드에 따른 아이콘 색상 반환 헬퍼
 *
 * @param isDarkMode - 다크모드 여부
 * @param variant - 색상 변형 (primary, secondary, contrast, disabled)
 * @returns 해당 모드의 색상 코드
 *
 * @example
 * ```tsx
 * const colorScheme = useColorScheme();
 * const isDarkMode = colorScheme === 'dark';
 * const color = getIconColor(isDarkMode, 'primary');
 * ```
 */
export function getIconColor(
  isDarkMode: boolean,
  variant: keyof typeof ICON_COLORS = 'primary'
): string {
  return isDarkMode ? ICON_COLORS[variant].dark : ICON_COLORS[variant].light;
}

// ============================================================================
// 상태 색상
// ============================================================================

/**
 * 시맨틱 색상 (상태 표시용)
 */
export const STATUS_COLORS = {
  success: '#22C55E', // green-500
  warning: '#F59E0B', // amber-500
  error: '#EF4444', // red-500
  info: '#A855F7', // primary-500 (퍼플)
} as const;

// ============================================================================
// 브랜드 색상
// ============================================================================

/**
 * 프라이머리 색상 (퍼플)
 */
export const PRIMARY_COLORS = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#C084FC',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7C3AED',
  800: '#6B21A8',
  900: '#581C87',
} as const;

/**
 * 악센트 색상 (골드) - 프리미엄 강조용
 */
export const ACCENT_COLORS = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#D4AF37',
  600: '#B8860B',
  700: '#92400E',
} as const;

/**
 * 서피스 색상 (다크 퍼플 배경)
 */
export const SURFACE_COLORS = {
  DEFAULT: '#1A1625',
  dark: '#0D0B14',
  elevated: '#2D2438',
  overlay: '#3D3350',
} as const;

/**
 * 서피스 색상 반환 헬퍼
 */
export function getSurfaceColor(variant: keyof typeof SURFACE_COLORS = 'DEFAULT'): string {
  return SURFACE_COLORS[variant];
}

// ============================================================================
// Badge 색상 (v1.1.0)
// ============================================================================

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';

/**
 * Badge 변형별 색상 (HEX)
 *
 * @description non-NativeWind 컨텍스트 (차트, SVG 등)에서 사용
 *
 * @example
 * const chartColor = BADGE_COLORS.success.background.light;
 */
export const BADGE_COLORS: Record<
  BadgeVariant,
  {
    background: { light: string; dark: string };
    text: { light: string; dark: string };
    dot: string;
  }
> = {
  default: {
    background: { light: '#F3F4F6', dark: '#374151' }, // gray-100 / gray-700
    text: { light: '#374151', dark: '#D1D5DB' }, // gray-700 / gray-300
    dot: '#6B7280', // gray-500
  },
  primary: {
    background: { light: '#F3E8FF', dark: 'rgba(88, 28, 135, 0.3)' }, // primary-100 / primary-900/30
    text: { light: '#7C3AED', dark: '#D8B4FE' }, // primary-700 / primary-300
    dot: '#A855F7', // primary-500
  },
  secondary: {
    background: { light: '#E5E7EB', dark: '#4B5563' }, // gray-200 / gray-600
    text: { light: '#4B5563', dark: '#E5E7EB' }, // gray-600 / gray-200
    dot: '#9CA3AF', // gray-400
  },
  success: {
    background: { light: '#DCFCE7', dark: 'rgba(21, 128, 61, 0.3)' }, // success-100 / success-700/30
    text: { light: '#15803D', dark: '#22C55E' }, // success-700 / success-500
    dot: '#22C55E', // success-500
  },
  warning: {
    background: { light: '#FEF3C7', dark: 'rgba(180, 83, 9, 0.3)' }, // warning-100 / warning-700/30
    text: { light: '#B45309', dark: '#F59E0B' }, // warning-700 / warning-500
    dot: '#F59E0B', // warning-500
  },
  error: {
    background: { light: '#FEE2E2', dark: 'rgba(185, 28, 28, 0.3)' }, // error-100 / error-700/30
    text: { light: '#B91C1C', dark: '#EF4444' }, // error-700 / error-500
    dot: '#EF4444', // error-500
  },
} as const;

/**
 * Badge 색상 반환 헬퍼 (HEX)
 *
 * @param isDarkMode - 다크모드 여부
 * @param variant - Badge 변형
 * @returns 배경색, 텍스트색, dot색 객체
 */
export function getBadgeColor(
  isDarkMode: boolean,
  variant: BadgeVariant = 'default'
): { background: string; text: string; dot: string } {
  const colors = BADGE_COLORS[variant];
  return {
    background: isDarkMode ? colors.background.dark : colors.background.light,
    text: isDarkMode ? colors.text.dark : colors.text.light,
    dot: colors.dot,
  };
}

// ============================================================================
// Badge NativeWind 클래스 (v1.1.0)
// ============================================================================

/**
 * Badge 변형별 NativeWind 클래스
 *
 * @description Badge 컴포넌트 외부에서 일관된 스타일 적용 시 사용
 */
export const BADGE_CLASSES = {
  container: {
    default: 'bg-gray-100 dark:bg-surface',
    primary: 'bg-primary-100 dark:bg-primary-900/30',
    secondary: 'bg-gray-200 dark:bg-surface-elevated',
    success: 'bg-success-100 dark:bg-success-700/30',
    warning: 'bg-warning-100 dark:bg-warning-700/30',
    error: 'bg-error-100 dark:bg-error-700/30',
  },
  text: {
    default: 'text-gray-700 dark:text-gray-300',
    primary: 'text-primary-700 dark:text-primary-300',
    secondary: 'text-gray-600 dark:text-gray-200',
    success: 'text-success-700 dark:text-success-500',
    warning: 'text-warning-700 dark:text-warning-500',
    error: 'text-error-700 dark:text-error-500',
  },
  dot: {
    default: 'bg-gray-500',
    primary: 'bg-primary-500',
    secondary: 'bg-gray-400',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  },
} as const;

/**
 * Badge NativeWind 클래스 반환 헬퍼
 *
 * @param variant - Badge 변형
 * @returns container, text, dot 클래스 문자열
 *
 * @example
 * const classes = getBadgeClasses('success');
 * <View className={classes.container}>
 *   <Text className={classes.text}>확정</Text>
 * </View>
 */
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
// 텍스트 색상 (v1.1.0)
// ============================================================================

/**
 * 시맨틱 텍스트 색상 (HEX)
 *
 * @description 일관된 텍스트 색상 적용
 */
export const TEXT_COLORS = {
  /** 기본 텍스트 (제목, 본문) */
  primary: {
    light: '#111827', // gray-900
    dark: '#F9FAFB', // gray-50
  },
  /** 보조 텍스트 (설명, 부제목) */
  secondary: {
    light: '#4B5563', // gray-600
    dark: '#D1D5DB', // gray-300
  },
  /** 삼차 텍스트 (힌트, 캡션) */
  tertiary: {
    light: '#6B7280', // gray-500
    dark: '#9CA3AF', // gray-400
  },
  /** 비활성 텍스트 */
  muted: {
    light: '#9CA3AF', // gray-400
    dark: '#6B7280', // gray-500
  },
  /** 링크 텍스트 */
  link: {
    light: '#9333EA', // primary-600
    dark: '#C084FC', // primary-400
  },
  /** 에러 텍스트 */
  error: {
    light: '#DC2626', // red-600
    dark: '#F87171', // red-400
  },
  /** 성공 텍스트 */
  success: {
    light: '#16A34A', // green-600
    dark: '#4ADE80', // green-400
  },
} as const;

/**
 * 텍스트 색상 반환 헬퍼
 *
 * @param isDarkMode - 다크모드 여부
 * @param variant - 텍스트 변형
 * @returns HEX 색상 코드
 */
export function getTextColor(
  isDarkMode: boolean,
  variant: keyof typeof TEXT_COLORS = 'primary'
): string {
  return isDarkMode ? TEXT_COLORS[variant].dark : TEXT_COLORS[variant].light;
}

/**
 * 텍스트 NativeWind 클래스
 */
export const TEXT_CLASSES = {
  primary: 'text-gray-900 dark:text-gray-50',
  secondary: 'text-gray-600 dark:text-gray-300',
  tertiary: 'text-gray-500 dark:text-gray-400',
  muted: 'text-gray-400 dark:text-gray-500',
  link: 'text-primary-600 dark:text-primary-400',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
} as const;

// ============================================================================
// 카드 색상 (v1.1.0)
// ============================================================================

/**
 * 카드 배경 색상 (HEX)
 */
export const CARD_COLORS = {
  /** 기본 카드 */
  default: {
    light: '#FFFFFF',
    dark: '#1F2937', // gray-800
  },
  /** 강조 카드 */
  elevated: {
    light: '#FFFFFF',
    dark: '#374151', // gray-700
  },
  /** 하이라이트 카드 */
  highlighted: {
    light: '#FAF5FF', // primary-50
    dark: 'rgba(107, 33, 168, 0.2)', // primary-800/20
  },
  /** 성공 상태 카드 */
  success: {
    light: '#F0FDF4', // green-50
    dark: 'rgba(22, 101, 52, 0.2)', // green-800/20
  },
  /** 경고 상태 카드 */
  warning: {
    light: '#FFFBEB', // amber-50
    dark: 'rgba(146, 64, 14, 0.2)', // amber-800/20
  },
  /** 에러 상태 카드 */
  error: {
    light: '#FEF2F2', // red-50
    dark: 'rgba(153, 27, 27, 0.2)', // red-800/20
  },
} as const;

/**
 * 카드 색상 반환 헬퍼
 *
 * @param isDarkMode - 다크모드 여부
 * @param variant - 카드 변형
 * @returns HEX 색상 코드
 */
export function getCardColor(
  isDarkMode: boolean,
  variant: keyof typeof CARD_COLORS = 'default'
): string {
  return isDarkMode ? CARD_COLORS[variant].dark : CARD_COLORS[variant].light;
}

/**
 * 카드 NativeWind 클래스
 */
export const CARD_CLASSES = {
  default: 'bg-white dark:bg-surface',
  elevated: 'bg-white dark:bg-surface-elevated',
  highlighted: 'bg-primary-50 dark:bg-primary-800/20',
  success: 'bg-green-50 dark:bg-green-800/20',
  warning: 'bg-amber-50 dark:bg-amber-800/20',
  error: 'bg-red-50 dark:bg-red-800/20',
} as const;

// ============================================================================
// 보더 색상 (v1.1.0)
// ============================================================================

/**
 * 보더 색상 (HEX)
 */
export const BORDER_COLORS = {
  default: {
    light: '#E5E7EB', // gray-200
    dark: '#374151', // gray-700
  },
  light: {
    light: '#F3F4F6', // gray-100
    dark: '#4B5563', // gray-600
  },
  focus: {
    light: '#A855F7', // primary-500
    dark: '#C084FC', // primary-400
  },
  error: {
    light: '#EF4444', // red-500
    dark: '#F87171', // red-400
  },
} as const;

/**
 * 보더 색상 반환 헬퍼
 */
export function getBorderColor(
  isDarkMode: boolean,
  variant: keyof typeof BORDER_COLORS = 'default'
): string {
  return isDarkMode ? BORDER_COLORS[variant].dark : BORDER_COLORS[variant].light;
}

/**
 * 보더 NativeWind 클래스
 */
export const BORDER_CLASSES = {
  default: 'border-gray-200 dark:border-surface-overlay',
  light: 'border-gray-100 dark:border-surface-overlay',
  focus: 'border-primary-500 dark:border-primary-400',
  error: 'border-red-500 dark:border-red-400',
} as const;

// ============================================================================
// 차트 색상 (v1.2.0)
// ============================================================================

/**
 * 차트 색상 (다크모드 지원)
 */
export const CHART_COLORS = {
  background: {
    light: '#FFFFFF',
    dark: '#1A1625', // surface
  },
  text: {
    light: '#111827', // gray-900
    dark: '#F9FAFB', // gray-50
  },
  grid: {
    light: '#E5E7EB', // gray-200
    dark: '#3D3350', // surface-overlay
  },
  series: {
    light: ['#A855F7', '#22C55E', '#D4AF37', '#EF4444', '#A855F7'],
    dark: ['#C084FC', '#4ADE80', '#FBBF24', '#F87171', '#C084FC'],
  },
} as const;

/**
 * 차트 색상 반환 헬퍼
 */
export function getChartColors(isDarkMode: boolean) {
  return {
    background: isDarkMode ? CHART_COLORS.background.dark : CHART_COLORS.background.light,
    text: isDarkMode ? CHART_COLORS.text.dark : CHART_COLORS.text.light,
    grid: isDarkMode ? CHART_COLORS.grid.dark : CHART_COLORS.grid.light,
    series: isDarkMode ? CHART_COLORS.series.dark : CHART_COLORS.series.light,
  };
}

// ============================================================================
// 플레이스홀더 색상 (v1.2.0)
// ============================================================================

/**
 * 입력 필드 플레이스홀더 색상
 */
export const PLACEHOLDER_COLORS = {
  light: '#6B7280', // gray-500
  dark: '#9CA3AF', // gray-400
} as const;

/**
 * 플레이스홀더 색상 반환 헬퍼
 */
export function getPlaceholderColor(isDarkMode: boolean): string {
  return isDarkMode ? PLACEHOLDER_COLORS.dark : PLACEHOLDER_COLORS.light;
}

// ============================================================================
// 로딩 인디케이터 색상 (v1.2.0)
// ============================================================================

/**
 * 로딩 인디케이터 색상
 */
export const LOADING_COLORS = {
  primary: {
    light: '#A855F7', // primary-500
    dark: '#C084FC', // primary-400
  },
  secondary: {
    light: '#6B7280', // gray-500
    dark: '#D1D5DB', // gray-300
  },
} as const;

/**
 * 로딩 색상 반환 헬퍼
 */
export function getLoadingColor(
  isDarkMode: boolean,
  variant: keyof typeof LOADING_COLORS = 'primary'
): string {
  return isDarkMode ? LOADING_COLORS[variant].dark : LOADING_COLORS[variant].light;
}
