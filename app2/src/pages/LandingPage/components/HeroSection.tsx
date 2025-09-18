/**
 * HeroSection 컴포넌트
 *
 * TDD GREEN 단계: 테스트를 통과하는 Hero 섹션 구현
 * 랜딩페이지의 메인 히어로 섹션으로 핵심 메시지와 CTA를 포함
 */

import React, { useEffect } from 'react';
import { HeroContent } from '../types';

interface HeroSectionProps {
  content: HeroContent;
  onCtaClick?: (link: string) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ content, onCtaClick }) => {
  // 페이지 제목 설정
  useEffect(() => {
    document.title = 'T-HOLDEM - 홀덤 토너먼트 관리 플랫폼';

    // 메타 태그 설정
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription) {
      metaDescription.content = '홀덤 토너먼트 운영, 스태프 관리, 구인공고를 한번에 관리하는 스마트한 플랫폼';
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = '홀덤 토너먼트 운영, 스태프 관리, 구인공고를 한번에 관리하는 스마트한 플랫폼';
      document.head.appendChild(meta);
    }

    // OpenGraph 메타 태그 설정
    const setOgMeta = (property: string, content: string) => {
      let ogMeta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (ogMeta) {
        ogMeta.content = content;
      } else {
        ogMeta = document.createElement('meta');
        ogMeta.setAttribute('property', property);
        ogMeta.content = content;
        document.head.appendChild(ogMeta);
      }
    };

    setOgMeta('og:title', 'T-HOLDEM - 홀덤 토너먼트 관리 플랫폼');
    setOgMeta('og:description', '홀덤 토너먼트 운영, 스태프 관리, 구인공고를 한번에 관리하는 스마트한 플랫폼');
    setOgMeta('og:type', 'website');
  }, []);

  const handleCtaClick = () => {
    if (onCtaClick && content.ctaLink) {
      onCtaClick(content.ctaLink);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCtaClick();
    }
  };

  return (
    <section
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 px-4 lg:px-8"
      aria-label="T-HOLDEM 홀덤 토너먼트 관리 플랫폼 메인 섹션"
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black bg-opacity-40" />

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
        {/* 메인 제목 */}
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          {content.title || 'T-HOLDEM과 함께하는 스마트한 토너먼트 운영'}
        </h1>

        {/* 부제목 */}
        {content.subtitle && (
          <h2 className="text-xl md:text-2xl font-medium mb-4 text-blue-100">
            {content.subtitle}
          </h2>
        )}

        {/* 설명 */}
        {content.description && (
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed text-gray-200">
            {content.description}
          </p>
        )}

        {/* CTA 버튼 */}
        {content.ctaText && (
          <div className="flex flex-col items-center">
            <button
              onClick={handleCtaClick}
              onKeyDown={handleKeyDown}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 rounded-lg shadow-lg hover:shadow-xl cta-button focus:outline-none focus:ring-4 focus:ring-blue-300"
              aria-label={`${content.ctaText} - 회원가입 페이지로 이동`}
            >
              {content.ctaText}
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

            {/* 움직이는 화살표 - CTA 버튼 바로 아래 */}
            <div className="mt-8 scroll-indicator">
              <svg
                className="w-6 h-6 text-white opacity-70 hover:opacity-100 transition-opacity duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 장식적 요소 */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent" />

      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl" />
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-blue-300 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-24 h-24 bg-indigo-300 rounded-full blur-2xl" />
      </div>
    </section>
  );
};

export default React.memo(HeroSection);