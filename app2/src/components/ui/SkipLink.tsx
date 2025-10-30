import React from 'react';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * 스킵 링크 컴포넌트
 * 키보드 사용자를 위한 빠른 네비게이션
 * WCAG 2.1 AA 접근성 준수
 */
const SkipLink: React.FC<SkipLinkProps> = ({ href, children }) => {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only
        focus:absolute focus:top-4 focus:left-4 focus:z-50
        focus:px-4 focus:py-2
        focus:bg-primary-600 focus:text-white dark:focus:bg-primary-700 dark:focus:text-gray-100
        focus:rounded-md focus:shadow-lg
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-primary-600
        transition-all duration-200
      "
    >
      {children}
    </a>
  );
};

/**
 * 스킵 링크 컨테이너
 * 페이지 상단에 여러 스킵 링크 제공
 */
export const SkipLinks: React.FC = () => {
  return (
    <div className="skip-links">
      <SkipLink href="#main-content">메인 콘텐츠로 건너뛰기</SkipLink>
      <SkipLink href="#main-navigation">메인 네비게이션으로 건너뛰기</SkipLink>
      <SkipLink href="#search">검색으로 건너뛰기</SkipLink>
    </div>
  );
};

export default SkipLink;