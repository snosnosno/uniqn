/**
 * UNIQN Mobile - Announcement Service
 *
 * @description 공지사항 관리 서비스 (Firestore)
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
  deleteDoc,
  serverTimestamp,
  increment,
  QueryDocumentSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { withErrorHandling } from '@/utils/withErrorHandling';
import { COLLECTIONS } from '@/constants';
import type {
  Announcement,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilters,
} from '@/types';
import type { UserRole } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;

// ============================================================================
// Types
// ============================================================================

interface FetchAnnouncementsOptions {
  filters?: AnnouncementFilters;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface FetchAnnouncementsResult {
  announcements: Announcement[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Firestore 문서를 Announcement로 변환
 */
function docToAnnouncement(doc: QueryDocumentSnapshot): Announcement {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    content: data.content,
    category: data.category,
    status: data.status,
    priority: data.priority ?? 0,
    isPinned: data.isPinned ?? false,
    targetAudience: data.targetAudience ?? { type: 'all' },
    authorId: data.authorId,
    authorName: data.authorName,
    viewCount: data.viewCount ?? 0,
    publishedAt: data.publishedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    imageUrl: data.imageUrl ?? null,
    imageStoragePath: data.imageStoragePath ?? null,
    images: data.images ?? [],
  };
}

// ============================================================================
// Announcement Fetch Operations
// ============================================================================

/**
 * 발행된 공지사항 목록 조회 (사용자용)
 * - 발행 상태(published)만 조회
 * - 대상 역할 필터링
 */
export async function fetchPublishedAnnouncements(
  userRole: UserRole | null,
  options: FetchAnnouncementsOptions = {}
): Promise<FetchAnnouncementsResult> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const { pageSize = PAGE_SIZE, lastDoc } = options;

    // 발행된 공지만 조회 (고정 > 우선순위 > 발행일 순)
    let q = query(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      where('status', '==', 'published'),
      orderBy('isPinned', 'desc'),
      orderBy('priority', 'desc'),
      orderBy('publishedAt', 'desc'),
      limit(pageSize + 1)
    );

    // 페이지네이션
    if (lastDoc) {
      q = query(
        collection(db, COLLECTIONS.ANNOUNCEMENTS),
        where('status', '==', 'published'),
        orderBy('isPinned', 'desc'),
        orderBy('priority', 'desc'),
        orderBy('publishedAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize + 1)
      );
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;

    // 대상 역할 필터링
    const filteredDocs = docs.filter((doc) => {
      const data = doc.data();
      const targetAudience = data.targetAudience ?? { type: 'all' };

      if (targetAudience.type === 'all') {
        return true;
      }

      if (targetAudience.type === 'roles' && targetAudience.roles && userRole) {
        return targetAudience.roles.includes(userRole);
      }

      return false;
    });

    const hasMore = filteredDocs.length > pageSize;
    const announcements = filteredDocs.slice(0, pageSize).map(docToAnnouncement);

    logger.info('발행된 공지사항 조회 완료', {
      component: 'announcementService',
      count: announcements.length,
      userRole,
    });

    return {
      announcements,
      lastDoc: filteredDocs.length > 0 ? filteredDocs[Math.min(filteredDocs.length - 1, pageSize - 1)] : null,
      hasMore,
    };
  }, 'fetchPublishedAnnouncements');
}

/**
 * 전체 공지사항 목록 조회 (관리자용)
 */
export async function fetchAllAnnouncements(
  options: FetchAnnouncementsOptions = {}
): Promise<FetchAnnouncementsResult> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const { filters, pageSize = PAGE_SIZE, lastDoc } = options;

    // 기본 쿼리 (최신순)
    let q = query(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    );

    // 상태 필터
    if (filters?.status && filters.status !== 'all') {
      q = query(
        collection(db, COLLECTIONS.ANNOUNCEMENTS),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      );
    }

    // 페이지네이션
    if (lastDoc) {
      if (filters?.status && filters.status !== 'all') {
        q = query(
          collection(db, COLLECTIONS.ANNOUNCEMENTS),
          where('status', '==', filters.status),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize + 1)
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.ANNOUNCEMENTS),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize + 1)
        );
      }
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const announcements = docs.slice(0, pageSize).map(docToAnnouncement);

    logger.info('전체 공지사항 조회 완료', {
      component: 'announcementService',
      count: announcements.length,
      filters,
    });

    return {
      announcements,
      lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null,
      hasMore,
    };
  }, 'fetchAllAnnouncements');
}

/**
 * 공지사항 상세 조회
 */
export async function getAnnouncement(announcementId: string): Promise<Announcement | null> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title,
      content: data.content,
      category: data.category,
      status: data.status,
      priority: data.priority ?? 0,
      isPinned: data.isPinned ?? false,
      targetAudience: data.targetAudience ?? { type: 'all' },
      authorId: data.authorId,
      authorName: data.authorName,
      viewCount: data.viewCount ?? 0,
      publishedAt: data.publishedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      imageUrl: data.imageUrl ?? null,
      imageStoragePath: data.imageStoragePath ?? null,
      images: data.images ?? [],
    };
  }, 'getAnnouncement');
}

// ============================================================================
// Announcement Create Operations (Admin)
// ============================================================================

/**
 * 공지사항 생성 (관리자)
 */
export async function createAnnouncement(
  authorId: string,
  authorName: string,
  input: CreateAnnouncementInput
): Promise<string> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();

    const announcementData = {
      title: input.title,
      content: input.content,
      category: input.category,
      status: 'draft' as AnnouncementStatus,
      priority: input.priority ?? 0,
      isPinned: input.isPinned ?? false,
      targetAudience: input.targetAudience,
      authorId,
      authorName,
      viewCount: 0,
      imageUrl: input.imageUrl ?? null,
      imageStoragePath: input.imageStoragePath ?? null,
      images: input.images ?? [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), announcementData);

    logger.info('공지사항 생성 완료', {
      component: 'announcementService',
      announcementId: docRef.id,
      title: input.title,
      authorId,
    });

    return docRef.id;
  }, 'createAnnouncement');
}

// ============================================================================
// Announcement Update Operations (Admin)
// ============================================================================

/**
 * 공지사항 수정 (관리자)
 */
export async function updateAnnouncement(
  announcementId: string,
  input: UpdateAnnouncementInput
): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isPinned !== undefined) updateData.isPinned = input.isPinned;
    if (input.targetAudience !== undefined) updateData.targetAudience = input.targetAudience;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.imageStoragePath !== undefined) updateData.imageStoragePath = input.imageStoragePath;
    if (input.images !== undefined) updateData.images = input.images;

    await updateDoc(docRef, updateData);

    logger.info('공지사항 수정 완료', {
      component: 'announcementService',
      announcementId,
    });
  }, 'updateAnnouncement');
}

/**
 * 공지사항 발행 (관리자)
 */
export async function publishAnnouncement(announcementId: string): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);

    await updateDoc(docRef, {
      status: 'published' as AnnouncementStatus,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('공지사항 발행 완료', {
      component: 'announcementService',
      announcementId,
    });
  }, 'publishAnnouncement');
}

/**
 * 공지사항 보관 (관리자)
 */
export async function archiveAnnouncement(announcementId: string): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);

    await updateDoc(docRef, {
      status: 'archived' as AnnouncementStatus,
      updatedAt: serverTimestamp(),
    });

    logger.info('공지사항 보관 완료', {
      component: 'announcementService',
      announcementId,
    });
  }, 'archiveAnnouncement');
}

/**
 * 공지사항 삭제 (관리자)
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);

    await deleteDoc(docRef);

    logger.info('공지사항 삭제 완료', {
      component: 'announcementService',
      announcementId,
    });
  }, 'deleteAnnouncement');
}

// ============================================================================
// View Count
// ============================================================================

/**
 * 조회수 증가 (사용자가 상세 페이지 열람 시)
 */
export async function incrementViewCount(announcementId: string): Promise<void> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId);

    await updateDoc(docRef, {
      viewCount: increment(1),
    });
  }, 'incrementViewCount');
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 상태별 공지사항 수 조회 (관리자)
 */
export async function getAnnouncementCountByStatus(): Promise<{
  draft: number;
  published: number;
  archived: number;
  total: number;
}> {
  return withErrorHandling(async () => {
    const db = getFirebaseDb();

    const [draftSnap, publishedSnap, archivedSnap] = await Promise.all([
      getCountFromServer(
        query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where('status', '==', 'draft'))
      ),
      getCountFromServer(
        query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where('status', '==', 'published'))
      ),
      getCountFromServer(
        query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where('status', '==', 'archived'))
      ),
    ]);

    const draft = draftSnap.data().count;
    const published = publishedSnap.data().count;
    const archived = archivedSnap.data().count;

    return {
      draft,
      published,
      archived,
      total: draft + published + archived,
    };
  }, 'getAnnouncementCountByStatus');
}

// ============================================================================
// Export
// ============================================================================

export const announcementService = {
  fetchPublishedAnnouncements,
  fetchAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  incrementViewCount,
  getAnnouncementCountByStatus,
};

export default announcementService;
