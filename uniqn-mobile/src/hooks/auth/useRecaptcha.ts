/**
 * UNIQN Mobile - reCAPTCHA 관리 훅
 *
 * @description 웹 플랫폼 전용 reCAPTCHA verifier 생성/삭제/재생성 로직
 *
 * Firebase v12 + useSmsTollFraudProtection 환경에서는
 * initializeRecaptchaConfig()으로 Enterprise 설정을 먼저 로드해야
 * RecaptchaVerifier가 Enterprise 토큰을 생성합니다.
 *
 * @version 1.2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { RecaptchaVerifier, initializeRecaptchaConfig } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';

/** reCAPTCHA Enterprise 설정 로드 상태 */
let recaptchaConfigPromise: Promise<void> | null = null;

/** Enterprise 설정을 한 번만 로드 (모듈 레벨 싱글턴) */
function ensureRecaptchaConfig(): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  if (recaptchaConfigPromise) return recaptchaConfigPromise;

  recaptchaConfigPromise = initializeRecaptchaConfig(getFirebaseAuth())
    .then(() => {
      logger.info('reCAPTCHA Enterprise 설정 로드 완료', {
        component: 'useRecaptcha',
      });
    })
    .catch((err) => {
      logger.warn('reCAPTCHA Enterprise 설정 로드 실패', {
        component: 'useRecaptcha',
        error: err,
      });
      // 실패 시 재시도 허용
      recaptchaConfigPromise = null;
    });

  return recaptchaConfigPromise;
}

export interface UseRecaptchaReturn {
  /** 현재 RecaptchaVerifier 인스턴스 (웹 전용) */
  verifierRef: React.MutableRefObject<RecaptchaVerifier | null>;
  /** reCAPTCHA DOM 컨테이너 재생성용 key */
  recaptchaKey: number;
  /** reCAPTCHA verifier 가져오기 (없으면 생성, Enterprise 설정 로드 대기) */
  getOrCreateVerifier: () => Promise<RecaptchaVerifier | null>;
  /** reCAPTCHA verifier 및 DOM 초기화 */
  resetVerifier: () => void;
  /** 에러 발생 시 정리 (clear + DOM 재생성) */
  cleanupOnError: () => void;
}

/**
 * reCAPTCHA 관리 훅 (웹 플랫폼 전용)
 *
 * 네이티브 플랫폼에서는 no-op 반환.
 * 자동 만료, 검증 에러 시 DOM 컨테이너를 key로 재생성하여 iframe 잔여 방지.
 */
export function useRecaptcha(onError?: (msg: string) => void): UseRecaptchaReturn {
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  const resetVerifier = useCallback(() => {
    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {
        // clear 실패 무시
      }
      verifierRef.current = null;
    }
    setRecaptchaKey((prev) => prev + 1);
  }, []);

  const cleanupOnError = useCallback(() => {
    resetVerifier();
  }, [resetVerifier]);

  const getOrCreateVerifier = useCallback(async (): Promise<RecaptchaVerifier | null> => {
    if (Platform.OS !== 'web') return null;

    // Enterprise 설정이 로드될 때까지 대기 (toll fraud protection 호환)
    await ensureRecaptchaConfig();

    if (!verifierRef.current) {
      const auth = getFirebaseAuth();
      verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        'expired-callback': () => {
          logger.warn('reCAPTCHA 토큰 만료 — 재생성 필요', {
            component: 'useRecaptcha',
          });
          verifierRef.current = null;
          setRecaptchaKey((prev) => prev + 1);
        },
        'error-callback': () => {
          logger.error('reCAPTCHA 검증 에러', { component: 'useRecaptcha' });
          onError?.('보안 검증에 실패했습니다. 다시 시도해주세요.');
          verifierRef.current = null;
          setRecaptchaKey((prev) => prev + 1);
        },
      });
    }

    return verifierRef.current;
  }, [onError]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch {
          // unmount 시 clear 실패 무시
        }
        verifierRef.current = null;
      }
    };
  }, []);

  return {
    verifierRef,
    recaptchaKey,
    getOrCreateVerifier,
    resetVerifier,
    cleanupOnError,
  };
}
