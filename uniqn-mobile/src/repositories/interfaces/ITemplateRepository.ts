/**
 * UNIQN Mobile - Template Repository Interface
 *
 * @description 공고 템플릿 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 템플릿 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { JobPostingTemplate, CreateTemplateInput, JobPostingFormData } from '@/types';

// ============================================================================
// Interface
// ============================================================================

/**
 * Template Repository 인터페이스
 *
 * 구현체:
 * - FirebaseTemplateRepository (프로덕션)
 * - MockTemplateRepository (테스트)
 */
export interface ITemplateRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * 사용자의 템플릿 목록 조회
   * @param userId - 사용자 ID
   * @returns 템플릿 목록 (최신순)
   */
  getTemplates(userId: string): Promise<JobPostingTemplate[]>;

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  /**
   * 템플릿 저장
   * @param input - 템플릿 생성 입력
   * @param userId - 사용자 ID
   * @returns 생성된 템플릿 ID
   */
  saveTemplate(input: CreateTemplateInput, userId: string): Promise<string>;

  // ==========================================================================
  // 조회 + 통계 (Read + Stats)
  // ==========================================================================

  /**
   * 템플릿 불러오기 (사용 통계 업데이트 포함)
   * @param templateId - 템플릿 ID
   * @returns 템플릿 데이터
   */
  loadTemplate(templateId: string): Promise<JobPostingTemplate>;

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  /**
   * 템플릿 삭제
   * @param templateId - 템플릿 ID
   * @param userId - 사용자 ID (권한 확인용)
   */
  deleteTemplate(templateId: string, userId: string): Promise<void>;

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  /**
   * 템플릿 업데이트
   * @param templateId - 템플릿 ID
   * @param input - 업데이트할 데이터
   * @param userId - 사용자 ID (권한 확인용)
   */
  updateTemplate(
    templateId: string,
    input: Partial<
      Pick<CreateTemplateInput, 'name' | 'description'> & { formData?: JobPostingFormData }
    >,
    userId: string
  ): Promise<void>;
}
