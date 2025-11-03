import React, { forwardRef, useState } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  success?: boolean;
  helperText?: string;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  showPasswordToggle?: boolean;
}

/**
 * 접근성과 사용성을 고려한 입력 필드 컴포넌트
 * WCAG 2.1 AA 기준 충족
 */
const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  success = false,
  helperText,
  required = false,
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = true,
  showPasswordToggle = false,
  type = 'text',
  className = '',
  id,
  disabled = false,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  
  // 자동 ID 생성 (접근성을 위해)
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  // 기본 클래스
  const baseClasses = [
    'block',
    'px-3 py-2',
    'text-gray-900 dark:text-gray-50',
    'bg-white dark:bg-gray-700',
    'border rounded-lg',
    'placeholder-gray-400 dark:placeholder-gray-500',
    'transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-opacity-50',
  ];

  // 크기 스타일
  const sizeClasses = {
    sm: 'text-sm min-h-[40px]',
    md: 'text-sm md:text-base min-h-[44px]',
    lg: 'text-lg min-h-[48px]',
  };

  // 상태 스타일
  const stateClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : success
    ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
    : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500';

  // 비활성화 스타일
  const disabledClasses = disabled
    ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
    : '';

  // 너비 스타일
  const widthClass = fullWidth ? 'w-full' : '';

  // 아이콘 패딩 조정
  const iconPaddingClasses = [
    leftIcon && 'pl-10',
    (rightIcon || showPasswordToggle) && 'pr-10',
  ].filter(Boolean).join(' ');

  // 클래스 조합
  const combinedClasses = [
    ...baseClasses,
    sizeClasses[size],
    stateClasses,
    disabledClasses,
    widthClass,
    iconPaddingClasses,
    className,
  ].join(' ');

  // 패스워드 토글 타입 결정
  const inputType = showPasswordToggle && type === 'password'
    ? (showPassword ? 'text' : 'password')
    : type;

  // 패스워드 토글 아이콘
  const PasswordToggleIcon = () => (
    <button
      type="button"
      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300"
      onClick={() => setShowPassword(!showPassword)}
      tabIndex={-1}
      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
    >
      {showPassword ? (
        // Eye Off Icon
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" 
          />
        </svg>
      ) : (
        // Eye Icon
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
          />
        </svg>
      )}
    </button>
  );

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 dark:text-gray-500">{leftIcon}</span>
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={combinedClasses}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` :
            helperText ? `${inputId}-helper` :
            undefined
          }
          aria-required={required}
          {...props}
        />

        {(rightIcon || (showPasswordToggle && type === 'password')) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPasswordToggle && type === 'password' ? (
              <PasswordToggleIcon />
            ) : (
              <span className="text-gray-400 dark:text-gray-500">{rightIcon}</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;