/**
 * UNIQN Mobile - Auth Bridge (Dual SDK 동기화)
 *
 * @description Native SDK(@react-native-firebase/auth)와 Web SDK(firebase/auth)의
 *              인증 상태를 동기화하는 유틸리티
 *
 * 배경:
 * - @react-native-firebase/auth: Phone Auth, 계정 생성 등 네이티브 기능
 * - firebase/auth (web SDK): Firestore Security Rules 인증 토큰 제공
 * - 두 SDK는 auth 상태를 공유하지 않으므로 양쪽 동시 로그인 필요
 * - 웹 플랫폼에서는 web SDK만 사용 (네이티브 SDK 불필요)
 *
 * @version 1.1.0
 */

import { Platform } from 'react-native';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { logger } from '@/utils/logger';

// Native SDK는 네이티브 플랫폼에서만 import
let getNativeAuth: (() => import('@react-native-firebase/auth').FirebaseAuthTypes.Module) | null =
  null;
let nativeSignOut: typeof import('@react-native-firebase/auth').signOut | null = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativeAuth = require('@react-native-firebase/auth');
  getNativeAuth = nativeAuth.getAuth;
  nativeSignOut = nativeAuth.signOut;
}

/**
 * Native auth 작업 후 Web SDK에 동기화
 *
 * @description Firestore Security Rules가 web SDK auth 토큰을 사용하므로,
 *              native SDK로 인증 후 반드시 web SDK에도 로그인 필요
 *
 * 웹에서는 이미 web SDK로 인증하므로 no-op
 */
export async function syncToWebAuth(email: string, password: string): Promise<void> {
  if (Platform.OS === 'web') {
    logger.debug('Web 플랫폼 - syncToWebAuth 스킵', { component: 'authBridge' });
    return;
  }

  try {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    logger.debug('Web SDK auth 동기화 완료', { component: 'authBridge' });
  } catch (error) {
    logger.error('Web SDK auth 동기화 실패', {
      component: 'authBridge',
      error,
    });
    throw error;
  }
}

/**
 * 양쪽 SDK 모두 로그아웃
 *
 * Promise.allSettled 사용: 한쪽 실패해도 다른 쪽은 로그아웃 진행
 * 웹에서는 web SDK만 로그아웃
 */
export async function syncSignOut(): Promise<void> {
  if (Platform.OS === 'web') {
    // 웹: web SDK만 로그아웃
    try {
      await signOut(getFirebaseAuth());
      logger.debug('Web SDK 로그아웃 완료', { component: 'authBridge' });
    } catch (error) {
      logger.warn('Web SDK 로그아웃 실패', { component: 'authBridge', error });
    }
    return;
  }

  // 네이티브: 양쪽 SDK 모두 로그아웃
  // async 래퍼로 감싸서 getNativeAuth()/getFirebaseAuth()의 동기 throw도
  // rejected Promise로 변환 → Promise.allSettled가 정상 처리
  const results = await Promise.allSettled([
    (async () => nativeSignOut!(getNativeAuth!()))(),
    (async () => signOut(getFirebaseAuth()))(),
  ]);

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    logger.warn('일부 SDK 로그아웃 실패', {
      component: 'authBridge',
      failedCount: failed.length,
    });
  }

  logger.debug('양쪽 SDK 로그아웃 완료', { component: 'authBridge' });
}

/**
 * Dual SDK 상태 일치 여부 확인
 *
 * @description 앱 초기화 시 native SDK와 web SDK의 인증 상태가 일치하는지 확인.
 *              불일치 시 양쪽 모두 로그아웃하여 깨끗한 상태로 복구.
 *
 * 웹에서는 web SDK만 사용하므로 동기화 불필요 (no-op)
 */
export async function ensureDualSdkSync(): Promise<void> {
  if (Platform.OS === 'web') {
    return; // 웹에서는 단일 SDK만 사용
  }

  try {
    const nativeUser = getNativeAuth!().currentUser;
    const webUser = getFirebaseAuth().currentUser;

    const nativeLoggedIn = !!nativeUser;
    const webLoggedIn = !!webUser;

    if (nativeLoggedIn === webLoggedIn) {
      return; // 양쪽 일치 (둘 다 로그인 또는 둘 다 로그아웃)
    }

    // 불일치 감지 → 안전하게 양쪽 모두 로그아웃
    logger.warn('Dual SDK 상태 불일치 감지 - 양쪽 로그아웃으로 복구', {
      component: 'authBridge',
      nativeLoggedIn,
      webLoggedIn,
      nativeUid: nativeUser?.uid,
      webUid: webUser?.uid,
    });

    await syncSignOut();
  } catch (error) {
    // Native Firebase 앱 미초기화 등 환경 문제 시 건너뜀
    logger.warn('Dual SDK 상태 확인 실패 - 건너뜀', {
      component: 'authBridge',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
