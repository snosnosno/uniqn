import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  
  // 구조적 props
  header?: React.ReactNode;
  footer?: React.ReactNode;
  
  // 스타일 props
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  
  // 상호작용 props
  hoverable?: boolean;
  clickable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  
  // 접근성 props
  role?: string;
  'aria-label'?: string;
  'aria-selected'?: boolean;
}

/**
 * 다양한 레이아웃을 지원하는 카드 컴포넌트
 * 헤더, 바디, 푸터 슬롯 패턴 적용
 */
const Card: React.FC<CardProps> = ({
  children,
  className = '',
  header,
  footer,
  variant = 'default',
  size = 'md',
  padding = 'md',
  hoverable = false,
  clickable = false,
  selected = false,
  disabled = false,
  onClick,
  role,
  'aria-label': ariaLabel,
  'aria-selected': ariaSelected,
}) => {
  // 기본 클래스
  const baseClasses = [
    'bg-white',
    'rounded-lg',
    'transition-all duration-200',
  ];

  // Variant 스타일
  const variantClasses = {
    default: 'shadow-md',
    elevated: 'shadow-lg',
    outlined: 'border-2 border-gray-200',
    filled: 'bg-gray-50 shadow-sm',
  };

  // 크기별 기본 패딩 (padding prop이 'none'이 아닐 때만 적용)
  const sizeClasses = {
    sm: padding !== 'none' ? 'p-3' : '',
    md: padding !== 'none' ? 'p-4 sm:p-6' : '',
    lg: padding !== 'none' ? 'p-6 sm:p-8' : '',
  };

  // 커스텀 패딩 (size보다 우선)
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  // 상호작용 스타일
  const interactionClasses = [
    hoverable && 'hover:shadow-lg hover:scale-[1.02]',
    clickable && 'cursor-pointer',
    selected && 'ring-2 ring-primary-500 bg-primary-50',
    disabled && 'opacity-50 cursor-not-allowed',
  ].filter(Boolean);

  // 클래스 조합
  const combinedClasses = [
    ...baseClasses,
    variantClasses[variant],
    padding === 'none' ? paddingClasses.none : paddingClasses[padding] || sizeClasses[size],
    ...interactionClasses,
    className,
  ].join(' ');

  // 클릭 핸들러
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  // 키보드 접근성
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (clickable && !disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  const cardContent = (
    <>
      {header && (
        <div className={`card-header ${padding !== 'none' ? 'border-b border-gray-200 pb-4 mb-4' : ''}`}>
          {header}
        </div>
      )}
      
      <div className="card-body">
        {children}
      </div>
      
      {footer && (
        <div className={`card-footer ${padding !== 'none' ? 'border-t border-gray-200 pt-4 mt-4' : ''}`}>
          {footer}
        </div>
      )}
    </>
  );

  // 클릭 가능한 카드
  if (clickable) {
    return (
      <div
        className={combinedClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={role || 'button'}
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-selected={ariaSelected ?? selected}
        aria-disabled={disabled}
      >
        {cardContent}
      </div>
    );
  }

  // 일반 카드
  return (
    <div
      className={combinedClasses}
      role={role}
      aria-label={ariaLabel}
      aria-selected={ariaSelected ?? selected}
    >
      {cardContent}
    </div>
  );
};

/**
 * 카드 헤더 컴포넌트
 */
export const CardHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ children, className = '', title, subtitle, action }) => {
  if (title || subtitle) {
    return (
      <div className={`flex items-start justify-between ${className}`}>
        <div>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="ml-4 flex-shrink-0">{action}</div>}
      </div>
    );
  }
  
  return <div className={className}>{children}</div>;
};

/**
 * 카드 바디 컴포넌트
 */
export const CardBody: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={`card-body ${className}`}>{children}</div>;
};

/**
 * 카드 푸터 컴포넌트
 */
export const CardFooter: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}> = ({ children, className = '', align = 'right' }) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };
  
  return (
    <div className={`flex items-center ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
};

export default Card;