import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ko: {
    translation: {
      // 기본 번역 키들
      qrScannerModal: {
        title: 'QR 스캐너',
        scanMessage: 'QR 코드를 스캔해주세요'
      },
      announcements: {
        title: '공지사항',
        placeholder: '공지사항을 입력하세요',
        buttonPost: '게시'
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ko',
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;