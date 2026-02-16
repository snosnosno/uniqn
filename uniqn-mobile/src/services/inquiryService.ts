/**
 * UNIQN Mobile - Inquiry Service
 *
 * @description 문의 관리 서비스 (Firestore)
 * @version 1.1.0 - handleServiceError 패턴 적용
 *
 * TODO [P1-2]: Repository 패턴 전환 (현재 Firebase 직접 호출)
 */

import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { QueryBuilder, processPaginatedResults } from '@/utils/firestore';
import { ValidationError, ERROR_CODES } from '@/errors';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;
const COMPONENT = 'inquiryService';

// ============================================================================
// Types
// ============================================================================

interface FetchInquiriesOptions {
  userId?: string;
  filters?: InquiryFilters;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface FetchInquiriesResult {
  inquiries: Inquiry[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Firestore 문서를 Inquiry로 변환
 */
function docToInquiry(doc: QueryDocumentSnapshot): Inquiry {
  const data = doc.data();
  return {
    id: doc.id,
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
// Inquiry Fetch Operations
// ============================================================================

/**
 * 내 문의 목록 조회 (사용자)
 */
export async function fetchMyInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  try {
    const db = getFirebaseDb();
    const { userId, pageSize = PAGE_SIZE, lastDoc } = options;

    if (!userId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        field: 'userId',
        userMessage: '사용자 ID가 필요합니다',
      });
    }

    // QueryBuilder로 쿼리 구성
    const q = new QueryBuilder(collection(db, COLLECTIONS.INQUIRIES))
      .whereEqual(FIELDS.INQUIRY.userId, userId)
      .orderByDesc(FIELDS.INQUIRY.createdAt)
      .paginate(pageSize, lastDoc)
      .build();

    const snapshot = await getDocs(q);
    const result = processPaginatedResults(snapshot.docs, pageSize, docToInquiry);

    logger.info('내 문의 조회 완료', {
      component: COMPONENT,
      userId,
      count: result.items.length,
    });

    return {
      inquiries: result.items,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 문의 목록 조회',
      component: COMPONENT,
      context: { userId: options.userId },
    });
  }
}

/**
 * 전체 문의 목록 조회 (관리자)
 */
export async function fetchAllInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  try {
    const db = getFirebaseDb();
    const { filters, pageSize = PAGE_SIZE, lastDoc } = options;

    // QueryBuilder로 쿼리 구성
    const q = new QueryBuilder(collection(db, COLLECTIONS.INQUIRIES))
      .whereIf(
        filters?.status && filters.status !== 'all',
        FIELDS.INQUIRY.status,
        '==',
        filters?.status
      )
      .orderByDesc(FIELDS.INQUIRY.createdAt)
      .paginate(pageSize, lastDoc)
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
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전체 문의 목록 조회',
      component: COMPONENT,
    });
  }
}

/**
 * 문의 상세 조회
 */
export async function getInquiry(inquiryId: string): Promise<Inquiry | null> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
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
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 상세 조회',
      component: COMPONENT,
      context: { inquiryId },
    });
  }
}

// ============================================================================
// Inquiry Create Operations
// ============================================================================

/**
 * 문의 생성 (사용자)
 */
export async function createInquiry(
  userId: string,
  userEmail: string,
  userName: string,
  input: CreateInquiryInput
): Promise<string> {
  try {
    const db = getFirebaseDb();

    const inquiryData = {
      userId,
      userEmail,
      userName,
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
    throw handleServiceError(error, {
      operation: '문의 생성',
      component: COMPONENT,
      context: { userId, category: input.category },
    });
  }
}

// ============================================================================
// Inquiry Update Operations (Admin)
// ============================================================================

/**
 * 문의 응답 (관리자)
 */
export async function respondToInquiry(
  inquiryId: string,
  responderId: string,
  responderName: string,
  input: RespondInquiryInput
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);

    await updateDoc(docRef, {
      response: input.response,
      responderId,
      responderName,
      respondedAt: serverTimestamp(),
      status: input.status || STATUS.INQUIRY.CLOSED,
      updatedAt: serverTimestamp(),
    });

    logger.info('문의 응답 완료', {
      component: COMPONENT,
      inquiryId,
      responderId,
      status: input.status,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 응답',
      component: COMPONENT,
      context: { inquiryId, responderId },
    });
  }
}

/**
 * 문의 상태 변경 (관리자)
 */
export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);

    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    logger.info('문의 상태 변경 완료', {
      component: COMPONENT,
      inquiryId,
      status,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 상태 변경',
      component: COMPONENT,
      context: { inquiryId, status },
    });
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 미답변 문의 수 조회 (관리자)
 */
export async function getUnansweredCount(): Promise<number> {
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

// ============================================================================
// Export
// ============================================================================

export const inquiryService = {
  fetchMyInquiries,
  fetchAllInquiries,
  getInquiry,
  createInquiry,
  respondToInquiry,
  updateInquiryStatus,
  getUnansweredCount,
};

export default inquiryService;
