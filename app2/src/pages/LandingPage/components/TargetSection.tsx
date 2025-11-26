/**
 * TargetSection 컴포넌트
 *
 * TDD GREEN 단계: 테스트를 통과하는 타겟 그룹 섹션 구현
 * 대회사, 포커룸, 스태프 등 3개 타겟 그룹별 맞춤형 솔루션 소개
 */

import React from 'react';
import { TargetGroup } from '../types';

interface TargetSectionProps {
  targets: TargetGroup[];
  onTargetClick?: (targetId: string) => void;
}

// 아이콘 컴포넌트들
const BuildingOfficeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const HomeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const UserGroupIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const StarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

// 아이콘 매핑
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  'building-office': BuildingOfficeIcon,
  home: HomeIcon,
  'user-group': UserGroupIcon,
  star: StarIcon,
};

const TargetSection: React.FC<TargetSectionProps> = ({ targets, onTargetClick }) => {
  const handleTargetClick = (targetId: string) => {
    if (onTargetClick) {
      onTargetClick(targetId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, targetId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTargetClick(targetId);
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || StarIcon;
    return IconComponent;
  };

  return (
    <section data-testid="target-section" className="py-20 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 섹션 헤더 */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            맞춤형 솔루션
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            다양한 니즈에 맞는 전문 서비스
          </p>
        </div>

        {/* 타겟 카드 그리드 */}
        <div
          data-testid="targets-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="region"
          aria-label="타겟 그룹별 솔루션 목록"
        >
          {targets.map((target) => {
            const IconComponent = getIcon(target.icon);

            return (
              <article
                key={target.id}
                data-testid={`target-card-${target.id}`}
                className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-lg hover:shadow-xl target-card transition-all duration-300 p-8 group border border-gray-200 dark:border-gray-600"
                aria-labelledby={`target-title-${target.id}`}
                aria-describedby={`target-description-${target.id}`}
              >
                {/* 아이콘 */}
                <div data-testid={`target-icon-${target.id}`} className="mb-6">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-all duration-300 group-hover:scale-110">
                    <IconComponent className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                {/* 타겟 이름 */}
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-700">
                    {target.name}
                  </span>
                </div>

                {/* 제목 */}
                <h3
                  id={`target-title-${target.id}`}
                  className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300"
                >
                  {target.title}
                </h3>

                {/* 설명 */}
                <p
                  id={`target-description-${target.id}`}
                  className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed"
                >
                  {target.description}
                </p>

                {/* 혜택 목록 */}
                {target.benefits && target.benefits.length > 0 && (
                  <ul className="space-y-3 mb-8">
                    {target.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-200 font-medium">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA 버튼 */}
                <button
                  className="w-full bg-blue-600 dark:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:bg-blue-700 dark:focus:bg-blue-600 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 group-hover:shadow-lg"
                  onClick={() => handleTargetClick(target.id)}
                  onKeyDown={(e) => handleKeyDown(e, target.id)}
                  aria-label={`${target.name} 솔루션 자세히 보기 - ${target.title}`}
                >
                  {target.ctaText}
                </button>

                {/* 장식 요소 */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg
                    className="w-6 h-6 text-blue-300 dark:text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              </article>
            );
          })}
        </div>

        {/* 빈 상태 처리 */}
        {targets.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-12 h-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              타겟 그룹이 없습니다
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              곧 다양한 맞춤형 솔루션을 제공할 예정입니다.
            </p>
          </div>
        )}

        {/* 추가 정보 */}
        {targets.length > 0 && (
          <div className="text-center mt-16">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                어떤 분야에서 활동하시나요?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                Experience UNIQN solutions optimized for your work environment. 각 분야별 전문가들이
                설계한 맞춤형 기능으로 더욱 효율적인 업무가 가능합니다.
              </p>
              <button className="inline-flex items-center px-6 py-3 text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 hover:text-white dark:hover:text-white transition-colors duration-300 font-semibold">
                상담 신청하기
                <svg
                  className="ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(TargetSection);
