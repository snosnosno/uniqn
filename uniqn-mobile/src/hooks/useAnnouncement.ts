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
import { queryKeys, cachingPolicies, invalidateQueries } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
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
    queryKey: queryKeys.announcements.adminList(filters as Record<string, unknown> | undefined),
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
      if (!user?.uid) {
        throw new Error('로그인이 필요합니다');
      }
      const authorName = profile?.name || user.displayName || '관리자';
      return createAnnouncement(user.uid, authorName, input);
    },
    onSuccess: (announcementId) => {
      logger.info('공지사항 생성 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 저장되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 생성 실패', error as Error);
      addToast({ type: 'error', message: '공지사항 저장에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 수정 (관리자)
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
      return updateAnnouncement(announcementId, input);
    },
    onSuccess: (_, variables) => {
      logger.info('공지사항 수정 성공', { announcementId: variables.announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 수정되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 수정 실패', error as Error);
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
      logger.error('공지사항 발행 실패', error as Error);
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
      logger.error('공지사항 보관 실패', error as Error);
      addToast({ type: 'error', message: '공지사항 보관에 실패했습니다' });
    },
  });
}

/**
 * 공지사항 삭제 (관리자)
 */
export function useDeleteAnnouncement() {
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (announcementId: string) => deleteAnnouncement(announcementId),
    onSuccess: (_, announcementId) => {
      logger.info('공지사항 삭제 성공', { announcementId });
      invalidateQueries.announcements();
      addToast({ type: 'success', message: '공지사항이 삭제되었습니다' });
    },
    onError: (error) => {
      logger.error('공지사항 삭제 실패', error as Error);
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
