/**
 * Toggle - 토글 스위치 컴포넌트
 *
 * 체크박스를 대체하는 현대적인 토글 스위치 UI
 *
 * @example
 * ```tsx
 * <Toggle
 *   id="use-feature"
 *   checked={enabled}
 *   onChange={(checked) => setEnabled(checked)}
 *   label="기능 사용하기"
 *   description="이 기능을 활성화합니다"
 * />
 * ```
 */

import React from 'react';

export interface ToggleProps {
  /** 토글 ID (label의 htmlFor와 연결) */
  id: string;
  /** 체크 상태 */
  checked: boolean;
  /** 상태 변경 핸들러 */
  onChange: (checked: boolean) => void;
  /** 라벨 텍스트 */
  label: string;
  /** 설명 텍스트 (선택) */
  description?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * Toggle 컴포넌트
 *
 * 접근성을 고려한 토글 스위치:
 * - 키보드 접근 가능 (Space/Enter)
 * - 스크린 리더 지원
 * - 다크모드 지원
 * - 애니메이션 효과
 */
const Toggle: React.FC<ToggleProps> = ({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = ''
}) => {
  // 크기별 스타일
  const sizeStyles = {
    sm: {
      switch: 'w-9 h-5',
      circle: 'w-4 h-4',
      translate: 'translate-x-4'
    },
    md: {
      switch: 'w-11 h-6',
      circle: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      switch: 'w-14 h-7',
      circle: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };

  const styles = sizeStyles[size];

  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center">
        {/* Hidden checkbox for accessibility */}
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />

        {/* Toggle Switch */}
        <label
          htmlFor={id}
          className={`
            relative inline-flex items-center cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div
            className={`
              ${styles.switch}
              rounded-full transition-colors duration-200 ease-in-out
              ${
                checked
                  ? 'bg-indigo-600 dark:bg-indigo-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }
              ${
                !disabled && 'hover:opacity-80'
              }
            `}
          >
            <span
              className={`
                ${styles.circle}
                inline-block rounded-full bg-white dark:bg-gray-100 shadow
                transform transition-transform duration-200 ease-in-out
                ${checked ? styles.translate : 'translate-x-0.5'}
              `}
            />
          </div>
        </label>
      </div>

      {/* Label and Description */}
      {(label || description) && (
        <div className="ml-3 flex-1">
          {label && (
            <label
              htmlFor={id}
              className={`
                block text-sm font-medium cursor-pointer
                ${
                  disabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300'
                }
              `}
            >
              {label}
            </label>
          )}
          {description && (
            <p
              className={`
                mt-0.5 text-xs
                ${
                  disabled
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-500 dark:text-gray-400'
                }
              `}
            >
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

Toggle.displayName = 'Toggle';

export default Toggle;
