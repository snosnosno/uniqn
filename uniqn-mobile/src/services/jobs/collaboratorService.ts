/**
 * UNIQN Mobile - 공고별 협업자 Service
 *
 * @description 공고 단위 협업자 권한 비즈니스 로직 (Phase 5)
 *              - CLAUDE.md 아키텍처: Presentation → Hooks → Service → Repository → Supabase
 *              - 검증 → Repository 호출 → 알림은 DB trigger 가 자동 (Phase 3)
 * @version 1.0.0
 */

import { jobPostingCollaboratorRepository } from '@/repositories/supabase/JobPostingCollaboratorRepository';
import {
  addCollaboratorSchema,
  searchCollaboratorCandidateSchema,
  removeCollaboratorSchema,
} from '@/schemas/jobPostingCollaborator.schema';
import { ValidationError, AuthError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import { supabase } from '@/lib/supabase';
import type {
  JobPostingCollaborator,
  JobPostingCollaboratorWithUser,
  SharedJobPosting,
  CollaboratorSearchCandidate,
} from '@/types/jobPostingCollaborator';

function validateOrThrow<T>(
  parsed: { success: boolean; data?: T; error?: { issues: { message: string }[] } },
  fallback = '입력값을 확인해주세요'
): T {
  if (!parsed.success) {
    const message = parsed.error?.issues[0]?.message ?? fallback;
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { userMessage: message });
  }
  return parsed.data as T;
}

async function getCurrentUserIdOrThrow(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      userMessage: '로그인이 필요합니다',
    });
  }
  return user.id;
}

export const collaboratorService = {
  /**
   * 공고의 협업자 목록 (사용자 표시 정보 포함)
   */
  async listForJobPosting(jobPostingId: string): Promise<JobPostingCollaboratorWithUser[]> {
    return jobPostingCollaboratorRepository.findByJobPostingWithUser(jobPostingId);
  },

  /**
   * 본인이 협업하는 공고 목록 (공유받은 공고 섹션용)
   */
  async listSharedJobPostings(): Promise<SharedJobPosting[]> {
    const userId = await getCurrentUserIdOrThrow();
    return jobPostingCollaboratorRepository.findSharedJobPostingsForUser(userId);
  },

  /**
   * 닉네임으로 사용자 검색 (workspace owner 가 협업자 추가 시)
   */
  async searchCandidates(input: {
    jobPostingId: string;
    nicknameQuery: string;
  }): Promise<CollaboratorSearchCandidate[]> {
    const parsed = searchCollaboratorCandidateSchema.safeParse(input);
    const data = validateOrThrow(parsed);
    return jobPostingCollaboratorRepository.searchByNickname(data.jobPostingId, data.nicknameQuery);
  },

  /**
   * 협업자 추가 (workspace owner 만 — RLS 가 강제)
   * 알림은 DB trigger (notify_on_collaborator_added) 가 자동 발송
   */
  async add(input: { jobPostingId: string; userId: string }): Promise<JobPostingCollaborator> {
    const parsed = addCollaboratorSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    const currentUserId = await getCurrentUserIdOrThrow();
    if (currentUserId === data.userId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '본인은 협업자로 추가할 수 없습니다',
      });
    }

    logger.info('협업자 추가 (Service)', data);
    return jobPostingCollaboratorRepository.add(data.jobPostingId, data.userId, currentUserId);
  },

  /**
   * 협업자 제거 (workspace owner 또는 본인 — RLS 가 강제)
   * 알림은 DB trigger (notify_on_collaborator_removed) 가 자동 발송 (본인 제거 시 skip)
   */
  async remove(input: { jobPostingId: string; userId: string }): Promise<void> {
    const parsed = removeCollaboratorSchema.safeParse(input);
    const data = validateOrThrow(parsed);

    logger.info('협업자 제거 (Service)', data);
    return jobPostingCollaboratorRepository.remove(data.jobPostingId, data.userId);
  },

  /**
   * collaborator 본인 나가기 (편의 메서드)
   */
  async leaveSelf(jobPostingId: string): Promise<void> {
    const userId = await getCurrentUserIdOrThrow();
    logger.info('협업자 자가 제거', { jobPostingId, userId });
    return jobPostingCollaboratorRepository.remove(jobPostingId, userId);
  },
};
