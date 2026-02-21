/**
 * UNIQN Mobile - Firebase Inquiry Repository
 *
 * @description Firebase Firestore 기반 Inquiry Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 문의 CRUD 작업 캡슐화
 * 3. 상태 전이 검증 (트랜잭션)
 */

import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { QueryBuilder, processPaginatedResults } from '@/utils/firestore';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type { Inquiry, InquiryStatus } from '@/types';
import type {
  IInquiryRepository,
  FetchInquiriesOptions,
  FetchInquiriesResult,
  CreateInquiryContext,
} from '../interfaces/IInquiryRepository';
import type { CreateInquiryInput, RespondInquiryInput } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COMPONENT = 'InquiryRepository';

const INQUIRY_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['closed'],
  closed: ['in_progress'],
};

// ============================================================================
// Helpers
// ============================================================================

function docToInquiry(docSnap: QueryDocumentSnapshot | DocumentSnapshot): Inquiry {
  const data = docSnap.data()!;
  return {
    id: docSnap.id,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    category: data.category,
    subject: data.subject,
    message: data.message,
    status: data.status,
    attachments: data.attachments,
    response: data.response,
    responderId: data.responderId,
    responderName: data.responderName,
    respondedAt: data.respondedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Inquiry Repository
 */
export class FirebaseInquiryRepository implements IInquiryRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(inquiryId: string): Promise<Inquiry | null> {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToInquiry(docSnap);
    } catch (error) {
      throw handleServiceError(error, {
        operation: '문의 상세 조회',
        component: COMPONENT,
        context: { inquiryId },
      });
    }
  }

  async getByUserId(
    userId: string,
    options: FetchInquiriesOptions = {}
  ): Promise<FetchInquiriesResult> {
    try {
      const db = getFirebaseDb();
      const { pageSize = 20, cursor } = options;

      const q = new QueryBuilder(collection(db, COLLECTIONS.INQUIRIES))
        .whereEqual(FIELDS.INQUIRY.userId, userId)
        .orderByDesc(FIELDS.INQUIRY.createdAt)
        .paginate(pageSize, cursor as QueryDocumentSnapshot | undefined)
        .build();

      const snapshot = await getDocs(q);
      const result = processPaginatedResults(snapshot.docs, pageSize, docToInquiry);

      logger.info('사용자 문의 조회 완료', {
        component: COMPONENT,
        userId,
        count: result.items.length,
      });

      return {
        inquiries: result.items,
        nextCursor: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '사용자 문의 목록 조회',
        component: COMPONENT,
        context: { userId },
      });
    }
  }

  async getAll(options: FetchInquiriesOptions = {}): Promise<FetchInquiriesResult> {
    try {
      const db = getFirebaseDb();
      const { filters, pageSize = 20, cursor } = options;

      const q = new QueryBuilder(collection(db, COLLECTIONS.INQUIRIES))
        .whereIf(
          filters?.status && filters.status !== 'all',
          FIELDS.INQUIRY.status,
          '==',
          filters?.status
        )
        .orderByDesc(FIELDS.INQUIRY.createdAt)
        .paginate(pageSize, cursor as QueryDocumentSnapshot | undefined)
        .build();

      const snapshot = await getDocs(q);
      const result = processPaginatedResults(snapshot.docs, pageSize, docToInquiry);

      logger.info('전체 문의 조회 완료', {
        component: COMPONENT,
        count: result.items.length,
        filters,
      });

      return {
        inquiries: result.items,
        nextCursor: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '전체 문의 목록 조회',
        component: COMPONENT,
      });
    }
  }

  async getUnansweredCount(): Promise<number> {
    try {
      const db = getFirebaseDb();
      const q = query(
        collection(db, COLLECTIONS.INQUIRIES),
        where(FIELDS.INQUIRY.status, '==', STATUS.INQUIRY.OPEN)
      );

      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '미답변 문의 수 조회',
        component: COMPONENT,
      });
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(context: CreateInquiryContext, input: CreateInquiryInput): Promise<string> {
    try {
      const db = getFirebaseDb();

      const inquiryData = {
        userId: context.userId,
        userEmail: context.userEmail,
        userName: context.userName,
        category: input.category,
        subject: input.subject,
        message: input.message,
        status: STATUS.INQUIRY.OPEN as InquiryStatus,
        attachments: input.attachments || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.INQUIRIES), inquiryData);

      logger.info('문의 생성 완료', {
        component: COMPONENT,
        inquiryId: docRef.id,
        category: input.category,
      });

      return docRef.id;
    } catch (error) {
      logger.error('문의 생성 실패', toError(error), {
        userId: context.userId,
        category: input.category,
      });
      throw handleServiceError(error, {
        operation: '문의 생성',
        component: COMPONENT,
        context: { userId: context.userId, category: input.category },
      });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async respond(
    inquiryId: string,
    responderId: string,
    responderName: string,
    input: RespondInquiryInput
  ): Promise<void> {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);
      const targetStatus = input.status || STATUS.INQUIRY.CLOSED;

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '문의를 찾을 수 없습니다',
            metadata: { inquiryId },
          });
        }

        const currentStatus = docSnap.data().status as string;
        const allowed = INQUIRY_ALLOWED_TRANSITIONS[currentStatus];

        if (!allowed?.includes(targetStatus)) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: `현재 상태(${currentStatus})에서는 해당 작업을 수행할 수 없습니다`,
            metadata: { inquiryId, currentStatus, targetStatus },
          });
        }

        transaction.update(docRef, {
          response: input.response,
          responderId,
          responderName,
          respondedAt: serverTimestamp(),
          status: targetStatus,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('문의 응답 완료', {
        component: COMPONENT,
        inquiryId,
        responderId,
        status: input.status,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('문의 응답 실패', toError(error), { inquiryId, responderId });
      throw handleServiceError(error, {
        operation: '문의 응답',
        component: COMPONENT,
        context: { inquiryId, responderId },
      });
    }
  }

  async updateStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '문의를 찾을 수 없습니다',
            metadata: { inquiryId },
          });
        }

        const currentStatus = docSnap.data().status as string;
        const allowed = INQUIRY_ALLOWED_TRANSITIONS[currentStatus];

        if (!allowed?.includes(status)) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: `현재 상태(${currentStatus})에서 ${status}(으)로 변경할 수 없습니다`,
            metadata: { inquiryId, currentStatus, targetStatus: status },
          });
        }

        transaction.update(docRef, {
          status,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('문의 상태 변경 완료', {
        component: COMPONENT,
        inquiryId,
        status,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('문의 상태 변경 실패', toError(error), { inquiryId, status });
      throw handleServiceError(error, {
        operation: '문의 상태 변경',
        component: COMPONENT,
        context: { inquiryId, status },
      });
    }
  }
}
