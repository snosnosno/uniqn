/**
 * ConfirmModal 스타일 상수
 *
 * Tailwind CSS 클래스를 중앙 관리하여 일관성 유지
 * 다크모드 지원 포함
 */

/** 모달 오버레이 스타일 */
export const OVERLAY_STYLES = {
  base: 'fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[60] p-4',
} as const;

/** 모달 컨테이너 스타일 */
export const CONTAINER_STYLES = {
  base: 'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-scale-up',
} as const;

/** 헤더 스타일 */
export const HEADER_STYLES = {
  wrapper: 'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700',
  titleContainer: 'flex items-center gap-3',
  title: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
  closeButton:
    'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50',
  closeIcon: 'w-6 h-6',
  warningIcon: 'w-6 h-6 text-red-500 dark:text-red-400',
} as const;

/** 본문 스타일 */
export const BODY_STYLES = {
  wrapper: 'p-6',
  message: 'text-gray-700 dark:text-gray-300 whitespace-pre-line mb-4',
  inputWrapper: 'mt-4',
} as const;

/** 푸터 스타일 */
export const FOOTER_STYLES = {
  wrapper:
    'flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900',
} as const;

/** 입력 필드 스타일 */
export const INPUT_STYLES = {
  base: 'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50',
  valid: 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400',
  invalid: 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400',
  errorText: 'text-sm text-red-500 dark:text-red-400 mt-2',
} as const;

/**
 * 입력 필드 클래스 생성 함수
 * @param hasError - 에러 상태 여부
 * @returns 조합된 Tailwind 클래스 문자열
 */
export const getInputClassName = (hasError: boolean): string => {
  return `${INPUT_STYLES.base} ${hasError ? INPUT_STYLES.invalid : INPUT_STYLES.valid}`;
};

/** 애니메이션 keyframes (필요시 tailwind.config.js에 추가) */
export const ANIMATION_CONFIG = {
  scaleUp: {
    name: 'animate-scale-up',
    keyframes: {
      '0%': { transform: 'scale(0.95)', opacity: '0' },
      '100%': { transform: 'scale(1)', opacity: '1' },
    },
    duration: '200ms',
    timing: 'ease-out',
  },
} as const;

/** 접근성 관련 ID 상수 */
export const ARIA_IDS = {
  modalTitle: 'confirm-modal-title',
  modalDescription: 'confirm-modal-description',
  inputError: 'confirm-modal-input-error',
} as const;
