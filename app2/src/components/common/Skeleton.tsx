import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * 로딩 상태를 표시하는 공통 Skeleton 컴포넌트
 * @param className - 추가 CSS 클래스
 * @param width - 너비 (기본값: 100%)
 * @param height - 높이 (기본값: 1rem)
 * @param variant - 모양 변형
 * @param animation - 애니메이션 타입
 */
const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  variant = 'rectangular',
  animation = 'pulse'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'text':
        return 'rounded';
      default:
        return 'rounded-md';
    }
  };

  const getAnimationClasses = () => {
    switch (animation) {
      case 'wave':
        return 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]';
      case 'none':
        return 'bg-gray-200';
      default:
        return 'animate-pulse bg-gray-200';
    }
  };

  return (
    <div
      className={`${getVariantClasses()} ${getAnimationClasses()} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    />
  );
};

export default Skeleton;