import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * 태그나 상태를 표시하는 공통 Badge 컴포넌트
 * @param variant - Badge 스타일 변형
 * @param size - Badge 크기
 * @param children - Badge 내용
 * @param className - 추가 CSS 클래스
 * @param icon - 아이콘 (선택사항)
 */
const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  icon,
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'badge-primary dark:bg-primary-900/30 dark:text-primary-300';
      case 'secondary':
        return 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300';
      case 'success':
        return 'badge-success dark:bg-success-dark/30 dark:text-success-light';
      case 'warning':
        return 'badge-warning dark:bg-warning-dark/30 dark:text-warning-light';
      case 'danger':
        return 'badge-error dark:bg-error-dark/30 dark:text-error-light';
      case 'info':
        return 'bg-info-light/20 text-info-dark dark:bg-info-dark/30 dark:text-info-light';
      default:
        return 'bg-gray-200 text-text-secondary dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'lg':
        return 'px-3 py-1.5 text-base';
      default:
        return 'px-2 py-1 text-sm';
    }
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded ${getVariantClasses()} ${getSizeClasses()} ${className}`}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
