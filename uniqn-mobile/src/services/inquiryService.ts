/**
 * UNIQN Mobile - Inquiry Service
 *
 * @description 문의 관리 서비스 (Firestore)
 * @version 1.0.0
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
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
import { withErrorHandling } from '@/utils/withErrorHandling';
import { ValidationError, ERROR_CODES } from '@/errors';
import { COLLECTIONS } from '@/constants';
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
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const { userId, filters: _filters, pageSize = PAGE_SIZE, lastDoc } = options;

    if (!userId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        field: 'userId',
        userMessage: '사용자 ID가 필요합니다',
      });
    }

    // 기본 쿼리
    let q = query(
      collection(db, COLLECTIONS.INQUIRIES),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    );

    // 페이지네이션
    if (lastDoc) {
      q = query(
        collection(db, COLLECTIONS.INQUIRIES),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize + 1)
      );
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const inquiries = docs.slice(0, pageSize).map(docToInquiry);

    logger.info('내 문의 조회 완료', {
      component: 'inquiryService',
      userId,
      count: inquiries.length,
    });

    return {
      inquiries,
      lastDoc: inquiries.length > 0 ? docs[inquiries.length - 1] : null,
      hasMore,
    };
  }, 'fetchMyInquiries');
}

/**
 * 전체 문의 목록 조회 (관리자)
 */
export async function fetchAllInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const { filters, pageSize = PAGE_SIZE, lastDoc } = options;

    // 기본 쿼리
    let q = query(
      collection(db, COLLECTIONS.INQUIRIES),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    );

    // 상태 필터
    if (filters?.status && filters.status !== 'all') {
      q = query(
        collection(db, COLLECTIONS.INQUIRIES),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      );
    }

    // 페이지네이션
    if (lastDoc) {
      if (filters?.status && filters.status !== 'all') {
        q = query(
          collection(db, COLLECTIONS.INQUIRIES),
          where('status', '==', filters.status),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize + 1)
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.INQUIRIES),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize + 1)
        );
      }
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const inquiries = docs.slice(0, pageSize).map(docToInquiry);

    logger.info('전체 문의 조회 완료', {
      component: 'inquiryService',
      count: inquiries.length,
      filters,
    });

    return {
      inquiries,
      lastDoc: inquiries.length > 0 ? docs[inquiries.length - 1] : null,
      hasMore,
    };
  }, 'fetchAllInquiries');
}

/**
 * 문의 상세 조회
 */
export async function getInquiry(inquiryId: string): Promise<Inquiry | null> {
  return withErrorHandling(async () => {
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
  }, 'getInquiry');
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
  return withErrorHandling(async () => {
    const db = getFirebaseDb();

    const inquiryData = {
      userId,
      userEmail,
      userName,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: 'open' as InquiryStatus,
      attachments: input.attachments || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.INQUIRIES), inquiryData);

    logger.info('문의 생성 완료', {
      component: 'inquiryService',
      inquiryId: docRef.id,
      category: input.category,
    });

    return docRef.id;
  }, 'createInquiry');
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
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);

    await updateDoc(docRef, {
      response: input.response,
      responderId,
      responderName,
      respondedAt: serverTimestamp(),
      status: input.status || 'closed',
      updatedAt: serverTimestamp(),
    });

    logger.info('문의 응답 완료', {
      component: 'inquiryService',
      inquiryId,
      responderId,
      status: input.status,
    });
  }, 'respondToInquiry');
}

/**
 * 문의 상태 변경 (관리자)
 */
export async function updateInquiryStatus(
  inquiryId: string,
  status: InquiryStatus
): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);

    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    logger.info('문의 상태 변경 완료', {
      component: 'inquiryService',
      inquiryId,
      status,
    });
  }, 'updateInquiryStatus');
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 미답변 문의 수 조회 (관리자)
 */
export async function getUnansweredCount(): Promise<number> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const q = query(
      collection(db, COLLECTIONS.INQUIRIES),
      where('status', '==', 'open')
    );

    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }, 'getUnansweredCount');
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
