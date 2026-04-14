/**
 * UNIQN Mobile - 기능 플래그
 *
 * @description 환경변수로 기능 on/off 제어
 *
 * TODO: KG이니시스 본인인증 심사 통과 후 활성화 필요
 *   1. .env.local (개발): EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED=true
 *   2. eas.json (production env): EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED=true
 *   3. 배포 후 verify-and-save-portone-profile Edge Function이 정상 동작하는지 확인
 *   4. SignupStepIdentity에서 portOne 인증 버튼이 정상 노출되는지 QA
 */

import Constants from 'expo-constants';

interface AppExtraFlags {
  identityVerificationEnabled?: boolean;
}

function readFlag(key: keyof AppExtraFlags, defaultValue: boolean): boolean {
  const extra = Constants.expoConfig?.extra as AppExtraFlags | undefined;
  const value = extra?.[key];
  return typeof value === 'boolean' ? value : defaultValue;
}

/**
 * KG이니시스 PortOne 본인인증 활성화 여부
 *
 * false: 전화번호 직접 입력 (심사 준비 중)
 * true:  PortOne 이니시스 통합인증 (정식 서비스)
 */
export const IDENTITY_VERIFICATION_ENABLED = readFlag('identityVerificationEnabled', true);
