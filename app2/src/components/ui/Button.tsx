import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isActive?: boolean;
}

/**
 * 접근성과 사용성을 고려한 버튼 컴포넌트
 * WCAG 2.1 AA 기준 충족 (최소 터치 타겟 44px)
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled = false,
  isActive = false,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  // 기본 클래스
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-lg',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'touch-manipulation',
  ];

  // Variant 스타일
  const variantClasses = {
    primary: [
      'bg-primary-500 text-white',
      'hover:bg-primary-600',
      'focus:ring-primary-500',
      'active:bg-primary-700',
      isActive && 'bg-primary-700',
    ],
    secondary: [
      'bg-secondary-500 text-white',
      'hover:bg-secondary-600',
      'focus:ring-secondary-500',
      'active:bg-secondary-700',
      isActive && 'bg-secondary-700',
    ],
    outline: [
      'border-2 border-primary-500 text-primary-500',
      'hover:bg-primary-50',
      'focus:ring-primary-500',
      'active:bg-primary-100',
      isActive && 'bg-primary-100',
    ],
    ghost: [
      'text-gray-600',
      'hover:bg-gray-100',
      'focus:ring-gray-500',
      'active:bg-gray-200',
      isActive && 'bg-gray-200',
    ],
    danger: [
      'bg-red-600 text-white',
      'hover:bg-red-700',
      'focus:ring-red-500',
      'active:bg-red-800',
      isActive && 'bg-red-800',
    ],
    success: [
      'bg-green-600 text-white',
      'hover:bg-green-700',
      'focus:ring-green-500',
      'active:bg-green-800',
      isActive && 'bg-green-800',
    ],
    link: [
      'text-blue-600 bg-transparent',
      'hover:text-blue-800 hover:underline',
      'focus:ring-blue-500',
      'active:text-blue-900',
      isActive && 'text-blue-900 underline',
    ],
  };

  // 크기 스타일 (반응형 패딩 적용)
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs min-h-[36px] gap-1',
    sm: 'px-2 sm:px-3 py-1.5 text-sm min-h-[40px] gap-1.5',
    md: 'px-3 sm:px-4 py-2 text-sm md:text-base min-h-[44px] gap-2',
    lg: 'px-4 sm:px-6 py-2 sm:py-3 text-lg min-h-[48px] gap-2',
    xl: 'px-6 sm:px-8 py-3 sm:py-4 text-xl min-h-[52px] gap-3',
  };

  // 너비 스타일
  const widthClass = fullWidth ? 'w-full' : '';

  // 로딩 스타일
  const loadingClass = loading ? 'cursor-wait' : '';

  // 클래스 조합
  const combinedClasses = [
    ...baseClasses,
    ...variantClasses[variant].filter(Boolean),
    sizeClasses[size],
    widthClass,
    loadingClass,
    className,
  ].join(' ');

  // 로딩 스피너 컴포넌트
  const LoadingSpinner = () => (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      ref={ref}
      type={type}
      className={combinedClasses}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;