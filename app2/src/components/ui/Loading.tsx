import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

/**
 * 로딩 스피너 컴포넌트
 * 접근성을 위한 aria-label 포함
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  color = 'primary',
  text,
  fullScreen = false,
  overlay = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  const colorClasses = {
    primary: 'border-primary-500 border-t-transparent',
    secondary: 'border-secondary-500 border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-500 border-t-transparent',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClasses[color]}
          border-solid rounded-full
          animate-spin
        `}
        role="status"
        aria-label={text || '로딩 중'}
      />
      {text && (
        <p className={`text-${size === 'sm' ? 'sm' : 'base'} ${color === 'white' ? 'text-white' : 'text-gray-700'} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-white">
        {spinner}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

/**
 * 스켈레톤 로더 컴포넌트
 * 콘텐츠 로딩 시 플레이스홀더 제공
 */
export const Skeleton: React.FC<{
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const defaultSizes: Record<string, { width?: string | number; height?: string | number }> = {
    text: { height: '1em', width: '100%' },
    circular: { width: 40, height: 40 },
    rectangular: { width: '100%', height: 120 },
    rounded: { width: '100%', height: 120 },
  };

  const finalWidth = width || defaultSizes[variant]?.width || '100%';
  const finalHeight = height || defaultSizes[variant]?.height || 'auto';

  return (
    <div
      className={`
        bg-gray-200
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={{
        width: finalWidth,
        height: finalHeight,
      }}
      aria-hidden="true"
    />
  );
};

/**
 * 로딩 상태 래퍼 컴포넌트
 * 로딩 중일 때 스켈레톤을 표시하고 완료되면 콘텐츠 표시
 */
export const LoadingWrapper: React.FC<{
  loading: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ loading, skeleton, children, fallback }) => {
  if (loading) {
    return <>{skeleton || fallback || <Loading />}</>;
  }

  return <>{children}</>;
};

export default Loading;