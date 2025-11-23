/**
 * i18n 설정 파일
 *
 * 지원 언어:
 * - ko: 한국어 (기본값)
 * - en: 영어
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 번역 파일 import
import koTranslation from '../locales/ko/translation.json';
import enTranslation from '../locales/en/translation.json';
import koPayment from '../locales/ko/payment.json';
import enPayment from '../locales/en/payment.json';

// i18n 초기화
i18n
  .use(LanguageDetector) // 브라우저 언어 자동 감지
  .use(initReactI18next) // React i18n 통합
  .init({
    // 번역 리소스
    resources: {
      ko: {
        translation: koTranslation,
        payment: koPayment,
      },
      en: {
        translation: enTranslation,
        payment: enPayment,
      },
    },

    // 기본 언어
    fallbackLng: 'ko',

    // 디버그 모드 (개발 환경에서만)
    debug: process.env.NODE_ENV === 'development',

    // 네임스페이스
    defaultNS: 'translation',
    ns: ['translation', 'payment'],

    // 언어 감지 설정
    detection: {
      // 우선순위: localStorage > navigator
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // 보간 설정
    interpolation: {
      escapeValue: false, // React는 XSS를 자동으로 방어
    },

    // React 설정
    react: {
      useSuspense: true,
    },
  });

export default i18n;
