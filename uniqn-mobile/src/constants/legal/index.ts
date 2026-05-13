/**
 * UNIQN Mobile - Legal Documents Single Source of Truth
 *
 * 회원가입 SheetModal과 설정 화면이 동일한 약관/정책 데이터를 참조합니다.
 * 본문 갱신 시 이 디렉토리의 파일만 수정하면 양쪽이 동시에 반영됩니다.
 */

export type { LegalDocument, LegalSection } from './types';
export { toPlainText, formatKoreanDate } from './types';

export { TERMS_OF_SERVICE } from './termsOfService';
export { PRIVACY_POLICY } from './privacyPolicy';
export { MARKETING_CONSENT } from './marketingConsent';
export { EMPLOYER_TERMS, EMPLOYER_TERMS_VERSION_TAG } from './employerTerms';
export { LIABILITY_WAIVER, LIABILITY_WAIVER_VERSION_TAG } from './liabilityWaiver';
export { THIRD_PARTY_CONSENT, THIRD_PARTY_CONSENT_VERSION_TAG } from './thirdPartyConsent';
