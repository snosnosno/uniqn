import type { LegalDocument } from './types';

export const MARKETING_CONSENT: LegalDocument = {
  title: '마케팅 정보 수신 동의',
  version: '1.1',
  publishDate: '2026-04-10',
  effectiveDate: '2026-04-10',
  sections: [
    {
      title: '1. 수신 정보',
      body: '- 신규 기능 안내\n' + '- 이벤트 및 프로모션 정보\n' + '- 맞춤형 구인/구직 정보',
    },
    {
      title: '2. 수신 방법',
      body: '- 앱 푸시 알림\n- 이메일\n- SMS/MMS',
    },
    {
      title: '3. 동의 철회',
      body: '- 앱 설정에서 언제든지 수신 동의를 철회할 수 있습니다.',
    },
  ],
};
