import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * 데이터가 없을 때 표시하는 공통 EmptyState 컴포넌트
 * @param icon - 표시할 아이콘 (이모지나 SVG)
 * @param title - 메인 메시지
 * @param description - 부가 설명
 * @param action - 액션 버튼이나 링크
 * @param className - 추가 CSS 클래스
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`text-center py-8 ${className}`}>
      {icon && (
        <div className="text-gray-400 text-4xl mb-2">
          {icon}
        </div>
      )}
      <p className="text-gray-500">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;