/**
 * UNIQN Mobile - 외부 앱 링크 열기 (mailto / tel 등)
 *
 * @description `Linking.openURL` 은 처리할 앱이 없으면 reject 한다.
 * (메일 계정이 없는 기기, 기본 앱이 삭제된 기기 — Sentry UNIQN-MOBILE-1F)
 * catch 하지 않으면 unhandled rejection 으로 조용히 실패해 사용자는 아무 반응을 못 본다.
 * 이 유틸은 실패를 흡수하고 값을 그대로 안내해 사용자가 직접 쓸 수 있게 한다.
 * @version 1.0.0
 */

import { Linking } from 'react-native';
import { logger } from '@/utils/logger';
import { showAlert } from '@/utils/showAlert';

// ============================================================================
// Types
// ============================================================================

export interface OpenExternalUrlOptions {
  /** 실패 안내 다이얼로그 제목 */
  fallbackTitle: string;
  /** 실패 시 사용자에게 그대로 보여줄 값 (이메일 주소·전화번호) */
  fallbackValue: string;
  /** 값 위에 붙는 설명 — 무엇을 하면 되는지 명시 */
  fallbackHint: string;
  /** 로깅 컴포넌트명 */
  component?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * 외부 앱 링크를 열고, 실패하면 안내 다이얼로그로 대체한다.
 *
 * @returns 링크를 실제로 열었으면 true, 안내로 대체했으면 false
 *
 * @example
 * void openExternalUrl(`mailto:${email}`, {
 *   fallbackTitle: '메일 앱을 열 수 없어요',
 *   fallbackHint: '아래 주소로 직접 메일을 보내주세요.',
 *   fallbackValue: email,
 * });
 */
export async function openExternalUrl(
  url: string,
  options: OpenExternalUrlOptions
): Promise<boolean> {
  const { fallbackTitle, fallbackValue, fallbackHint, component = 'externalLink' } = options;

  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    // 앱 결함이 아니라 기기 환경(핸들러 앱 부재) — error 레벨로 올리면 Sentry 노이즈가 된다.
    // URL 전문에는 이메일·전화번호가 들어가므로 scheme 만 남긴다.
    logger.warn('외부 링크 열기 실패 - 안내 다이얼로그로 대체', {
      component,
      scheme: url.split(':')[0],
      error: error instanceof Error ? error.message : String(error),
    });

    showAlert(fallbackTitle, `${fallbackHint}\n\n${fallbackValue}`);
    return false;
  }
}
