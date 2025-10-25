/**
 * CTASection 컴포넌트
 *
 * TDD GREEN 단계: 테스트를 통과하는 CTA 섹션 구현
 * 최종 행동 유도 섹션으로 주요 CTA와 보조 CTA 버튼 포함
 */

import React from 'react';
import { CTASection as CTASectionType } from '../types';

interface CTASectionProps {
  content: CTASectionType;
  onCtaClick?: (link: string) => void;
}

const CTASection: React.FC<CTASectionProps> = ({ content, onCtaClick }) => {
  const handleCtaClick = (link: string) => {
    if (onCtaClick) {
      onCtaClick(link);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, link: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCtaClick(link);
    }
  };

  const getButtonStyles = (variant: 'primary' | 'secondary') => {
    if (variant === 'primary') {
      return 'bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700 focus:ring-blue-300 shadow-lg hover:shadow-xl';
    }
    return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:ring-blue-300 bg-white';
  };

  return (
    <section
      data-testid="cta-section"
      className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-blue-800 dark:via-blue-900 dark:to-indigo-950 relative overflow-hidden"
    >
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-10 dark:opacity-5">
        <div className="absolute top-1/4 left-1/6 w-32 h-32 bg-white dark:bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/6 w-48 h-48 bg-blue-300 dark:bg-blue-400 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-indigo-300 dark:bg-indigo-400 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* 제목 */}
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
          {content.title}
        </h2>

        {/* 설명 */}
        {content.description && (
          <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
            {content.description}
          </p>
        )}

        {/* CTA 버튼들 */}
        <div
          data-testid="cta-buttons"
          className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center"
        >
          {/* Primary CTA */}
          <button
            onClick={() => handleCtaClick(content.primaryCTA.link)}
            onKeyDown={(e) => handleKeyDown(e, content.primaryCTA.link)}
            className={`
              inline-flex items-center justify-center
              px-8 py-4 text-lg font-semibold rounded-lg
              cta-button transition-all duration-200
              focus:outline-none focus:ring-4
              ${getButtonStyles(content.primaryCTA.variant)}
            `}
            aria-label={`${content.primaryCTA.text} - 주요 행동 버튼`}
          >
            {content.primaryCTA.text}
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>

          {/* Secondary CTA */}
          {content.secondaryCTA && (
            <button
              onClick={() => handleCtaClick(content.secondaryCTA!.link)}
              onKeyDown={(e) => handleKeyDown(e, content.secondaryCTA!.link)}
              className={`
                inline-flex items-center justify-center
                px-8 py-4 text-lg font-semibold rounded-lg
                cta-button transition-all duration-200
                focus:outline-none focus:ring-4
                ${getButtonStyles(content.secondaryCTA.variant)}
              `}
              aria-label={`${content.secondaryCTA.text} - 보조 행동 버튼`}
            >
              {content.secondaryCTA.text}
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
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 보안 및 신뢰성 인디케이터 */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-gray-100 text-sm font-medium">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            무료 체험 제공
          </div>

          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            안전한 데이터 보호
          </div>

          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M12 12h.01M12 12h.01M12 12h.01"
              />
            </svg>
            24시간 지원
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">
              1,000+
            </div>
            <div className="text-gray-100">
              활성 사용자
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">
              500+
            </div>
            <div className="text-gray-100">
              토너먼트 운영
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">
              99.9%
            </div>
            <div className="text-gray-100">
              서비스 가동률
            </div>
          </div>
        </div>

        {/* 긴급성 메시지 */}
        <div className="mt-12 bg-white dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 border border-white dark:border-gray-600 border-opacity-20 dark:border-opacity-30">
          <div className="flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-yellow-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-yellow-400 font-semibold">
              한정 시간 특별 혜택
            </span>
          </div>
          <p className="text-white text-center">
            지금 가입하시면 <span className="font-bold text-yellow-400">첫 3개월 무료</span> +
            <span className="font-bold text-yellow-400"> 프리미엄 기능 무료</span> 제공
          </p>
        </div>
      </div>

      {/* 하단 장식 웨이브 */}
      <div className="absolute bottom-0 left-0 w-full">
        <svg
          className="w-full h-20 fill-current text-white"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z" />
        </svg>
      </div>
    </section>
  );
};

export default React.memo(CTASection);