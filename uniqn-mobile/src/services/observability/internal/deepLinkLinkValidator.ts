import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { WEB_DOMAIN } from './deepLinkConstants';

const SAFE_LINK_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

export function validateNotificationLink(link?: string): string | undefined {
  if (!link) return undefined;

  const trimmedLink = link.trim();
  if (trimmedLink.length === 0) return undefined;

  if (!SAFE_LINK_PATTERN.test(trimmedLink)) {
    logger.warn('위험한 알림 링크 차단', {
      link: trimmedLink.substring(0, 50),
      reason: 'pattern_mismatch',
    });
    return undefined;
  }

  return trimmedLink;
}

export function getCurrentWebOrigin(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.location.origin;
  } catch {
    return null;
  }
}

export function isSupportedWebUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === WEB_DOMAIN || urlObj.hostname.endsWith(`.${WEB_DOMAIN}`)) {
      return true;
    }

    const currentOrigin = getCurrentWebOrigin();
    return currentOrigin !== null && urlObj.origin === currentOrigin;
  } catch {
    return false;
  }
}

export function isWebRootUrl(url: string): boolean {
  if (Platform.OS !== 'web') return false;

  try {
    const urlObj = new URL(url);
    const isRootPath = urlObj.pathname === '/' || urlObj.pathname === '';
    const hasNoParams = urlObj.searchParams.toString() === '';
    return isRootPath && hasNoParams;
  } catch {
    return false;
  }
}
