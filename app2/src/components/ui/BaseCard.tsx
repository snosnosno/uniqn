import React from 'react';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  active?: boolean;
  disabled?: boolean;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  tabIndex?: number;
}

/**
 * 기본 카드 컴포넌트
 * 모든 카드 컴포넌트의 베이스로 사용
 * WCAG 2.1 AA 접근성 준수
 */
const BaseCard = React.forwardRef<HTMLDivElement, BaseCardProps>(
  (
    {
      children,
      className = '',
      onClick,
      variant = 'default',
      padding = 'md',
      hover = false,
      active = false,
      disabled = false,
      role,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      tabIndex,
    },
    ref
  ) => {
    const baseStyles = 'rounded-lg transition-all duration-200';
    
    const variantStyles = {
      default: 'bg-white border border-gray-200',
      elevated: 'bg-white shadow-lg',
      bordered: 'bg-white border-2 border-gray-300',
      ghost: 'bg-transparent',
    };
    
    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };
    
    const interactiveStyles = onClick ? 'cursor-pointer' : '';
    
    const hoverStyles = hover && !disabled
      ? 'hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5'
      : '';
    
    const activeStyles = active
      ? 'ring-2 ring-primary-500 ring-offset-2'
      : '';
    
    const disabledStyles = disabled
      ? 'opacity-50 cursor-not-allowed pointer-events-none'
      : '';
    
    const focusStyles = onClick
      ? 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
      : '';
    
    const combinedClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${paddingStyles[padding]}
      ${interactiveStyles}
      ${hoverStyles}
      ${activeStyles}
      ${disabledStyles}
      ${focusStyles}
      ${className}
    `.trim().replace(/\s+/g, ' ');
    
    // 키보드 접근성
    const handleKeyDown = onClick && !disabled 
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }
      : undefined;
    
    return (
      <div
        ref={ref}
        className={combinedClassName}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        role={role || (onClick ? 'button' : undefined)}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : (tabIndex ?? (onClick ? 0 : undefined))}
      >
        {children}
      </div>
    );
  }
);

BaseCard.displayName = 'BaseCard';

// 카드 헤더 컴포넌트
export const CardHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ children, className = '', id }) => (
  <div id={id} className={`border-b border-gray-200 pb-3 mb-3 ${className}`}>
    {children}
  </div>
);

// 카드 바디 컴포넌트
export const CardBody: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ children, className = '', id }) => (
  <div id={id} className={`flex-1 ${className}`}>
    {children}
  </div>
);

// 카드 푸터 컴포넌트
export const CardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ children, className = '', id }) => (
  <div id={id} className={`border-t border-gray-200 pt-3 mt-3 ${className}`}>
    {children}
  </div>
);

export default BaseCard;