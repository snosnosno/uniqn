/**
 * UNIQN Mobile - 색상 상수 정의
 *
 * @description 아이콘 및 UI 요소의 색상 중앙 관리
 * @version 1.0.0
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
  info: '#3B82F6', // blue-500
} as const;

// ============================================================================
// 브랜드 색상
// ============================================================================

/**
 * 프라이머리 색상
 */
export const PRIMARY_COLORS = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
} as const;
