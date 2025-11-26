import React from 'react';

interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'error' | 'warning' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
  label?: string;
}

/**
 * 상태를 표시하는 공통 StatusDot 컴포넌트
 * @param status - 상태 타입
 * @param size - 크기
 * @param pulse - 애니메이션 여부
 * @param className - 추가 CSS 클래스
 * @param label - 상태 레이블 (선택사항)
 */
const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  pulse = false,
  className = '',
  label,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
      case 'success':
        return 'bg-green-500 dark:bg-green-600';
      case 'offline':
        return 'bg-gray-400 dark:bg-gray-600';
      case 'busy':
      case 'error':
        return 'bg-red-500 dark:bg-red-600';
      case 'away':
      case 'warning':
        return 'bg-yellow-500 dark:bg-yellow-600';
      case 'info':
        return 'bg-blue-500 dark:bg-blue-600';
      default:
        return 'bg-gray-400 dark:bg-gray-600';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-2 w-2';
      case 'lg':
        return 'h-4 w-4';
      default:
        return 'h-3 w-3';
    }
  };

  const dotElement = (
    <span className="relative inline-flex">
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getStatusColor()} opacity-75`}
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${getSizeClasses()} ${getStatusColor()} ${className}`}
      />
    </span>
  );

  if (label) {
    return (
      <span className="inline-flex items-center space-x-2">
        {dotElement}
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </span>
    );
  }

  return dotElement;
};

export default StatusDot;
