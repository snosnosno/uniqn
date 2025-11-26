/**
 * 동의 관리 서비스
 *
 * @description
 * 사용자 동의 생성, 조회, 업데이트, 변경 이력 관리
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  validateConsentCreate,
  validateConsentUpdate,
  ValidationError,
  ServiceError,
} from '../utils/validation/accountValidation';
import type {
  ConsentRecord,
  ConsentCreateInput,
  ConsentUpdateInput,
  ConsentChange,
} from '../types/consent';

/**
 * 동의 생성
 */
export const createConsent = async (userId: string, input: ConsentCreateInput): Promise<void> => {
  try {
    // 검증
    const validation = validateConsentCreate(input);
    if (!validation.isValid) {
      logger.error('동의 데이터 검증 실패', new Error(validation.errors.join(', ')), {
        component: 'ConsentService',
        data: { userId, errors: validation.errors },
      });
      throw new ValidationError(validation.errors.join(', '));
    }

    // Firestore 문서 생성
    const consentRef = doc(db, 'users', userId, 'consents', 'current');

    const consentData: Omit<ConsentRecord, 'createdAt' | 'updatedAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      version: '1.0.0',
      userId,
      termsOfService: {
        agreed: input.termsOfService.agreed,
        version: input.termsOfService.version,
        agreedAt: serverTimestamp() as Timestamp,
        ...(input.termsOfService.ipAddress && { ipAddress: input.termsOfService.ipAddress }),
      },
      privacyPolicy: {
        agreed: input.privacyPolicy.agreed,
        version: input.privacyPolicy.version,
        agreedAt: serverTimestamp() as Timestamp,
        ...(input.privacyPolicy.ipAddress && { ipAddress: input.privacyPolicy.ipAddress }),
      },
      ...(input.marketing && {
        marketing: {
          agreed: input.marketing.agreed,
          ...(input.marketing.agreed && { agreedAt: serverTimestamp() as Timestamp }),
        },
      }),
      ...(input.locationService && {
        locationService: {
          agreed: input.locationService.agreed,
          ...(input.locationService.agreed && { agreedAt: serverTimestamp() as Timestamp }),
        },
      }),
      ...(input.pushNotification && {
        pushNotification: {
          agreed: input.pushNotification.agreed,
          ...(input.pushNotification.agreed && { agreedAt: serverTimestamp() as Timestamp }),
        },
      }),
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(consentRef, consentData);

    logger.info('동의 내역 생성 성공', {
      component: 'ConsentService',
      data: { userId },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    logger.error('동의 내역 생성 실패', error as Error, {
      component: 'ConsentService',
      data: { userId },
    });
    throw new ServiceError('동의 내역 생성에 실패했습니다.');
  }
};

/**
 * 동의 내역 조회
 */
export const getConsent = async (userId: string): Promise<ConsentRecord | null> => {
  try {
    const consentRef = doc(db, 'users', userId, 'consents', 'current');
    const snapshot = await getDoc(consentRef);

    if (!snapshot.exists()) {
      logger.info('동의 내역 없음', {
        component: 'ConsentService',
        data: { userId },
      });
      return null;
    }

    const data = snapshot.data() as ConsentRecord;

    logger.debug('동의 내역 조회 성공', {
      component: 'ConsentService',
      data: { userId },
    });

    return data;
  } catch (error) {
    logger.error('동의 내역 조회 실패', error as Error, {
      component: 'ConsentService',
      data: { userId },
    });
    throw new ServiceError('동의 내역 조회에 실패했습니다.');
  }
};

/**
 * 동의 내역 업데이트 (선택 동의만 변경 가능)
 */
export const updateConsent = async (
  userId: string,
  updates: ConsentUpdateInput,
  ipAddress?: string
): Promise<void> => {
  try {
    // 검증
    const validation = validateConsentUpdate(updates);
    if (!validation.isValid) {
      logger.error('동의 업데이트 검증 실패', new Error(validation.errors.join(', ')), {
        component: 'ConsentService',
        data: { userId, errors: validation.errors },
      });
      throw new ValidationError(validation.errors.join(', '));
    }

    // 기존 동의 내역 조회
    const currentConsent = await getConsent(userId);
    if (!currentConsent) {
      throw new ServiceError('동의 내역을 찾을 수 없습니다.');
    }

    // 변경 이력 기록 준비
    const changedFields: string[] = [];
    const previousValues: Record<string, boolean> = {};
    const newValues: Record<string, boolean> = {};

    // 업데이트 데이터 준비
    const updateData: Partial<ConsentRecord> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
      updatedAt: serverTimestamp() as Timestamp,
    };

    // 마케팅 동의 변경
    if (updates.marketing !== undefined) {
      const previousValue = currentConsent.marketing?.agreed ?? false;
      const newValue = updates.marketing.agreed;

      if (previousValue !== newValue) {
        changedFields.push('marketing');
        previousValues.marketing = previousValue;
        newValues.marketing = newValue;

        updateData.marketing = {
          agreed: newValue,
          agreedAt: newValue
            ? (serverTimestamp() as Timestamp)
            : currentConsent.marketing?.agreedAt || (serverTimestamp() as Timestamp),
          ...(!newValue && { revokedAt: serverTimestamp() as Timestamp }),
        };
      }
    }

    // 위치 서비스 동의 변경
    if (updates.locationService !== undefined) {
      const previousValue = currentConsent.locationService?.agreed ?? false;
      const newValue = updates.locationService.agreed;

      if (previousValue !== newValue) {
        changedFields.push('locationService');
        previousValues.locationService = previousValue;
        newValues.locationService = newValue;

        updateData.locationService = {
          agreed: newValue,
          agreedAt: newValue
            ? (serverTimestamp() as Timestamp)
            : currentConsent.locationService?.agreedAt || (serverTimestamp() as Timestamp),
          ...(!newValue && { revokedAt: serverTimestamp() as Timestamp }),
        };
      }
    }

    // 푸시 알림 동의 변경
    if (updates.pushNotification !== undefined) {
      const previousValue = currentConsent.pushNotification?.agreed ?? false;
      const newValue = updates.pushNotification.agreed;

      if (previousValue !== newValue) {
        changedFields.push('pushNotification');
        previousValues.pushNotification = previousValue;
        newValues.pushNotification = newValue;

        updateData.pushNotification = {
          agreed: newValue,
          agreedAt: newValue
            ? (serverTimestamp() as Timestamp)
            : currentConsent.pushNotification?.agreedAt || (serverTimestamp() as Timestamp),
          ...(!newValue && { revokedAt: serverTimestamp() as Timestamp }),
        };
      }
    }

    // 변경사항이 없으면 종료
    if (changedFields.length === 0) {
      logger.info('동의 변경사항 없음', {
        component: 'ConsentService',
        data: { userId },
      });
      return;
    }

    // Firestore 업데이트
    const consentRef = doc(db, 'users', userId, 'consents', 'current');
    await updateDoc(consentRef, updateData);

    // 변경 이력 저장
    await recordConsentChange(userId, {
      changedFields,
      previousValues,
      newValues,
      ...(ipAddress && { ipAddress }),
    });

    logger.info('동의 내역 업데이트 성공', {
      component: 'ConsentService',
      data: { userId, changedFields },
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ServiceError) {
      throw error;
    }

    logger.error('동의 내역 업데이트 실패', error as Error, {
      component: 'ConsentService',
      data: { userId },
    });
    throw new ServiceError('동의 내역 업데이트에 실패했습니다.');
  }
};

/**
 * 동의 변경 이력 기록
 */
const recordConsentChange = async (
  userId: string,
  change: {
    changedFields: string[];
    previousValues: Record<string, boolean>;
    newValues: Record<string, boolean>;
    ipAddress?: string;
  }
): Promise<void> => {
  try {
    const historyRef = collection(db, 'users', userId, 'consents', 'history');

    const changeData: Omit<ConsentChange, 'id'> = {
      timestamp: serverTimestamp() as Timestamp,
      changedFields: change.changedFields,
      previousValues: change.previousValues,
      newValues: change.newValues,
      ...(change.ipAddress && { ipAddress: change.ipAddress }),
    };

    await addDoc(historyRef, changeData);

    logger.debug('동의 변경 이력 기록 성공', {
      component: 'ConsentService',
      data: { userId, changedFields: change.changedFields },
    });
  } catch (error) {
    // 이력 기록 실패는 치명적이지 않으므로 로그만 남김
    logger.error('동의 변경 이력 기록 실패', error as Error, {
      component: 'ConsentService',
      data: { userId },
    });
  }
};

/**
 * 필수 동의 여부 확인
 */
export const hasRequiredConsents = (consent: ConsentRecord | null): boolean => {
  if (!consent) {
    return false;
  }

  return consent.termsOfService.agreed && consent.privacyPolicy.agreed;
};

/**
 * 동의 내역 존재 여부 확인
 */
export const consentExists = async (userId: string): Promise<boolean> => {
  try {
    const consent = await getConsent(userId);
    return consent !== null;
  } catch (error) {
    logger.error('동의 내역 존재 확인 실패', error as Error, {
      component: 'ConsentService',
      data: { userId },
    });
    return false;
  }
};
