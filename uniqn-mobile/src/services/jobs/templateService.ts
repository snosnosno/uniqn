/**
 * UNIQN Mobile - 공고 템플릿 서비스
 *
 * @description 공고 작성 템플릿 CRUD 서비스 (Repository 패턴 위임)
 * @version 2.0.0
 */

import { templateRepository } from '@/repositories';
import { isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { JobPostingTemplate, CreateTemplateInput, JobPostingFormData } from '@/types';

// ============================================================================
// Template Service
// ============================================================================

/**
 * 사용자의 템플릿 목록 조회
 *
 * @param userId 사용자 ID
 * @returns 템플릿 목록 (최신순)
 */
export async function getTemplates(userId: string): Promise<JobPostingTemplate[]> {
  try {
    return await templateRepository.getTemplates(userId);
  } catch (error) {
    // 권한 에러는 빈 배열 반환 (사용자 경험 개선)
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'permission-denied') {
      return [];
    }
    throw handleServiceError(error, {
      operation: '템플릿 목록 조회',
      component: 'templateService',
      context: { userId },
    });
  }
}

/**
 * 템플릿 저장
 *
 * @param input 템플릿 생성 입력
 * @param userId 사용자 ID
 * @returns 생성된 템플릿 ID
 */
export async function saveTemplate(input: CreateTemplateInput, userId: string): Promise<string> {
  try {
    return await templateRepository.saveTemplate(input, userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '템플릿 저장',
      component: 'templateService',
      context: { userId, name: input.name },
    });
  }
}

/**
 * 템플릿 불러오기
 *
 * @description 사용 통계 업데이트 포함
 * @param templateId 템플릿 ID
 * @returns 템플릿 데이터
 */
export async function loadTemplate(templateId: string): Promise<JobPostingTemplate> {
  try {
    return await templateRepository.loadTemplate(templateId);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '템플릿 불러오기',
      component: 'templateService',
      context: { templateId },
    });
  }
}

/**
 * 템플릿 삭제
 *
 * @param templateId 템플릿 ID
 * @param userId 사용자 ID (권한 확인용)
 */
export async function deleteTemplate(templateId: string, userId: string): Promise<void> {
  try {
    await templateRepository.deleteTemplate(templateId, userId);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '템플릿 삭제',
      component: 'templateService',
      context: { templateId, userId },
    });
  }
}

/**
 * 템플릿 업데이트
 *
 * @param templateId 템플릿 ID
 * @param input 업데이트할 데이터
 * @param userId 사용자 ID (권한 확인용)
 */
export async function updateTemplate(
  templateId: string,
  input: Partial<
    Pick<CreateTemplateInput, 'name' | 'description'> & { formData?: JobPostingFormData }
  >,
  userId: string
): Promise<void> {
  try {
    await templateRepository.updateTemplate(templateId, input, userId);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '템플릿 업데이트',
      component: 'templateService',
      context: { templateId, userId },
    });
  }
}
