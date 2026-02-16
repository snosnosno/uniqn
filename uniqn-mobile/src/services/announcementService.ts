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
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { announcementRepository } from '@/repositories';
import type { Announcement, CreateAnnouncementInput, UpdateAnnouncementInput } from '@/types';
import type { UserRole } from '@/types/common';
import type {
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
} from '@/repositories';

const COMPONENT = 'announcementService';

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
  try {
    return await announcementRepository.getPublished(userRole, options);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '발행 공지사항 조회',
      component: COMPONENT,
    });
  }
}

/**
 * 전체 공지사항 목록 조회 (관리자용)
 */
export async function fetchAllAnnouncements(
  options: FetchAnnouncementsOptions = {}
): Promise<FetchAnnouncementsResult> {
  try {
    return await announcementRepository.getAll(options);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전체 공지사항 조회',
      component: COMPONENT,
    });
  }
}

/**
 * 공지사항 상세 조회
 */
export async function getAnnouncement(announcementId: string): Promise<Announcement | null> {
  try {
    return await announcementRepository.getById(announcementId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 상세 조회',
      component: COMPONENT,
      context: { announcementId },
    });
  }
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
  try {
    const id = await announcementRepository.create(authorId, authorName, input);

    logger.info('공지사항 생성 완료', {
      component: COMPONENT,
      announcementId: id,
      title: input.title,
      authorId,
    });

    return id;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 생성',
      component: COMPONENT,
      context: { authorId },
    });
  }
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
  try {
    await announcementRepository.update(announcementId, input);

    logger.info('공지사항 수정 완료', {
      component: COMPONENT,
      announcementId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 수정',
      component: COMPONENT,
      context: { announcementId },
    });
  }
}

/**
 * 공지사항 발행 (관리자)
 */
export async function publishAnnouncement(announcementId: string): Promise<void> {
  try {
    await announcementRepository.publish(announcementId);

    logger.info('공지사항 발행 완료', {
      component: COMPONENT,
      announcementId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 발행',
      component: COMPONENT,
      context: { announcementId },
    });
  }
}

/**
 * 공지사항 보관 (관리자)
 */
export async function archiveAnnouncement(announcementId: string): Promise<void> {
  try {
    await announcementRepository.archive(announcementId);

    logger.info('공지사항 보관 완료', {
      component: COMPONENT,
      announcementId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 보관',
      component: COMPONENT,
      context: { announcementId },
    });
  }
}

/**
 * 공지사항 삭제 (관리자)
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  try {
    await announcementRepository.delete(announcementId);

    logger.info('공지사항 삭제 완료', {
      component: COMPONENT,
      announcementId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공지사항 삭제',
      component: COMPONENT,
      context: { announcementId },
    });
  }
}

// ============================================================================
// View Count
// ============================================================================

/**
 * 조회수 증가 (사용자가 상세 페이지 열람 시)
 */
export async function incrementViewCount(announcementId: string): Promise<void> {
  try {
    await announcementRepository.incrementViewCount(announcementId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '조회수 증가',
      component: COMPONENT,
      context: { announcementId },
    });
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 상태별 공지사항 수 조회 (관리자)
 */
export async function getAnnouncementCountByStatus(): Promise<AnnouncementCountByStatus> {
  try {
    return await announcementRepository.getCountByStatus();
  } catch (error) {
    throw handleServiceError(error, {
      operation: '상태별 공지사항 수 조회',
      component: COMPONENT,
    });
  }
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
