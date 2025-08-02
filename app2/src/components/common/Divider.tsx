import React from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children?: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

/**
 * 구분선을 표시하는 공통 Divider 컴포넌트
 * @param orientation - 방향 (가로/세로)
 * @param className - 추가 CSS 클래스
 * @param children - 구분선 중간에 표시할 텍스트 (선택사항)
 * @param textAlign - 텍스트 정렬
 */
const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
  children,
  textAlign = 'center'
}) => {
  if (orientation === 'vertical') {
    return (
      <div className={`inline-block min-h-[1em] w-0.5 self-stretch bg-gray-200 ${className}`} />
    );
  }

  if (children) {
    const alignClasses = {
      left: 'before:mr-4 after:flex-1',
      center: 'before:flex-1 after:flex-1 before:mr-4 after:ml-4',
      right: 'before:flex-1 after:ml-4'
    };

    return (
      <div
        className={`relative flex items-center ${className}`}
      >
        <div className={`flex items-center w-full ${alignClasses[textAlign]}`}>
          <div className="before:content-[''] before:h-px before:bg-gray-200" />
          <span className="text-sm text-gray-500 whitespace-nowrap">{children}</span>
          <div className="after:content-[''] after:h-px after:bg-gray-200" />
        </div>
      </div>
    );
  }

  return <hr className={`border-gray-200 ${className}`} />;
};

export default Divider;