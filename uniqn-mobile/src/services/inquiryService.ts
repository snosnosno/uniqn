/**
 * UNIQN Mobile - Inquiry Service
 *
 * @description 문의 관리 서비스 (Repository pattern)
 */

import { logger } from '@/utils/logger';
import { ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { inquiryRepository } from '@/repositories';
import { requireAdminUser, requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import { createInquirySchema, respondInquirySchema, attachInquiryFilesSchema } from '@/schemas';
import { INQUIRY_ATTACHMENT_LIMITS } from '@/types';
import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
  InquiryAttachment,
  LocalInquiryAttachment,
} from '@/types';
import type { InquiryPaginationCursor } from '@/repositories';

const COMPONENT = 'inquiryService';

interface FetchInquiriesOptions {
  userId?: string;
  filters?: InquiryFilters;
  pageSize?: number;
  lastDoc?: InquiryPaginationCursor;
}

interface FetchInquiriesResult {
  inquiries: Inquiry[];
  lastDoc: InquiryPaginationCursor | null;
  hasMore: boolean;
}

export async function fetchMyInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  try {
    const { userId, pageSize, lastDoc: cursor } = options;

    if (!userId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        field: 'userId',
        userMessage: '사용자 ID가 필요합니다.',
      });
    }

    const currentUser = await requireMatchingCurrentUser(userId);
    const result = await inquiryRepository.getByUserId(currentUser.id, {
      pageSize,
      cursor,
    });

    return {
      inquiries: result.inquiries,
      lastDoc: result.nextCursor,
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

export async function fetchAllInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  try {
    await requireAdminUser();
    const { filters, pageSize, lastDoc: cursor } = options;
    const result = await inquiryRepository.getAll({
      filters,
      pageSize,
      cursor,
    });

    return {
      inquiries: result.inquiries,
      lastDoc: result.nextCursor,
      hasMore: result.hasMore,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전체 문의 목록 조회',
      component: COMPONENT,
    });
  }
}

export async function getInquiry(inquiryId: string): Promise<Inquiry | null> {
  try {
    return await inquiryRepository.getById(inquiryId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 상세 조회',
      component: COMPONENT,
      context: { inquiryId },
    });
  }
}

export async function createInquiry(
  userId: string,
  userEmail: string,
  userName: string,
  input: CreateInquiryInput
): Promise<string> {
  const currentUser = await requireMatchingCurrentUser(userId);
  const validationResult = createInquirySchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }

  try {
    const validated = validationResult.data;
    const id = await inquiryRepository.create(
      { userId: currentUser.id, userEmail, userName },
      validated
    );

    logger.info('문의 생성 완료', {
      component: COMPONENT,
      inquiryId: id,
      category: input.category,
    });

    return id;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 생성',
      component: COMPONENT,
      context: { userId: currentUser.id, category: input.category },
    });
  }
}

export async function respondToInquiry(
  inquiryId: string,
  responderId: string,
  responderName: string,
  input: RespondInquiryInput
): Promise<void> {
  const admin = await requireAdminUser(responderId);
  const validationResult = respondInquirySchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }

  try {
    await inquiryRepository.respond(inquiryId, admin.id, responderName, validationResult.data);

    logger.info('문의 응답 완료', {
      component: COMPONENT,
      inquiryId,
      responderId: admin.id,
      status: input.status,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 응답',
      component: COMPONENT,
      context: { inquiryId, responderId: admin.id },
    });
  }
}

export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
  const admin = await requireAdminUser();
  try {
    await inquiryRepository.updateStatus(inquiryId, status);

    logger.info('문의 상태 변경 완료', {
      component: COMPONENT,
      inquiryId,
      status,
      adminId: admin.id,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 상태 변경',
      component: COMPONENT,
      context: { inquiryId, status },
    });
  }
}

export async function getUnansweredCount(): Promise<number> {
  try {
    await requireAdminUser();
    return await inquiryRepository.getUnansweredCount();
  } catch (error) {
    throw handleServiceError(error, {
      operation: '미답변 문의 수 조회',
      component: COMPONENT,
    });
  }
}

/**
 * 첨부파일을 문의에 추가 (전체 롤백 지원)
 *
 * 흐름:
 * 1. 로컬 파일 Zod 검증 (MIME / 크기 / 개수)
 * 2. 기존 attachments 로드 후 합산이 3개 초과면 reject (동시성 방어)
 * 3. Storage 순차 업로드 (실패 시 Repository가 이미 업로드한 파일 rollback)
 * 4. DB attachments JSONB 갱신 — 실패 시 방금 업로드한 Storage 파일 수동 rollback
 */
export async function attachFilesToInquiry(
  userId: string,
  inquiryId: string,
  files: LocalInquiryAttachment[]
): Promise<InquiryAttachment[]> {
  const currentUser = await requireMatchingCurrentUser(userId);

  const validationResult = attachInquiryFilesSchema.safeParse({ inquiryId, files });
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '첨부파일을 확인해주세요.',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }

  const inquiry = await inquiryRepository.getById(inquiryId);
  if (!inquiry || inquiry.userId !== currentUser.id) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '해당 문의를 찾을 수 없습니다.',
      field: 'inquiryId',
    });
  }

  const existing = inquiry.attachments ?? [];
  if (existing.length + files.length > INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
      userMessage: `이미지는 최대 ${INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT}장까지 첨부 가능합니다.`,
      field: 'files',
    });
  }

  let uploadedNow: InquiryAttachment[] = [];
  try {
    uploadedNow = await inquiryRepository.uploadAttachments(currentUser.id, inquiryId, files);

    try {
      await inquiryRepository.updateAttachments(inquiryId, [...existing, ...uploadedNow]);
    } catch (dbError) {
      // DB 갱신 실패 — 방금 업로드한 Storage 파일 롤백
      logger.warn('inquiry.attach.db_failed_rollback_storage', {
        component: COMPONENT,
        inquiryId,
        count: uploadedNow.length,
      });
      try {
        await inquiryRepository.removeAttachmentsFromStorage(uploadedNow.map((a) => a.path));
      } catch (rollbackError) {
        logger.error('inquiry.attach.storage_rollback_failed', {
          component: COMPONENT,
          inquiryId,
          rollbackError,
        });
      }
      throw dbError;
    }

    logger.info('inquiry.attach.success', {
      component: COMPONENT,
      inquiryId,
      count: uploadedNow.length,
    });

    return uploadedNow;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 첨부파일 추가',
      component: COMPONENT,
      context: { userId: currentUser.id, inquiryId, count: files.length },
    });
  }
}

/**
 * 문의 삭제 (본인 + status=open 만 허용)
 *
 * 용도:
 * - 전체 롤백: 첨부 실패 시 방금 생성한 문의를 원자적으로 제거
 * - 사용자 명시적 삭제: open 상태에서 철회
 *
 * 관련 첨부 Storage 파일도 함께 제거 (best-effort).
 */
export async function deleteMyInquiry(userId: string, inquiryId: string): Promise<void> {
  const currentUser = await requireMatchingCurrentUser(userId);

  try {
    const inquiry = await inquiryRepository.getById(inquiryId);
    if (!inquiry) {
      return; // 이미 없음, 멱등
    }
    if (inquiry.userId !== currentUser.id) {
      throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
        userMessage: '본인의 문의만 삭제할 수 있습니다.',
      });
    }
    if (inquiry.status !== 'open') {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '답변이 시작된 문의는 삭제할 수 없습니다.',
      });
    }

    // 1. 문의 레코드 삭제 (RLS: inquiries_delete_own 재검증)
    await inquiryRepository.deleteInquiry(inquiryId, currentUser.id);

    // 2. Storage 첨부 정리 (best-effort — 실패해도 레코드는 이미 삭제됨)
    const paths = (inquiry.attachments ?? []).map((a) => a.path);
    if (paths.length > 0) {
      try {
        await inquiryRepository.removeAttachmentsFromStorage(paths);
      } catch (cleanupError) {
        logger.error('inquiry.delete.storage_cleanup_failed', {
          component: COMPONENT,
          inquiryId,
          paths,
          cleanupError,
        });
      }
    }

    logger.info('inquiry.deleted', {
      component: COMPONENT,
      inquiryId,
      userId: currentUser.id,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '문의 삭제',
      component: COMPONENT,
      context: { userId: currentUser.id, inquiryId },
    });
  }
}

/**
 * 첨부파일 signed URL 발급 (조회 화면에서 사용)
 */
export async function getInquiryAttachmentSignedUrl(path: string): Promise<string> {
  try {
    return await inquiryRepository.getSignedAttachmentUrl(path);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '첨부파일 URL 발급',
      component: COMPONENT,
      context: { path },
    });
  }
}

export const inquiryService = {
  fetchMyInquiries,
  fetchAllInquiries,
  getInquiry,
  createInquiry,
  respondToInquiry,
  updateInquiryStatus,
  getUnansweredCount,
  attachFilesToInquiry,
  deleteMyInquiry,
  getInquiryAttachmentSignedUrl,
};
