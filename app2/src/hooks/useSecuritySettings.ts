/**
 * 보안 설정 Hook
 *
 * @description
 * 비밀번호 변경, 로그인 알림 설정 관리
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { useState, useCallback, useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import i18n from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreDocument } from './firestore';
import {
  validatePasswordChange,
  ValidationError,
  ServiceError,
} from '../utils/validation/accountValidation';
import type { LoginNotificationSettings, PasswordChangeInput } from '../types/security';

export interface UseSecuritySettingsReturn {
  // 데이터
  loginNotificationSettings: LoginNotificationSettings | null;

  // 상태
  loading: boolean;
  error: Error | null;

  // 액션
  changePassword: (input: PasswordChangeInput) => Promise<void>;
  updateLoginNotifications: (settings: Partial<LoginNotificationSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

/**
 * 기본 로그인 알림 설정
 */
const DEFAULT_LOGIN_NOTIFICATION_SETTINGS: Omit<LoginNotificationSettings, 'updatedAt'> = {
  enabled: true,
  notifyOnNewDevice: true,
  notifyOnNewLocation: true,
  notifyOnSuspiciousActivity: true,
};

/**
 * 보안 설정 Hook
 *
 * @example
 * ```tsx
 * const {
 *   loginNotificationSettings,
 *   changePassword,
 *   updateLoginNotifications
 * } = useSecuritySettings();
 *
 * // 비밀번호 변경
 * await changePassword({
 *   currentPassword: 'old123!@#',
 *   newPassword: 'new123!@#'
 * });
 *
 * // 로그인 알림 설정 변경
 * await updateLoginNotifications({
 *   notifyOnNewDevice: false
 * });
 * ```
 */
export const useSecuritySettings = (): UseSecuritySettingsReturn => {
  const { currentUser } = useAuth();
  const [error, setError] = useState<Error | null>(null);

  // 문서 경로 생성
  const settingsPath = useMemo(() => {
    if (!currentUser) return null;
    return `users/${currentUser.uid}/securitySettings/loginNotifications`;
  }, [currentUser]);

  // useFirestoreDocument로 구독
  const {
    data: settingsData,
    loading,
    error: hookError,
  } = useFirestoreDocument<LoginNotificationSettings>(settingsPath || '', {
    enabled: settingsPath !== null,
    errorOnNotFound: false,
    onSuccess: () => {
      if (settingsData) {
        logger.debug('로그인 알림 설정 로드', {
          component: 'useSecuritySettings',
          data: { userId: currentUser?.uid },
        });
      }
    },
    onError: (err) => {
      logger.error('로그인 알림 설정 구독 실패', err, {
        component: 'useSecuritySettings',
        data: { userId: currentUser?.uid },
      });
    },
  });

  // 문서가 없으면 기본값 생성 시도
  const loginNotificationSettings = useMemo(() => {
    if (!currentUser) return null;

    if (!settingsData && !loading && settingsPath) {
      // 기본 설정 생성
      const defaultSettings: LoginNotificationSettings = {
        ...DEFAULT_LOGIN_NOTIFICATION_SETTINGS,
        updatedAt: new Date(),
      };

      const settingsRef = doc(db, settingsPath);

      // 비동기 작업을 즉시 실행 함수로 처리
      (async () => {
        try {
          await setDoc(settingsRef, defaultSettings);
          logger.info('기본 로그인 알림 설정 생성', {
            component: 'useSecuritySettings',
            data: { userId: currentUser.uid },
          });
        } catch (err) {
          logger.error('기본 설정 생성 실패', err as Error, {
            component: 'useSecuritySettings',
            data: { userId: currentUser.uid },
          });
        }
      })();

      return defaultSettings;
    }

    return settingsData;
  }, [settingsData, loading, currentUser, settingsPath]);

  /**
   * 비밀번호 변경
   */
  const handleChangePassword = useCallback(
    async (input: PasswordChangeInput): Promise<void> => {
      if (!currentUser || !currentUser.email) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        setError(null);

        // 검증
        const validation = validatePasswordChange(input);
        if (!validation.isValid) {
          throw new ValidationError(validation.errors.join(', '));
        }

        // 1. 재인증 (본인 확인)
        const credential = EmailAuthProvider.credential(currentUser.email, input.currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // 2. 비밀번호 변경
        await firebaseUpdatePassword(currentUser, input.newPassword);

        toast.success('비밀번호가 변경되었습니다.', '비밀번호 변경');

        logger.info('비밀번호 변경 성공', {
          component: 'useSecuritySettings',
          data: { userId: currentUser.uid },
        });
      } catch (err) {
        const error = err as any;

        if (error.code === 'auth/wrong-password') {
          const validationError = new ValidationError('현재 비밀번호가 올바르지 않습니다.');
          setError(validationError);
          toast.error(validationError.message);
          throw validationError;
        }

        if (error instanceof ValidationError) {
          setError(error);
          toast.error(error.message);
          throw error;
        }

        const serviceError = new ServiceError('비밀번호 변경에 실패했습니다.');
        setError(serviceError);
        logger.error('비밀번호 변경 실패', error, {
          component: 'useSecuritySettings',
          data: { userId: currentUser.uid },
        });
        toast.error(serviceError.message);
        throw serviceError;
      }
    },
    [currentUser]
  );

  /**
   * 로그인 알림 설정 업데이트
   */
  const handleUpdateLoginNotifications = useCallback(
    async (updates: Partial<LoginNotificationSettings>): Promise<void> => {
      if (!currentUser) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        setError(null);

        const settingsRef = doc(
          db,
          'users',
          currentUser.uid,
          'securitySettings',
          'loginNotifications'
        );

        await updateDoc(settingsRef, {
          ...updates,
          updatedAt: new Date(),
        });

        toast.success('로그인 알림 설정이 변경되었습니다.');

        logger.info('로그인 알림 설정 업데이트', {
          component: 'useSecuritySettings',
          data: { userId: currentUser.uid, updates },
        });
      } catch (err) {
        const error = err as Error;
        setError(error);
        logger.error('로그인 알림 설정 업데이트 실패', error, {
          component: 'useSecuritySettings',
          data: { userId: currentUser.uid },
        });
        toast.error('설정 변경에 실패했습니다.');
        throw error;
      }
    },
    [currentUser]
  );

  return {
    loginNotificationSettings,
    loading,
    error: error || hookError,
    changePassword: handleChangePassword,
    updateLoginNotifications: handleUpdateLoginNotifications,
    refreshSettings: async () => {
      // useFirestoreDocument는 실시간 구독이므로 별도 새로고침 불필요
      // 호환성을 위해 빈 함수 제공
    },
  };
};
