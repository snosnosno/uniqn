/**
 * UNIQN Mobile - Inquiry Service
 *
 * @description 문의 관리 서비스 (Repository 패턴)
 * @version 2.0.0 - Repository 패턴 전환
 *
 * 아키텍처:
 * Service Layer → Repository Layer → Firebase
 */

import { logger } from '@/utils/logger';
import { ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { inquiryRepository } from '@/repositories';
import { requireCurrentUser } from './authService';
import { createInquirySchema, respondInquirySchema } from '@/schemas';
import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
} from '@/types';
import type { InquiryPaginationCursor } from '@/repositories';

// ============================================================================
// Constants
// ============================================================================

const COMPONENT = 'inquiryService';

// ============================================================================
// Types (하위 호환용)
// ============================================================================

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
    const { userId, pageSize, lastDoc: cursor } = options;

    if (!userId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        field: 'userId',
        userMessage: '사용자 ID가 필요합니다',
      });
    }

    const result = await inquiryRepository.getByUserId(userId, {
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

/**
 * 전체 문의 목록 조회 (관리자)
 */
export async function fetchAllInquiries(
  options: FetchInquiriesOptions
): Promise<FetchInquiriesResult> {
  try {
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

/**
 * 문의 상세 조회
 */
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
  requireCurrentUser();
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
    const id = await inquiryRepository.create({ userId, userEmail, userName }, validated);

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
  requireCurrentUser();
  const validationResult = respondInquirySchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }
  try {
    await inquiryRepository.respond(inquiryId, responderId, responderName, validationResult.data);

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
export async function updateInquiryStatus(
  inquiryId: string,
  status: InquiryStatus
): Promise<void> {
  requireCurrentUser();
  try {
    await inquiryRepository.updateStatus(inquiryId, status);

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
    return await inquiryRepository.getUnansweredCount();
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
