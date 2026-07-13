/**
 * UNIQN Mobile - 공고별 협업자 Repository 인터페이스
 *
 * @description Phase 5 (collaborator repository) — CLAUDE.md 아키텍처 규칙
 *              Service → Repository → Supabase. RLS 가 권한 강제.
 * @version 1.0.0
 */

import type {
  JobPostingCollaborator,
  JobPostingCollaboratorWithUser,
  SharedJobPosting,
  CollaboratorSearchCandidate,
} from '@/types/jobPostingCollaborator';

export interface IJobPostingCollaboratorRepository {
  /**
   * 공고의 협업자 목록 (사용자 표시 정보 포함)
   * RLS: workspace 멤버 OR collaborator 본인이 SELECT 가능
   */
  findByJobPostingWithUser(jobPostingId: string): Promise<JobPostingCollaboratorWithUser[]>;

  /**
   * 본인이 협업하는 공고 목록 (출처 워크스페이스 정보 포함)
   * RLS: collaborator 본인만 SELECT
   */
  findSharedJobPostingsForUser(userId: string): Promise<SharedJobPosting[]>;

  /**
   * 협업자 추가 (RLS: workspace owner 만 INSERT)
   * @returns 생성된 row
   * @throws AppError E5 (권한), E3 (자가 추가 / 중복 UNIQUE 충돌)
   */
  add(jobPostingId: string, userId: string, addedBy: string): Promise<JobPostingCollaborator>;

  /**
   * 협업자 제거 (RLS: workspace owner OR collaborator 본인)
   * @throws AppError E5 (권한)
   */
  remove(jobPostingId: string, userId: string): Promise<void>;

  /**
   * 이메일로 사용자 검색 (UNIQN 가입자만)
   * 검색 결과에 status (self/workspace_member/already_collaborator/addable) 부여
   *
   * @param jobPostingId 협업자 추가 대상 공고
   * @param emailQuery 이메일 prefix (≥3자)
   */
  searchByEmail(jobPostingId: string, emailQuery: string): Promise<CollaboratorSearchCandidate[]>;
}
