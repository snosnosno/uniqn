/**
 * FooterSection 컴포넌트
 *
 * 랜딩페이지 Footer 섹션
 * 회사 정보, 연락처, 소셜 링크, 이용약관 등 포함
 */

import React from 'react';

const FooterSection: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 회사 정보 */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                T
              </div>
              <span className="text-xl font-bold">T-HOLDEM</span>
            </div>
            <p className="text-gray-300 mb-4 leading-relaxed">
              홀덤 토너먼트 운영, 스태프 관리, 구인공고를 한번에 관리하는 스마트한 플랫폼입니다.
              효율적인 운영과 체계적인 관리로 더 나은 토너먼트 경험을 제공합니다.
            </p>
            <div className="flex space-x-4">
              <a
                href="mailto:contact@tholdem.com"
                className="text-gray-300 hover:text-white transition-colors duration-300"
                aria-label="이메일"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </a>
              <a
                href="tel:+82-2-1234-5678"
                className="text-gray-300 hover:text-white transition-colors duration-300"
                aria-label="전화"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </a>
              <a
                href="https://github.com/tholdem"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors duration-300"
                aria-label="GitHub"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">서비스</h3>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-gray-300 hover:text-white transition-colors duration-300">
                  주요 기능
                </a>
              </li>
              <li>
                <a href="#targets" className="text-gray-300 hover:text-white transition-colors duration-300">
                  솔루션
                </a>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  요금제 (준비중)
                </span>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  API 문서 (준비중)
                </span>
              </li>
            </ul>
          </div>

          {/* 지원 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">지원</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@tholdem.com"
                  className="text-gray-300 hover:text-white transition-colors duration-300"
                >
                  고객 지원
                </a>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  도움말 센터 (준비중)
                </span>
              </li>
              <li>
                <span className="text-gray-400 cursor-not-allowed">
                  FAQ (준비중)
                </span>
              </li>
              <li>
                <a
                  href="mailto:contact@tholdem.com"
                  className="text-gray-300 hover:text-white transition-colors duration-300"
                >
                  문의하기
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 하단 정보 */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400 text-sm">
              © {currentYear} T-HOLDEM. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm">
              <button
                onClick={() => {
                  // 이용약관 모달 또는 페이지 이동
                  alert('이용약관 페이지가 준비 중입니다.');
                }}
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                이용약관
              </button>
              <button
                onClick={() => {
                  // 개인정보처리방침 모달 또는 페이지 이동
                  alert('개인정보처리방침 페이지가 준비 중입니다.');
                }}
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                개인정보처리방침
              </button>
              <span className="text-gray-500">
                버전 0.2.0
              </span>
            </div>
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="text-center text-gray-400 text-sm">
            <p className="mb-2">
              T-HOLDEM은 홀덤 토너먼트 운영의 효율성을 높이고, 체계적인 관리를 통해
              더 나은 게임 환경을 제공하는 것을 목표로 합니다.
            </p>
            <p>
              Enterprise 수준의 보안과 안정성을 바탕으로 안전한 서비스를 제공합니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default React.memo(FooterSection);