/**
 * 시스템 공지사항 관리 Hook
 *
 * @description
 * Firestore 시스템 공지사항 컬렉션을 실시간으로 구독하고 관리하는 Hook
 * - 페이지네이션 지원
 * - 이미지 업로드 지원
 * - XSS 검증 통합
 *
 * @version 2.0.0
 * @since 2025-12-10
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  getCountFromServer,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';

import { db, storage } from '../firebase';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './useToast';
import { extractNameFromDisplayName } from '../utils/userUtils';
import {
  validateCreateAnnouncement,
  validateUpdateAnnouncement,
} from '../schemas/announcement.schema';
import type {
  SystemAnnouncement,
  CreateSystemAnnouncementInput,
  UpdateSystemAnnouncementInput,
  SystemAnnouncementFilter,
  AnnouncementPaginationState,
} from '../types';

/** 페이지당 항목 수 */
const PAGE_SIZE = 10;

/** 이미지 최대 크기 (5MB) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 허용 이미지 타입 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export interface UseSystemAnnouncementsReturn {
  // 데이터
  announcements: SystemAnnouncement[];
  bannerAnnouncements: SystemAnnouncement[];
  totalCount: number;

  // 페이지네이션
  pagination: AnnouncementPaginationState;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // 상태
  loading: boolean;
  error: Error | null;

  // 액션
  createAnnouncement: (input: CreateSystemAnnouncementInput) => Promise<string>;
  updateAnnouncement: (id: string, input: UpdateSystemAnnouncementInput) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  incrementViewCount: (id: string) => Promise<void>;

  // 이미지
  uploadImage: (file: File) => Promise<{ url: string; path: string }>;
  deleteImage: (storagePath: string) => Promise<void>;
  uploadProgress: number;

  // 필터
  filter: SystemAnnouncementFilter;
  setFilter: (filter: SystemAnnouncementFilter) => void;

  // 리프레시
  refresh: () => void;
}

/**
 * 시스템 공지사항 Hook
 */
export const useSystemAnnouncements = (
  initialFilter?: SystemAnnouncementFilter
): UseSystemAnnouncementsReturn => {
  const { currentUser, role } = useAuth();
  const { showSuccess, showError } = useToast();

  // 상태
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<SystemAnnouncementFilter>(
    initialFilter || { activeOnly: true }
  );

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData, DocumentData> | null>(null);
  const pageDocsRef = useRef<Map<number, QueryDocumentSnapshot<DocumentData, DocumentData>>>(
    new Map()
  );

  // 구독 해제 ref
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  /**
   * 페이지네이션 상태 계산
   */
  const pagination = useMemo((): AnnouncementPaginationState => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    return {
      currentPage,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }, [currentPage, totalCount]);

  /**
   * 배너용 공지사항 필터링
   */
  const bannerAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter((announcement) => {
      if (!announcement.showAsBanner || !announcement.isActive) return false;

      const startDate =
        announcement.startDate instanceof Date
          ? announcement.startDate
          : (announcement.startDate?.toDate?.() ?? new Date());
      const endDate = announcement.endDate
        ? announcement.endDate instanceof Date
          ? announcement.endDate
          : announcement.endDate?.toDate?.()
        : null;

      if (startDate > now) return false;
      if (endDate && endDate < now) return false;

      return true;
    });
  }, [announcements]);

  /**
   * 전체 개수 조회
   */
  const fetchTotalCount = useCallback(async () => {
    if (!currentUser) return;

    try {
      const announcementsRef = collection(db, 'systemAnnouncements');
      let q = query(announcementsRef);

      if (filter.activeOnly) {
        q = query(q, where('isActive', '==', true));
      }

      const snapshot = await getCountFromServer(q);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      logger.error('공지사항 개수 조회 실패', err instanceof Error ? err : new Error(String(err)), {
        component: 'useSystemAnnouncements',
      });
    }
  }, [currentUser, filter.activeOnly]);

  /**
   * 공지사항 구독
   */
  const subscribeToAnnouncements = useCallback(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // 기존 구독 해제
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);
    setError(null);

    const announcementsRef = collection(db, 'systemAnnouncements');
    let q = query(announcementsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    if (filter.activeOnly) {
      q = query(
        announcementsRef,
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
    }

    // 페이지네이션 커서 적용
    if (currentPage > 1) {
      const cursorDoc = pageDocsRef.current.get(currentPage - 1);
      if (cursorDoc) {
        q = query(q, startAfter(cursorDoc));
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SystemAnnouncement[];

        // 현재 페이지의 마지막 문서 저장
        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          if (lastDoc) {
            lastDocRef.current = lastDoc;
            pageDocsRef.current.set(currentPage, lastDoc);
          }
        }

        // 날짜 필터 적용 (클라이언트 사이드)
        const now = new Date();
        const filteredData = filter.activeOnly
          ? data.filter((announcement) => {
              const startDate =
                announcement.startDate instanceof Date
                  ? announcement.startDate
                  : (announcement.startDate?.toDate?.() ?? new Date());
              const endDate = announcement.endDate
                ? announcement.endDate instanceof Date
                  ? announcement.endDate
                  : announcement.endDate?.toDate?.()
                : null;

              if (startDate > now) return false;
              if (endDate && endDate < now) return false;

              return true;
            })
          : data;

        setAnnouncements(filteredData);
        setLoading(false);

        logger.info('공지사항 구독 성공', {
          component: 'useSystemAnnouncements',
          data: { count: filteredData.length, page: currentPage },
        });
      },
      (err) => {
        logger.error('공지사항 구독 실패', err, {
          component: 'useSystemAnnouncements',
        });
        setError(err);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, [currentUser, filter.activeOnly, currentPage]);

  /**
   * 초기 로드 및 필터 변경 시 재구독
   */
  useEffect(() => {
    fetchTotalCount();
    subscribeToAnnouncements();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [fetchTotalCount, subscribeToAnnouncements]);

  /**
   * 페이지 이동
   */
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, page));
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  /**
   * 리프레시
   */
  const refresh = useCallback(() => {
    setCurrentPage(1);
    pageDocsRef.current.clear();
    fetchTotalCount();
    subscribeToAnnouncements();
  }, [fetchTotalCount, subscribeToAnnouncements]);

  /**
   * 이미지 업로드
   */
  const uploadImage = useCallback(
    async (file: File): Promise<{ url: string; path: string }> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 파일 검증
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('지원하지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WebP만 가능)');
      }

      if (file.size > MAX_IMAGE_SIZE) {
        throw new Error('이미지 크기는 5MB 이하만 가능합니다.');
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `announcements/${currentUser.uid}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      return new Promise((resolve, reject) => {
        const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            logger.error('이미지 업로드 실패', error, {
              component: 'useSystemAnnouncements',
            });
            setUploadProgress(0);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress(0);
              resolve({ url, path: storagePath });
            } catch (error) {
              setUploadProgress(0);
              reject(error);
            }
          }
        );
      });
    },
    [currentUser]
  );

  /**
   * 이미지 삭제
   */
  const deleteImage = useCallback(async (storagePath: string): Promise<void> => {
    if (!storagePath) return;

    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);

      logger.info('이미지 삭제 완료', {
        component: 'useSystemAnnouncements',
        data: { path: storagePath },
      });
    } catch (err) {
      logger.error('이미지 삭제 실패', err instanceof Error ? err : new Error(String(err)), {
        component: 'useSystemAnnouncements',
      });
    }
  }, []);

  /**
   * 공지사항 생성
   */
  const createAnnouncement = useCallback(
    async (input: CreateSystemAnnouncementInput): Promise<string> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      if (role !== 'admin') {
        throw new Error('관리자만 공지사항을 작성할 수 있습니다.');
      }

      // Zod 검증
      const validation = validateCreateAnnouncement({
        ...input,
        showAsBanner: input.showAsBanner ?? false,
      });

      if (!validation.success) {
        const errorMessage = validation.errors[0] || '입력값이 올바르지 않습니다.';
        showError(errorMessage);
        throw new Error(errorMessage);
      }

      try {
        const announcementsRef = collection(db, 'systemAnnouncements');
        const docRef = await addDoc(announcementsRef, {
          title: input.title.trim(),
          content: input.content.trim(),
          priority: input.priority,
          startDate: Timestamp.fromDate(input.startDate),
          endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
          createdBy: currentUser.uid,
          createdByName:
            extractNameFromDisplayName(currentUser.displayName) || currentUser.email || '관리자',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true,
          viewCount: 0,
          showAsBanner: input.showAsBanner ?? false,
          imageUrl: input.imageUrl || null,
          imageStoragePath: input.imageStoragePath || null,
        });

        logger.info('공지사항 생성 완료', {
          component: 'useSystemAnnouncements',
          data: { id: docRef.id, title: input.title },
        });

        showSuccess('공지사항이 등록되었습니다.');
        refresh();
        return docRef.id;
      } catch (err) {
        logger.error('공지사항 생성 실패', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements',
        });
        showError('공지사항 등록에 실패했습니다.');
        throw err;
      }
    },
    [currentUser, role, showSuccess, showError, refresh]
  );

  /**
   * 공지사항 수정
   */
  const updateAnnouncement = useCallback(
    async (id: string, input: UpdateSystemAnnouncementInput): Promise<void> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      if (role !== 'admin') {
        throw new Error('관리자만 공지사항을 수정할 수 있습니다.');
      }

      // Zod 검증
      const validation = validateUpdateAnnouncement(input);

      if (!validation.success) {
        const errorMessage = validation.errors[0] || '입력값이 올바르지 않습니다.';
        showError(errorMessage);
        throw new Error(errorMessage);
      }

      try {
        const announcementRef = doc(db, 'systemAnnouncements', id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: { [key: string]: any } = {
          updatedAt: serverTimestamp(),
        };

        if (input.title !== undefined) updateData.title = input.title.trim();
        if (input.content !== undefined) updateData.content = input.content.trim();
        if (input.priority !== undefined) updateData.priority = input.priority;
        if (input.startDate !== undefined) {
          updateData.startDate = Timestamp.fromDate(input.startDate);
        }
        if (input.endDate !== undefined) {
          updateData.endDate = input.endDate ? Timestamp.fromDate(input.endDate) : null;
        }
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.showAsBanner !== undefined) updateData.showAsBanner = input.showAsBanner;
        if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl || null;
        if (input.imageStoragePath !== undefined) {
          updateData.imageStoragePath = input.imageStoragePath || null;
        }

        await updateDoc(announcementRef, updateData);

        logger.info('공지사항 수정 완료', {
          component: 'useSystemAnnouncements',
          data: { id },
        });

        showSuccess('공지사항이 수정되었습니다.');
      } catch (err) {
        logger.error('공지사항 수정 실패', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements',
        });
        showError('공지사항 수정에 실패했습니다.');
        throw err;
      }
    },
    [currentUser, role, showSuccess, showError]
  );

  /**
   * 공지사항 삭제
   */
  const deleteAnnouncement = useCallback(
    async (id: string): Promise<void> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      if (role !== 'admin') {
        throw new Error('관리자만 공지사항을 삭제할 수 있습니다.');
      }

      try {
        // 이미지가 있으면 함께 삭제
        const announcement = announcements.find((a) => a.id === id);
        if (announcement?.imageStoragePath) {
          await deleteImage(announcement.imageStoragePath);
        }

        const announcementRef = doc(db, 'systemAnnouncements', id);
        await deleteDoc(announcementRef);

        logger.info('공지사항 삭제 완료', {
          component: 'useSystemAnnouncements',
          data: { id },
        });

        showSuccess('공지사항이 삭제되었습니다.');
        refresh();
      } catch (err) {
        logger.error('공지사항 삭제 실패', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements',
        });
        showError('공지사항 삭제에 실패했습니다.');
        throw err;
      }
    },
    [currentUser, role, announcements, deleteImage, showSuccess, showError, refresh]
  );

  /**
   * 조회수 증가
   */
  const incrementViewCount = useCallback(async (id: string): Promise<void> => {
    try {
      const announcementRef = doc(db, 'systemAnnouncements', id);
      await updateDoc(announcementRef, {
        viewCount: increment(1),
      });

      logger.info('조회수 증가', {
        component: 'useSystemAnnouncements',
        data: { id },
      });
    } catch (err) {
      logger.error('조회수 증가 실패', err instanceof Error ? err : new Error(String(err)), {
        component: 'useSystemAnnouncements',
      });
    }
  }, []);

  return {
    announcements,
    bannerAnnouncements,
    totalCount,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    loading,
    error,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    incrementViewCount,
    uploadImage,
    deleteImage,
    uploadProgress,
    filter,
    setFilter,
    refresh,
  };
};
