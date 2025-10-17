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
      },
      // 공고 공지 기능
      jobPosting: {
        announcement: {
          title: '공지 전송',
          button: '스태프에게 공지',
          modalTitle: '확정 스태프에게 공지 보내기',
          titleLabel: '공지 제목',
          titlePlaceholder: '공지 제목 입력 (최대 50자)',
          messageLabel: '공지 내용',
          messagePlaceholder: '공지 내용 입력 (최대 500자)',
          targetStaff: '수신 대상',
          staffCount: '총 {{count}}명',
          postingInfo: '공고 정보',
          sendButton: '전송',
          cancelButton: '취소',
          sending: '전송 중...',
          success: '공지가 {{count}}명에게 전송되었습니다.',
          error: '공지 전송에 실패했습니다.',
          noStaff: '확정된 스태프가 없습니다.'
        },
        info: {
          expand: '정보 펼치기',
          collapse: '정보 접기',
          section: '공고 상세 정보'
        }
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