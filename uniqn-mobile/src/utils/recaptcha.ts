/**
 * UNIQN Mobile - reCAPTCHA v3 유틸리티
 *
 * @description 웹 플랫폼에서 reCAPTCHA v3 토큰 생성
 *              네이티브(iOS/Android)에서는 Firebase Phone Auth 자체 보호 사용
 * @version 1.0.0
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '@/utils/logger';

const SITE_KEY = Constants.expoConfig?.extra?.recaptchaSiteKey as string | undefined;

/** reCAPTCHA 스크립트 로드 상태 */
let scriptLoaded = false;

/** 웹 전용: reCAPTCHA v3 스크립트 동적 로드 */
function loadRecaptchaScript(): void {
  if (Platform.OS !== 'web' || scriptLoaded || !SITE_KEY) return;
  if (typeof document === 'undefined') return;

  // 이미 로드된 스크립트 확인
  if (document.querySelector('script[src*="recaptcha/api.js"]')) {
    scriptLoaded = true;
    return;
  }

  const script = document.createElement('script');
  script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    scriptLoaded = true;
  };
  document.head.appendChild(script);
}

/**
 * reCAPTCHA v3 토큰 생성
 *
 * @param action reCAPTCHA action 이름 (예: 'check_phone')
 * @returns 토큰 문자열 (네이티브에서는 빈 문자열)
 */
export async function getRecaptchaToken(action: string): Promise<string> {
  // 네이티브: Firebase Phone Auth가 SafetyNet/Play Integrity로 보호 → 스킵
  if (Platform.OS !== 'web') return '';

  // SITE_KEY 미설정 (개발환경): 스킵
  if (!SITE_KEY) {
    logger.debug('reCAPTCHA SITE_KEY 미설정 - 토큰 생성 스킵', { component: 'recaptcha' });
    return '';
  }

  // 스크립트 로드
  loadRecaptchaScript();

  // grecaptcha 사용 가능 대기
  const grecaptcha = (globalThis as Record<string, unknown>).grecaptcha as
    | { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> }
    | undefined;

  const siteKey = SITE_KEY;
  if (!grecaptcha || !siteKey) {
    logger.warn('reCAPTCHA 스크립트 미로드 - 토큰 생성 스킵', { component: 'recaptcha' });
    return '';
  }

  return new Promise<string>((resolve) => {
    grecaptcha.ready(async () => {
      try {
        const token = await grecaptcha.execute(siteKey, { action });
        resolve(token);
      } catch (err) {
        logger.warn('reCAPTCHA 토큰 생성 실패', { component: 'recaptcha', error: err });
        resolve('');
      }
    });
  });
}
