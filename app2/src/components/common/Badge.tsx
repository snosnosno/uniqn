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
  icon
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-indigo-100 text-indigo-800';
      case 'secondary':
        return 'bg-gray-100 text-gray-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'danger':
        return 'bg-red-100 text-red-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-200 text-gray-700';
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