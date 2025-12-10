/**
 * 공지사항 배너 관리 Hook
 *
 * @description
 * 메인 화면에 표시되는 공지사항 배너를 관리하는 Hook
 * - localStorage 기반 "오늘 하루 보지 않기" 기능
 * - 우선순위별 배너 정렬
 * - 배너 닫기 및 상태 관리
 *
 * @version 1.0.0
 * @since 2025-12-10
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../utils/logger';
import type { SystemAnnouncement } from '../types';

/** localStorage 키 */
const DISMISSED_BANNER_KEY = 'dismissed_announcement_banners';

/** 닫힌 배너 정보 인터페이스 */
interface DismissedBannerInfo {
  /** 공지사항 ID */
  announcementId: string;
  /** 닫은 날짜 (YYYY-MM-DD) */
  dismissedDate: string;
  /** "오늘 하루 보지 않기" 여부 */
  hideForToday: boolean;
}

export interface UseAnnouncementBannerReturn {
  /** 현재 표시할 배너 공지사항 */
  currentBanner: SystemAnnouncement | null;

  /** 다음 배너가 있는지 여부 */
  hasMoreBanners: boolean;

  /** 배너 닫기 */
  dismissBanner: (hideForToday?: boolean) => void;

  /** 모든 배너 닫기 */
  dismissAllBanners: () => void;

  /** 특정 배너가 닫혔는지 확인 */
  isBannerDismissed: (announcementId: string) => boolean;

  /** 닫힌 배너 초기화 */
  resetDismissedBanners: () => void;

  /** 표시 가능한 배너 수 */
  availableBannerCount: number;
}

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
const getTodayString = (): string => {
  const dateStr = new Date().toISOString().split('T')[0];
  return dateStr ?? '';
};

/**
 * localStorage에서 닫힌 배너 정보 로드
 */
const loadDismissedBanners = (): DismissedBannerInfo[] => {
  try {
    const stored = localStorage.getItem(DISMISSED_BANNER_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as DismissedBannerInfo[];
    const today = getTodayString();

    // 오늘 날짜가 아닌 "오늘 하루 보지 않기" 항목은 제거
    const validBanners = parsed.filter((banner) => {
      if (banner.hideForToday && banner.dismissedDate !== today) {
        return false;
      }
      return true;
    });

    // 정리된 데이터 저장
    if (validBanners.length !== parsed.length) {
      localStorage.setItem(DISMISSED_BANNER_KEY, JSON.stringify(validBanners));
    }

    return validBanners;
  } catch (error) {
    logger.error(
      '닫힌 배너 정보 로드 실패',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'useAnnouncementBanner',
      }
    );
    return [];
  }
};

/**
 * localStorage에 닫힌 배너 정보 저장
 */
const saveDismissedBanners = (banners: DismissedBannerInfo[]): void => {
  try {
    localStorage.setItem(DISMISSED_BANNER_KEY, JSON.stringify(banners));
  } catch (error) {
    logger.error(
      '닫힌 배너 정보 저장 실패',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'useAnnouncementBanner',
      }
    );
  }
};

/**
 * 공지사항 배너 관리 Hook
 *
 * @param bannerAnnouncements - 배너로 표시할 공지사항 목록
 *
 * @example
 * ```tsx
 * const { currentBanner, dismissBanner } = useAnnouncementBanner(bannerAnnouncements);
 *
 * if (currentBanner) {
 *   return (
 *     <AnnouncementBanner
 *       announcement={currentBanner}
 *       onDismiss={() => dismissBanner(false)}
 *       onHideForToday={() => dismissBanner(true)}
 *     />
 *   );
 * }
 * ```
 */
export const useAnnouncementBanner = (
  bannerAnnouncements: SystemAnnouncement[]
): UseAnnouncementBannerReturn => {
  // 닫힌 배너 상태
  const [dismissedBanners, setDismissedBanners] = useState<DismissedBannerInfo[]>([]);

  // 현재 표시 중인 배너 인덱스
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * 초기화: localStorage에서 닫힌 배너 정보 로드
   */
  useEffect(() => {
    const loaded = loadDismissedBanners();
    setDismissedBanners(loaded);
  }, []);

  /**
   * 특정 배너가 닫혔는지 확인
   */
  const isBannerDismissed = useCallback(
    (announcementId: string): boolean => {
      const today = getTodayString();

      return dismissedBanners.some((banner) => {
        if (banner.announcementId !== announcementId) return false;

        // "오늘 하루 보지 않기"인 경우 오늘 날짜만 체크
        if (banner.hideForToday) {
          return banner.dismissedDate === today;
        }

        // 영구 닫기
        return true;
      });
    },
    [dismissedBanners]
  );

  /**
   * 표시 가능한 배너 목록 (닫힌 배너 제외)
   */
  const availableBanners = useMemo(() => {
    // 우선순위 정렬: urgent > important > normal
    const priorityOrder = { urgent: 3, important: 2, normal: 1 };

    return bannerAnnouncements
      .filter((announcement) => !isBannerDismissed(announcement.id))
      .sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // 같은 우선순위면 최신순
        const aDate =
          a.createdAt instanceof Date ? a.createdAt : (a.createdAt?.toDate?.() ?? new Date());
        const bDate =
          b.createdAt instanceof Date ? b.createdAt : (b.createdAt?.toDate?.() ?? new Date());
        return bDate.getTime() - aDate.getTime();
      });
  }, [bannerAnnouncements, isBannerDismissed]);

  /**
   * 현재 표시할 배너
   */
  const currentBanner = useMemo(() => {
    if (availableBanners.length === 0) return null;
    const index = Math.min(currentIndex, availableBanners.length - 1);
    return availableBanners[index] ?? null;
  }, [availableBanners, currentIndex]);

  /**
   * 다음 배너 존재 여부
   */
  const hasMoreBanners = availableBanners.length > currentIndex + 1;

  /**
   * 배너 닫기
   */
  const dismissBanner = useCallback(
    (hideForToday: boolean = false) => {
      if (!currentBanner) return;

      const newDismissedInfo: DismissedBannerInfo = {
        announcementId: currentBanner.id,
        dismissedDate: getTodayString(),
        hideForToday,
      };

      const updatedDismissed = [...dismissedBanners, newDismissedInfo];
      setDismissedBanners(updatedDismissed);
      saveDismissedBanners(updatedDismissed);

      // 다음 배너로 이동
      if (hasMoreBanners) {
        setCurrentIndex((prev) => prev + 1);
      }

      logger.info('배너 닫기', {
        component: 'useAnnouncementBanner',
        data: { announcementId: currentBanner.id, hideForToday },
      });
    },
    [currentBanner, dismissedBanners, hasMoreBanners]
  );

  /**
   * 모든 배너 닫기
   */
  const dismissAllBanners = useCallback(() => {
    const today = getTodayString();

    const newDismissedList = availableBanners.map((announcement) => ({
      announcementId: announcement.id,
      dismissedDate: today,
      hideForToday: true,
    }));

    const updatedDismissed = [...dismissedBanners, ...newDismissedList];
    setDismissedBanners(updatedDismissed);
    saveDismissedBanners(updatedDismissed);

    logger.info('모든 배너 닫기', {
      component: 'useAnnouncementBanner',
      data: { count: availableBanners.length },
    });
  }, [availableBanners, dismissedBanners]);

  /**
   * 닫힌 배너 초기화
   */
  const resetDismissedBanners = useCallback(() => {
    setDismissedBanners([]);
    setCurrentIndex(0);
    localStorage.removeItem(DISMISSED_BANNER_KEY);

    logger.info('닫힌 배너 초기화', {
      component: 'useAnnouncementBanner',
    });
  }, []);

  return {
    currentBanner,
    hasMoreBanners,
    dismissBanner,
    dismissAllBanners,
    isBannerDismissed,
    resetDismissedBanners,
    availableBannerCount: availableBanners.length,
  };
};
