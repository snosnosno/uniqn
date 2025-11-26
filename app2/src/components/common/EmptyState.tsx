import React from 'react';

/** 기본 제공 일러스트레이션 타입 */
type IllustrationType = 'no-data' | 'search' | 'error' | 'success' | 'inbox' | 'folder';

/** 컴포넌트 크기 */
type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
  /** 커스텀 아이콘 (이모지나 React 컴포넌트) */
  icon?: React.ReactNode;
  /** 기본 제공 일러스트레이션 타입 */
  illustration?: IllustrationType;
  /** 메인 제목 */
  title: string;
  /** 부가 설명 */
  description?: string;
  /** 액션 버튼/링크 */
  action?: React.ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 컴포넌트 크기 */
  size?: EmptyStateSize;
  /** 배경 표시 여부 */
  showBackground?: boolean;
}

/**
 * 기본 제공 일러스트레이션 SVG
 */
const illustrations: Record<IllustrationType, React.ReactNode> = {
  'no-data': (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-gray-100 dark:fill-gray-700" />
      <rect
        x="35"
        y="40"
        width="50"
        height="8"
        rx="2"
        className="fill-gray-300 dark:fill-gray-600"
      />
      <rect
        x="35"
        y="56"
        width="40"
        height="8"
        rx="2"
        className="fill-gray-200 dark:fill-gray-600"
      />
      <rect
        x="35"
        y="72"
        width="30"
        height="8"
        rx="2"
        className="fill-gray-200 dark:fill-gray-600"
      />
    </svg>
  ),
  search: (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-gray-100 dark:fill-gray-700" />
      <circle
        cx="52"
        cy="52"
        r="20"
        className="stroke-gray-400 dark:stroke-gray-500"
        strokeWidth="4"
        fill="none"
      />
      <line
        x1="67"
        y1="67"
        x2="82"
        y2="82"
        className="stroke-gray-400 dark:stroke-gray-500"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-red-100 dark:fill-red-900/30" />
      <circle
        cx="60"
        cy="60"
        r="30"
        className="stroke-red-400 dark:stroke-red-500"
        strokeWidth="4"
        fill="none"
      />
      <line
        x1="50"
        y1="50"
        x2="70"
        y2="70"
        className="stroke-red-400 dark:stroke-red-500"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="70"
        y1="50"
        x2="50"
        y2="70"
        className="stroke-red-400 dark:stroke-red-500"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  ),
  success: (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-green-100 dark:fill-green-900/30" />
      <circle
        cx="60"
        cy="60"
        r="30"
        className="stroke-green-400 dark:stroke-green-500"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M45 60 L55 70 L75 50"
        className="stroke-green-400 dark:stroke-green-500"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  inbox: (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-gray-100 dark:fill-gray-700" />
      <path d="M30 55 L60 75 L90 55 L90 85 L30 85 Z" className="fill-gray-300 dark:fill-gray-600" />
      <path d="M30 55 L60 35 L90 55 L60 75 Z" className="fill-gray-200 dark:fill-gray-500" />
    </svg>
  ),
  folder: (
    <svg
      className="w-full h-full"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="50" className="fill-gray-100 dark:fill-gray-700" />
      <path
        d="M25 45 L25 85 L95 85 L95 50 L55 50 L50 45 Z"
        className="fill-gray-300 dark:fill-gray-600"
      />
      <path d="M25 50 L25 45 L50 45 L55 50 Z" className="fill-gray-400 dark:fill-gray-500" />
    </svg>
  ),
};

/**
 * 크기별 스타일
 */
const sizeStyles: Record<
  EmptyStateSize,
  { container: string; icon: string; title: string; description: string }
> = {
  sm: {
    container: 'py-6',
    icon: 'w-12 h-12 mb-2',
    title: 'text-sm',
    description: 'text-xs mt-1',
  },
  md: {
    container: 'py-8',
    icon: 'w-20 h-20 mb-3',
    title: 'text-base',
    description: 'text-sm mt-1',
  },
  lg: {
    container: 'py-12',
    icon: 'w-28 h-28 mb-4',
    title: 'text-lg',
    description: 'text-base mt-2',
  },
};

/**
 * 데이터가 없을 때 표시하는 공통 EmptyState 컴포넌트
 *
 * @example
 * // 기본 사용
 * <EmptyState title="데이터가 없습니다" />
 *
 * @example
 * // 일러스트레이션과 함께
 * <EmptyState
 *   illustration="search"
 *   title="검색 결과가 없습니다"
 *   description="다른 검색어를 입력해보세요"
 * />
 *
 * @example
 * // 액션 버튼과 함께
 * <EmptyState
 *   illustration="no-data"
 *   title="항목이 없습니다"
 *   description="새 항목을 추가해보세요"
 *   action={<Button onClick={handleAdd}>추가하기</Button>}
 * />
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  illustration,
  title,
  description,
  action,
  className = '',
  size = 'md',
  showBackground = false,
}) => {
  const styles = sizeStyles[size];

  // 아이콘 렌더링 (커스텀 아이콘 > 일러스트레이션 > 없음)
  const renderIcon = () => {
    if (icon) {
      return (
        <div
          className={`${styles.icon} flex items-center justify-center text-gray-400 dark:text-gray-500`}
        >
          {typeof icon === 'string' ? <span className="text-4xl">{icon}</span> : icon}
        </div>
      );
    }

    if (illustration) {
      return <div className={`${styles.icon} mx-auto`}>{illustrations[illustration]}</div>;
    }

    return null;
  };

  return (
    <div
      className={`
        text-center ${styles.container}
        ${showBackground ? 'bg-gray-50 dark:bg-gray-800/50 rounded-lg' : ''}
        ${className}
      `}
    >
      {renderIcon()}
      <p className={`${styles.title} font-medium text-gray-600 dark:text-gray-300`}>{title}</p>
      {description && (
        <p className={`${styles.description} text-gray-400 dark:text-gray-500 max-w-sm mx-auto`}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
