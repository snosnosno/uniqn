/**
 * UNIQN Mobile - Firebase Event QR Repository
 *
 * @description Firebase Firestore 기반 Event QR Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. QR 코드 CRUD 작업 캡슐화
 * 3. 만료 시간 기반 자동 비활성화
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError, handleSilentError } from '@/errors/serviceErrorHandler';
import type { EventQRScopeOptions, IEventQRRepository } from '../interfaces/IEventQRRepository';
import type { EventQRCode, QRCodeAction } from '@/types';
import { COLLECTIONS, FIELDS } from '@/constants';

// ============================================================================
// Repository Implementation
// ============================================================================

function matchesScope(
  qrCode: Pick<EventQRCode, 'assignmentGroupId' | 'timeSlot'>,
  options?: EventQRScopeOptions
): boolean {
  if (!options) {
    return true;
  }

  if (options.assignmentGroupId !== undefined) {
    const assignmentGroupId = qrCode.assignmentGroupId ?? null;
    if (assignmentGroupId !== (options.assignmentGroupId ?? null)) {
      return false;
    }
  }

  if (options.timeSlot !== undefined) {
    const timeSlot = qrCode.timeSlot ?? null;
    if (timeSlot !== (options.timeSlot ?? null)) {
      return false;
    }
  }

  return true;
}

/**
 * Firebase Event QR Repository
 */
export class FirebaseEventQRRepository implements IEventQRRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(qrId: string): Promise<EventQRCode | null> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES, qrId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as EventQRCode;
    } catch (error) {
      logger.error('QR 코드 조회 실패', toError(error), { qrId });
      throw handleServiceError(error, {
        operation: 'QR 코드 조회',
        component: 'EventQRRepository',
        context: { qrId },
      });
    }
  }

  async getActiveByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    options?: EventQRScopeOptions
  ): Promise<EventQRCode | null> {
    try {
      const qrRef = collection(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES);
      const q = query(
        qrRef,
        where(FIELDS.EVENT_QR.jobPostingId, '==', jobPostingId),
        where(FIELDS.EVENT_QR.date, '==', date),
        where(FIELDS.EVENT_QR.action, '==', action),
        where(FIELDS.EVENT_QR.isActive, '==', true),
        orderBy(FIELDS.EVENT_QR.createdAt, 'desc')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const matchedEntry = snapshot.docs
        .map((docSnap) => ({
          docSnap,
          data: docSnap.data() as Omit<EventQRCode, 'id'>,
        }))
        .find(({ data }) => matchesScope(data, options));

      if (!matchedEntry) {
        return null;
      }

      const { docSnap, data } = matchedEntry;

      // 만료 확인 및 자동 비활성화 (트랜잭션으로 TOCTOU 방지)
      if (data.expiresAt.toMillis() < Date.now()) {
        return await runTransaction(getFirebaseDb(), async (transaction) => {
          const freshDoc = await transaction.get(
            doc(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES, docSnap.id)
          );
          if (!freshDoc.exists()) return null;

          const freshData = freshDoc.data() as Omit<EventQRCode, 'id'>;
          if (!freshData.isActive) return null;

          if (freshData.expiresAt.toMillis() < Date.now()) {
            transaction.update(freshDoc.ref, { isActive: false });
            return null;
          }
          return { id: freshDoc.id, ...freshData };
        });
      }

      return { id: docSnap.id, ...data };
    } catch (error) {
      logger.error('활성 QR 조회 실패', toError(error), { jobPostingId, date, action });
      return null;
    }
  }

  async validateSecurityCode(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    securityCode: string,
    options?: EventQRScopeOptions
  ): Promise<EventQRCode | null> {
    try {
      const qrRef = collection(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES);
      const q = query(
        qrRef,
        where(FIELDS.EVENT_QR.jobPostingId, '==', jobPostingId),
        where(FIELDS.EVENT_QR.date, '==', date),
        where(FIELDS.EVENT_QR.action, '==', action),
        where(FIELDS.EVENT_QR.securityCode, '==', securityCode),
        where(FIELDS.EVENT_QR.isActive, '==', true),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data() as Omit<EventQRCode, 'id'>;

      if (!matchesScope(data, options)) {
        return null;
      }

      // 서버 시간 기준 만료 확인
      if (data.expiresAt.toMillis() < Date.now()) {
        return null;
      }

      return { id: docSnap.id, ...data };
    } catch (error) {
      logger.error('보안 코드 검증 실패', toError(error), { jobPostingId, date, action });
      return null;
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(data: Omit<EventQRCode, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES), data);

      logger.info('QR 코드 생성 완료', { qrId: docRef.id });
      return docRef.id;
    } catch (error) {
      throw handleServiceError(error, {
        operation: 'QR 코드 생성',
        component: 'EventQRRepository',
        context: { jobPostingId: data.jobPostingId },
      });
    }
  }

  // ==========================================================================
  // 업데이트 (Update)
  // ==========================================================================

  async deactivate(qrId: string): Promise<void> {
    try {
      await updateDoc(doc(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES, qrId), {
        isActive: false,
      });
      logger.info('QR 코드 비활성화 완료', { qrId });
    } catch (error) {
      throw handleServiceError(error, {
        operation: 'QR 코드 비활성화',
        component: 'EventQRRepository',
        context: { qrId },
      });
    }
  }

  async deactivateByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    options?: EventQRScopeOptions
  ): Promise<number> {
    try {
      const qrRef = collection(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES);
      const q = query(
        qrRef,
        where(FIELDS.EVENT_QR.jobPostingId, '==', jobPostingId),
        where(FIELDS.EVENT_QR.date, '==', date),
        where(FIELDS.EVENT_QR.action, '==', action),
        where(FIELDS.EVENT_QR.isActive, '==', true)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) return 0;

      const scopedDocs = snapshot.docs.filter((docSnap) =>
        matchesScope(docSnap.data() as Omit<EventQRCode, 'id'>, options)
      );

      if (scopedDocs.length === 0) return 0;

      // writeBatch로 원자적 배치 비활성화
      const batch = writeBatch(getFirebaseDb());
      scopedDocs.forEach((docSnap) => {
        batch.update(doc(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES, docSnap.id), {
          isActive: false,
        });
      });
      await batch.commit();

      return scopedDocs.length;
    } catch (error) {
      // 기존 QR 비활성화 실패는 새 QR 생성에 영향 없음 - 명시적 silent 처리
      handleSilentError(error, {
        operation: '기존 QR 비활성화',
        component: 'EventQRRepository',
        context: { jobPostingId, date, action },
      });
      return 0;
    }
  }

  // ==========================================================================
  // 정리 (Cleanup)
  // ==========================================================================

  async deactivateExpired(): Promise<number> {
    try {
      const qrRef = collection(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES);
      const now = Timestamp.now();

      const q = query(
        qrRef,
        where(FIELDS.EVENT_QR.isActive, '==', true),
        where(FIELDS.EVENT_QR.expiresAt, '<', now)
      );

      const snapshot = await getDocs(q);
      let count = 0;

      await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          await updateDoc(doc(getFirebaseDb(), COLLECTIONS.EVENT_QR_CODES, docSnap.id), {
            isActive: false,
          });
          count++;
        })
      );

      logger.info('만료 QR 정리 완료', { count });
      return count;
    } catch (error) {
      logger.error('만료 QR 정리 실패', toError(error));
      return 0;
    }
  }
}
