/**
 * UNIQN Mobile - Announcement Service
 *
 * @description 공지사항 관리 서비스 (Repository 패턴)
 * @version 2.0.0 - Repository 패턴 적용
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Firebase
 */

import { logger } from '@/utils/logger';
import { withErrorHandling } from '@/utils/withErrorHandling';
import { announcementRepository } from '@/repositories';
import type { Announcement, CreateAnnouncementInput, UpdateAnnouncementInput } from '@/types';
import type { UserRole } from '@/types/common';
import type {
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
} from '@/repositories';

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
    return announcementRepository.getPublished(userRole, options);
  }, 'fetchPublishedAnnouncements');
}

/**
 * 전체 공지사항 목록 조회 (관리자용)
 */
export async function fetchAllAnnouncements(
  options: FetchAnnouncementsOptions = {}
): Promise<FetchAnnouncementsResult> {
  return withErrorHandling(async () => {
    return announcementRepository.getAll(options);
  }, 'fetchAllAnnouncements');
}

/**
 * 공지사항 상세 조회
 */
export async function getAnnouncement(announcementId: string): Promise<Announcement | null> {
  return withErrorHandling(async () => {
    return announcementRepository.getById(announcementId);
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
    const id = await announcementRepository.create(authorId, authorName, input);

    logger.info('공지사항 생성 완료', {
      component: 'announcementService',
      announcementId: id,
      title: input.title,
      authorId,
    });

    return id;
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
    await announcementRepository.update(announcementId, input);

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
    await announcementRepository.publish(announcementId);

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
    await announcementRepository.archive(announcementId);

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
    await announcementRepository.delete(announcementId);

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
    await announcementRepository.incrementViewCount(announcementId);
  }, 'incrementViewCount');
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 상태별 공지사항 수 조회 (관리자)
 */
export async function getAnnouncementCountByStatus(): Promise<AnnouncementCountByStatus> {
  return withErrorHandling(async () => {
    return announcementRepository.getCountByStatus();
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
