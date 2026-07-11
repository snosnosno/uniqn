/**
 * UNIQN Mobile - 포그라운드 알림 표시 게이트 (M3)
 *
 * @description expo-notifications 포그라운드 핸들러가 알림을 표시할지 결정하는
 *              순수 함수. 전체 알림(enabled) 또는 해당 카테고리(enabled)가 꺼져
 *              있으면 배너/사운드/얼럿을 억제한다. 알림센터 목록(shouldShowList)과
 *              뱃지는 유지해 사용자가 놓친 알림을 나중에 확인할 수 있게 한다.
 *
 *              fail-open 원칙: 설정이 없거나 타입이 미매핑이면 표시한다
 *              (게이트 버그로 알림이 통째로 사라지는 사고 방지).
 */

import { NOTIFICATION_TYPE_TO_CATEGORY } from '@/types/notification';
import type { NotificationSettings, NotificationType } from '@/types/notification';

export interface ForegroundPresentation {
  shouldShowAlert: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  shouldShowBanner: boolean;
  shouldShowList: boolean;
}

const PRESENT: ForegroundPresentation = {
  shouldShowAlert: true,
  shouldPlaySound: true,
  shouldSetBadge: true,
  shouldShowBanner: true,
  shouldShowList: true,
};

const SUPPRESSED: ForegroundPresentation = {
  shouldShowAlert: false,
  shouldPlaySound: false,
  shouldSetBadge: true,
  shouldShowBanner: false,
  shouldShowList: true,
};

export function resolveForegroundPresentation(
  typeValue: unknown,
  settings: NotificationSettings | null | undefined
): ForegroundPresentation {
  if (!settings) {
    return PRESENT; // 설정 미로딩 = fail-open
  }

  // 전체 알림 마스터 오프
  if (settings.enabled === false) {
    return SUPPRESSED;
  }

  if (typeof typeValue !== 'string') {
    return PRESENT; // 타입 부재 = fail-open
  }

  const category = NOTIFICATION_TYPE_TO_CATEGORY[typeValue as NotificationType];
  if (!category) {
    return PRESENT; // 미매핑 타입 = fail-open
  }

  const categorySetting = settings.categories?.[category];
  if (categorySetting?.enabled === false) {
    return SUPPRESSED;
  }

  return PRESENT;
}
