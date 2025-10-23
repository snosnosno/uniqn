/**
 * 보안 설정 Hook
 *
 * @description
 * 비밀번호 변경, 로그인 알림 설정 관리
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { validatePasswordChange, ValidationError, ServiceError } from '../utils/validation/accountValidation';
import type {
  LoginNotificationSettings,
  PasswordChangeInput,
} from '../types/security';

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
  const [loginNotificationSettings, setLoginNotificationSettings] =
    useState<LoginNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Firestore 실시간 구독 (로그인 알림 설정)
   */
  useEffect(() => {
    if (!currentUser) {
      setLoginNotificationSettings(null);
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, 'users', currentUser.uid, 'securitySettings', 'loginNotifications');

    const unsubscribe = onSnapshot(
      settingsRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as LoginNotificationSettings;
          setLoginNotificationSettings(data);
          logger.debug('로그인 알림 설정 로드', {
            component: 'useSecuritySettings',
            data: { userId: currentUser.uid },
          });
        } else {
          // 설정이 없으면 기본값으로 생성
          const defaultSettings: LoginNotificationSettings = {
            ...DEFAULT_LOGIN_NOTIFICATION_SETTINGS,
            updatedAt: new Date(),
          };

          try {
            await setDoc(settingsRef, defaultSettings);
            setLoginNotificationSettings(defaultSettings);
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
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error('로그인 알림 설정 구독 실패', err, {
          component: 'useSecuritySettings',
          data: { userId: currentUser.uid },
        });
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  /**
   * 비밀번호 변경
   */
  const handleChangePassword = useCallback(
    async (input: PasswordChangeInput): Promise<void> => {
      if (!currentUser || !currentUser.email) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        setLoading(true);
        setError(null);

        // 검증
        const validation = validatePasswordChange(input);
        if (!validation.isValid) {
          throw new ValidationError(validation.errors.join(', '));
        }

        // 1. 재인증 (본인 확인)
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          input.currentPassword
        );
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
      } finally {
        setLoading(false);
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
        throw new Error('로그인이 필요합니다.');
      }

      try {
        setError(null);

        const settingsRef = doc(db, 'users', currentUser.uid, 'securitySettings', 'loginNotifications');

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

  /**
   * 설정 새로고침
   */
  const refreshSettings = useCallback(async (): Promise<void> => {
    if (!currentUser) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const settingsRef = doc(db, 'users', currentUser.uid, 'securitySettings', 'loginNotifications');
      const snapshot = await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as LoginNotificationSettings;
        setLoginNotificationSettings(data);
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      logger.error('설정 새로고침 실패', error, {
        component: 'useSecuritySettings',
        data: { userId: currentUser.uid },
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  return {
    loginNotificationSettings,
    loading,
    error,
    changePassword: handleChangePassword,
    updateLoginNotifications: handleUpdateLoginNotifications,
    refreshSettings,
  };
};
