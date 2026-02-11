/**
 * UNIQN Mobile - Firebase Announcement Repository
 *
 * @description Firebase Firestore 기반 Announcement Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 공지사항 CRUD 작업 캡슐화
 * 3. QueryBuilder 패턴 활용
 */

import {
  collection,
  doc,
  query,
  where,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { QueryBuilder, processPaginatedResultsWithFilter } from '@/utils/firestore';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type {
  Announcement,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/types';
import type { UserRole } from '@/types/common';
import type {
  IAnnouncementRepository,
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
} from '../interfaces/IAnnouncementRepository';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Firestore 문서를 Announcement로 변환
 */
function docToAnnouncement(docSnap: QueryDocumentSnapshot<DocumentData>): Announcement {
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
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Announcement Repository
 */
export class FirebaseAnnouncementRepository implements IAnnouncementRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(announcementId: string): Promise<Announcement | null> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);
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
    } catch (error) {
      logger.error('공지사항 조회 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 조회',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }

  async getPublished(
    userRole: UserRole | null,
    options: FetchAnnouncementsOptions = {}
  ): Promise<FetchAnnouncementsResult> {
    try {
      const { pageSize = 20, lastDoc } = options;

      const q = new QueryBuilder(collection(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS))
        .whereEqual(FIELDS.ANNOUNCEMENT.status, STATUS.ANNOUNCEMENT.PUBLISHED)
        .orderByDesc(FIELDS.ANNOUNCEMENT.isPinned)
        .orderByDesc(FIELDS.ANNOUNCEMENT.priority)
        .orderByDesc(FIELDS.ANNOUNCEMENT.publishedAt)
        .paginate(pageSize, lastDoc)
        .build();

      const snapshot = await getDocs(q);

      const result = processPaginatedResultsWithFilter(
        snapshot.docs,
        pageSize,
        docToAnnouncement,
        (announcement) => {
          const targetAudience = announcement.targetAudience ?? { type: 'all' };
          if (targetAudience.type === 'all') return true;
          if (targetAudience.type === 'roles' && targetAudience.roles && userRole) {
            return targetAudience.roles.includes(userRole);
          }
          return false;
        }
      );

      logger.info('발행된 공지사항 조회 완료', {
        component: 'AnnouncementRepository',
        count: result.items.length,
        userRole,
      });

      return {
        announcements: result.items,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('발행된 공지사항 조회 실패', toError(error), { userRole });
      throw handleServiceError(error, {
        operation: '발행된 공지사항 조회',
        component: 'AnnouncementRepository',
        context: { userRole },
      });
    }
  }

  async getAll(options: FetchAnnouncementsOptions = {}): Promise<FetchAnnouncementsResult> {
    try {
      const { filters, pageSize = 20, lastDoc } = options;

      const q = new QueryBuilder(collection(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS))
        .whereIf(filters?.status && filters.status !== 'all', FIELDS.ANNOUNCEMENT.status, '==', filters?.status)
        .orderByDesc(FIELDS.ANNOUNCEMENT.createdAt)
        .paginate(pageSize, lastDoc)
        .build();

      const snapshot = await getDocs(q);
      const result = processPaginatedResultsWithFilter(snapshot.docs, pageSize, docToAnnouncement);

      logger.info('전체 공지사항 조회 완료', {
        component: 'AnnouncementRepository',
        count: result.items.length,
        filters,
      });

      return {
        announcements: result.items,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('전체 공지사항 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '전체 공지사항 조회',
        component: 'AnnouncementRepository',
      });
    }
  }

  async getCountByStatus(): Promise<AnnouncementCountByStatus> {
    try {
      const db = getFirebaseDb();

      const [draftSnap, publishedSnap, archivedSnap] = await Promise.all([
        getCountFromServer(
          query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where(FIELDS.ANNOUNCEMENT.status, '==', STATUS.ANNOUNCEMENT.DRAFT))
        ),
        getCountFromServer(
          query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where(FIELDS.ANNOUNCEMENT.status, '==', STATUS.ANNOUNCEMENT.PUBLISHED))
        ),
        getCountFromServer(
          query(collection(db, COLLECTIONS.ANNOUNCEMENTS), where(FIELDS.ANNOUNCEMENT.status, '==', STATUS.ANNOUNCEMENT.ARCHIVED))
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
    } catch (error) {
      logger.error('공지사항 통계 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '공지사항 통계 조회',
        component: 'AnnouncementRepository',
      });
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(
    authorId: string,
    authorName: string,
    input: CreateAnnouncementInput
  ): Promise<string> {
    try {
      const announcementData = {
        title: input.title,
        content: input.content,
        category: input.category,
        status: STATUS.ANNOUNCEMENT.DRAFT as AnnouncementStatus,
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

      const docRef = await addDoc(
        collection(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS),
        announcementData
      );

      logger.info('공지사항 생성 완료', {
        component: 'AnnouncementRepository',
        announcementId: docRef.id,
        title: input.title,
        authorId,
      });

      return docRef.id;
    } catch (error) {
      logger.error('공지사항 생성 실패', toError(error), { authorId });
      throw handleServiceError(error, {
        operation: '공지사항 생성',
        component: 'AnnouncementRepository',
        context: { authorId },
      });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async update(announcementId: string, input: UpdateAnnouncementInput): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);

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
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      logger.error('공지사항 수정 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 수정',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }

  async publish(announcementId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);

      await updateDoc(docRef, {
        status: STATUS.ANNOUNCEMENT.PUBLISHED as AnnouncementStatus,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      logger.info('공지사항 발행 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      logger.error('공지사항 발행 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 발행',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }

  async archive(announcementId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);

      await updateDoc(docRef, {
        status: STATUS.ANNOUNCEMENT.ARCHIVED as AnnouncementStatus,
        updatedAt: serverTimestamp(),
      });

      logger.info('공지사항 보관 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      logger.error('공지사항 보관 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 보관',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }

  async incrementViewCount(announcementId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);

      await updateDoc(docRef, {
        viewCount: increment(1),
      });
    } catch (error) {
      logger.error('공지사항 조회수 증가 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 조회수 증가',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async delete(announcementId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.ANNOUNCEMENTS, announcementId);
      await deleteDoc(docRef);

      logger.info('공지사항 삭제 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      logger.error('공지사항 삭제 실패', toError(error), { announcementId });
      throw handleServiceError(error, {
        operation: '공지사항 삭제',
        component: 'AnnouncementRepository',
        context: { announcementId },
      });
    }
  }
}
