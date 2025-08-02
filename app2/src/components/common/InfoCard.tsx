import React from 'react';

interface InfoCardProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * 정보나 안내 메시지를 표시하는 공통 InfoCard 컴포넌트
 * @param type - 카드 타입 (색상 결정)
 * @param title - 제목 (선택사항)
 * @param message - 메시지 내용
 * @param className - 추가 CSS 클래스
 * @param children - 추가 컨텐츠
 */
const InfoCard: React.FC<InfoCardProps> = ({
  type = 'info',
  title,
  message,
  className = '',
  children
}) => {
  const getColorClasses = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-700';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  return (
    <div className={`p-3 border rounded-md ${getColorClasses()} ${className}`}>
      {title && (
        <p className="font-medium mb-1">{title}</p>
      )}
      <p className="text-sm">{message}</p>
      {children}
    </div>
  );
};

export default InfoCard;