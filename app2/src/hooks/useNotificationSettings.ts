/**
 * 알림 설정 Hook
 *
 * @description
 * 사용자별 알림 설정을 관리하는 Hook
 * - Firestore 실시간 구독
 * - 카테고리별 설정 관리
 * - 타입별 세부 설정
 * - 조용한 시간대 설정
 *
 * @version 1.0.0
 * @since 2025-10-15
 */

import { useCallback, useMemo } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreDocument } from './firestore';
import {
  NotificationSettings,
  NotificationCategory,
  QuietHours,
  NotificationTypeSettings,
} from '../types/notification';
import { logger } from '../utils/logger';

interface UseNotificationSettingsReturn {
  settings: NotificationSettings | null;
  loading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  updateCategorySettings: (
    category: NotificationCategory,
    updates: { enabled?: boolean; pushEnabled?: boolean; emailEnabled?: boolean }
  ) => Promise<void>;
  updateTypeSettings: (type: string, enabled: boolean) => Promise<void>;
  updateQuietHours: (quietHours: QuietHours) => Promise<void>;
  toggleGlobalEnabled: () => Promise<void>;
}

/**
 * 기본 알림 설정
 */
const getDefaultSettings = (userId: string): NotificationSettings => ({
  userId,
  enabled: true,
  categories: {
    system: {
      enabled: true,
      pushEnabled: true,
      emailEnabled: false,
    },
    work: {
      enabled: true,
      pushEnabled: true,
      emailEnabled: false,
    },
    schedule: {
      enabled: true,
      pushEnabled: true,
      emailEnabled: false,
    },
  },
  types: {
    job_posting_announcement: true,
    new_job_posting: true,
    system_announcement: true,
    app_update: true,
    job_application: true,
    staff_approval: true,
    staff_rejection: true,
    schedule_change: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
});

/**
 * 알림 설정 Hook
 */
export const useNotificationSettings = (): UseNotificationSettingsReturn => {
  const { currentUser } = useAuth();

  // 문서 경로 생성
  const settingsPath = useMemo(() => {
    if (!currentUser) return null;
    return `users/${currentUser.uid}/settings/notifications`;
  }, [currentUser?.uid]);

  // useFirestoreDocument로 구독
  const {
    data: settingsData,
    loading,
    error,
  } = useFirestoreDocument<NotificationSettings>(settingsPath || '', {
    enabled: settingsPath !== null,
    errorOnNotFound: false,
    onSuccess: () => {
      logger.info('알림 설정 로드 완료');
    },
    onError: (err) => {
      logger.error('알림 설정 구독 실패', err);
    },
  });

  // 문서가 없으면 기본 설정 생성
  const settings = useMemo(() => {
    if (!currentUser) return null;

    if (!settingsData && !loading && settingsPath) {
      // 기본 설정 생성
      const defaultSettings = getDefaultSettings(currentUser.uid);
      const settingsRef = doc(db, settingsPath);

      setDoc(settingsRef, {
        ...defaultSettings,
        updatedAt: serverTimestamp(),
      })
        .then(() => {
          logger.info('알림 설정 없음, 기본 설정 생성', { userId: currentUser.uid });
        })
        .catch((err) => {
          logger.error('알림 설정 기본값 생성 실패', err as Error);
        });

      return defaultSettings;
    }

    return settingsData;
  }, [settingsData, loading, currentUser, settingsPath]);

  /**
   * 알림 설정 업데이트
   */
  const updateSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다');
      }

      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'notifications');

        await updateDoc(settingsRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        });

        logger.info('알림 설정 업데이트 완료');
      } catch (err) {
        logger.error('알림 설정 업데이트 실패', err as Error);
        throw err;
      }
    },
    [currentUser]
  );

  /**
   * 카테고리별 설정 업데이트
   */
  const updateCategorySettings = useCallback(
    async (
      category: NotificationCategory,
      updates: { enabled?: boolean; pushEnabled?: boolean; emailEnabled?: boolean }
    ) => {
      if (!currentUser || !settings) {
        throw new Error('로그인이 필요합니다');
      }

      try {
        const updatedCategories = {
          ...settings.categories,
          [category]: {
            ...settings.categories[category],
            ...updates,
          },
        };

        await updateSettings({ categories: updatedCategories });

        logger.info('카테고리 설정 업데이트 완료');
      } catch (err) {
        logger.error('카테고리 설정 업데이트 실패', err as Error);
        throw err;
      }
    },
    [currentUser, settings, updateSettings]
  );

  /**
   * 타입별 설정 업데이트
   */
  const updateTypeSettings = useCallback(
    async (type: string, enabled: boolean) => {
      if (!currentUser || !settings) {
        throw new Error('로그인이 필요합니다');
      }

      try {
        const updatedTypes: NotificationTypeSettings = {
          ...settings.types,
          [type]: enabled,
        };

        await updateSettings({ types: updatedTypes });

        logger.info('알림 타입 설정 업데이트 완료');
      } catch (err) {
        logger.error('알림 타입 설정 업데이트 실패', err as Error);
        throw err;
      }
    },
    [currentUser, settings, updateSettings]
  );

  /**
   * 조용한 시간대 설정 업데이트
   */
  const updateQuietHours = useCallback(
    async (quietHours: QuietHours) => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다');
      }

      try {
        await updateSettings({ quietHours });

        logger.info('조용한 시간대 설정 업데이트 완료');
      } catch (err) {
        logger.error('조용한 시간대 설정 업데이트 실패', err as Error);
        throw err;
      }
    },
    [currentUser, updateSettings]
  );

  /**
   * 전체 알림 ON/OFF 토글
   */
  const toggleGlobalEnabled = useCallback(async () => {
    if (!currentUser || !settings) {
      throw new Error('로그인이 필요합니다');
    }

    try {
      const newEnabled = !settings.enabled;
      await updateSettings({ enabled: newEnabled });

      logger.info('전체 알림 토글 완료');
    } catch (err) {
      logger.error('전체 알림 토글 실패', err as Error);
      throw err;
    }
  }, [currentUser, settings, updateSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    updateCategorySettings,
    updateTypeSettings,
    updateQuietHours,
    toggleGlobalEnabled,
  };
};
