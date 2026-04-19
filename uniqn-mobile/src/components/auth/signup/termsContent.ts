/**
 * UNIQN Mobile - 회원가입 약관 텍스트 상수 (Re-export shim)
 *
 * @description 회원가입 Step 4 SheetModal에서 약관 본문을 plain text로 보여주기
 *              위한 호환성 shim. 실제 본문은 `src/constants/legal/`에 단일 소스로
 *              관리되며, 이 파일은 그 데이터를 plain text로 변환해 export합니다.
 *
 *              본문을 갱신하려면 `src/constants/legal/{termsOfService,privacyPolicy,
 *              marketingConsent}.ts`를 수정하세요. 이 파일은 수정할 필요 없습니다.
 *
 * @version 2.0.0
 */

import {
  MARKETING_CONSENT as MARKETING_CONSENT_DOC,
  PRIVACY_POLICY as PRIVACY_POLICY_DOC,
  TERMS_OF_SERVICE as TERMS_OF_SERVICE_DOC,
  toPlainText,
} from '@/constants/legal';

export const TERMS_OF_SERVICE: string = toPlainText(TERMS_OF_SERVICE_DOC);
export const PRIVACY_POLICY: string = toPlainText(PRIVACY_POLICY_DOC);
export const MARKETING_CONSENT: string = toPlainText(MARKETING_CONSENT_DOC);
