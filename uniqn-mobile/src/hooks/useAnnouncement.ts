/**
 * UNIQN Mobile - 공지사항 훅
 *
 * @description TanStack Query 기반 공지사항 데이터 관리
 * @version 1.0.0
 */

import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
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
} from '@/services/announcementService';
import { deleteMultipleAnnouncementImages } from '@/services/storageService';
import { queryKeys, cachingPolicies, invalidateQueries } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { toError, requireAuth } from '@/errors';
import { logger } from '@/utils/logger';
import { stableFilters } from '@/utils/queryUtils';
import { getAnnouncementImages } from '@/types/announcement';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilters,
} from '@/types';

// ============================================================================
// 사용자용 훅
// ============================================================================

/**
 * 발행된 공지사항 목록 조회 (사용자)
 */
export function usePublishedAnnouncements() {
  const profile = useAuthStore((state) => state.profile);
  const userRole = profile?.role ?? null;

  return useInfiniteQuery({
    queryKey: queryKeys.announcements.published({ userRole }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchPublishedAnnouncements(userRole, {
        lastDoc: pageParam as QueryDocumentSnapshot<DocumentData> | undefined,
      });
      return result;
    },
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    staleTime: cachingPolicies.frequent,
  });
}

/**
 * 공지사항 상세 조회
 */
export function useAnnouncementDetail(announcementId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.announcements.detail(announcementId),
    queryFn: () => getAnnouncement(announcementId),
    staleTime: cachingPolicies.standard,
    enabled: enabled && !!announcementId,
  });
}

/**
 * 조회수 증가 (상세 페이지 진입 시 호출)
 */
export function useIncrementViewCount() {
  return useMutation({
    mutationFn: (announcementId: string) => incrementViewCount(announcementId),
    // 조회수 증가는 실패해도 무시
    onError: (error) => {
      logger.warn('조회수 증가 실패', { error });
    },
  });
}

// ============================================================================
// 관리자용 훅
// ============================================================================

/**
 * 전체 공지사항 목록 조회 (관리자)
 */
export function useAllAnnouncements(filters?: AnnouncementFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.announcements.adminList(stableFilters(filters)),
    queryFn: async ({ pageParam }) => {
      const result = await fetchAllAnnouncements({
        filters,
        lastDoc: pageParam as QueryDocumentSnapshot<DocumentData> | undefined,
      });
      return result;
    },
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    staleTime: cachingPolicies.frequent,
  });
}

/**
 * 상태별 공지사항 수 조회 (관리자)
 */
export function useAnnouncementStats() {
  return useQuery({
    queryKey: [...queryKeys.announcements.all, 'stats'],
    queryFn: getAnnouncementCountByStatus,
    staleTime: cachingPolicies.frequent,
  });
}

/**
 * 공지사항 생성 (관리자)
 */
export function useCreateAnnouncement() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      requireAuth(user?.uid, 'useAnnouncement.createAnnouncement');
      const authorName = profile?.name || user.displayName || '관리자';
      return createAnnouncement(user.uid, authorName, input);
    },
    onSuccess: (announcementId) => {
      logger.info('공지사항 생성 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 저장되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 생성 실패', toError(error));
      addToast({ type: 'error', message: '공지사항 저장에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 수정 (관리자)
 * - 삭제된 이미지는 Storage에서도 함께 삭제
 * - 다중 이미지 지원
 */
export function useUpdateAnnouncement() {
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async ({
      announcementId,
      input,
    }: {
      announcementId: string;
      input: UpdateAnnouncementInput;
    }) => {
      // 1. 기존 공지사항 조회
      const existingAnnouncement = await getAnnouncement(announcementId);

      if (existingAnnouncement) {
        // 2. 기존 이미지 목록 가져오기 (다중 이미지 호환)
        const existingImages = getAnnouncementImages(existingAnnouncement);

        // 3. 새 이미지 목록에서 삭제된 이미지 찾기
        const newImageIds = new Set((input.images ?? []).map((img) => img.id));
        const deletedImages = existingImages.filter((img) => !newImageIds.has(img.id));

        // 4. 삭제된 이미지 Storage에서 제거
        if (deletedImages.length > 0) {
          try {
            await deleteMultipleAnnouncementImages(deletedImages);
            logger.info('삭제된 공지사항 이미지 제거 완료', {
              announcementId,
              deletedCount: deletedImages.length,
            });
          } catch (error) {
            // 이미지 삭제 실패해도 수정은 진행
            logger.warn('삭제된 공지사항 이미지 제거 실패', { announcementId, error });
          }
        }
      }

      // 5. 공지사항 문서 수정
      return updateAnnouncement(announcementId, input);
    },
    onSuccess: (_, variables) => {
      logger.info('공지사항 수정 성공', { announcementId: variables.announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 수정되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 수정 실패', toError(error));
      addToast({ type: 'error', message: '공지사항 수정에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 발행 (관리자)
 */
export function usePublishAnnouncement() {
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (announcementId: string) => publishAnnouncement(announcementId),
    onSuccess: (_, announcementId) => {
      logger.info('공지사항 발행 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 발행되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 발행 실패', toError(error));
      addToast({ type: 'error', message: '공지사항 발행에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 보관 (관리자)
 */
export function useArchiveAnnouncement() {
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (announcementId: string) => archiveAnnouncement(announcementId),
    onSuccess: (_, announcementId) => {
      logger.info('공지사항 보관 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 보관되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 보관 실패', toError(error));
      addToast({ type: 'error', message: '공지사항 보관에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 삭제 (관리자)
 * - 첨부된 모든 이미지 Storage에서 함께 삭제
 * - 다중 이미지 지원
 */
export function useDeleteAnnouncement() {
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (announcementId: string) => {
      // 1. 공지사항 조회하여 이미지 목록 확인
      const announcement = await getAnnouncement(announcementId);

      // 2. 모든 이미지 Storage에서 삭제 (다중 이미지 호환)
      if (announcement) {
        const images = getAnnouncementImages(announcement);
        if (images.length > 0) {
          try {
            await deleteMultipleAnnouncementImages(images);
            logger.info('공지사항 이미지 삭제 성공', {
              announcementId,
              imageCount: images.length,
            });
          } catch (error) {
            // 이미지 삭제 실패해도 공지사항 삭제는 진행
            logger.warn('공지사항 이미지 삭제 실패', { announcementId, error });
          }
        }
      }

      // 3. 공지사항 문서 삭제
      return deleteAnnouncement(announcementId);
    },
    onSuccess: (_, announcementId) => {
      logger.info('공지사항 삭제 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 삭제되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 삭제 실패', toError(error));
      addToast({ type: 'error', message: '공지사항 삭제에 실패했습니다' });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

export default {
  // 사용자용
  usePublishedAnnouncements,
  useAnnouncementDetail,
  useIncrementViewCount,
  // 관리자용
  useAllAnnouncements,
  useAnnouncementStats,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  usePublishAnnouncement,
  useArchiveAnnouncement,
  useDeleteAnnouncement,
};
