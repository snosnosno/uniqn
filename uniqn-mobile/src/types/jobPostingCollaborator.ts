/**
 * UNIQN Mobile - 공고별 협업자 도메인 타입
 *
 * @description 공고 단위 협업자 권한 (workspace editor 와 별개의 입자)
 *              camelCase 도메인 / snake_case DB 분리 (memory: supabase-patterns #1)
 * @version 1.0.0
 */

/**
 * 공고별 협업자 — D1 OR 평가, D2 풀 관리권
 */
/**
 * 협업자 권한 2단 (S3-4).
 *
 * 🔒 이 값은 **표시용이 아니라 실제 게이트**다. 서버 RLS 와 쓰기 RPC 14종이
 *    `is_posting_collaborator()`(= manager 전용)로 판정한다 — 화면에서 감추는 것과 무관하게
 *    viewer 의 쓰기는 서버에서 막힌다. 화면 분기는 어디까지나 "헛수고를 줄이는" 용도다.
 */
export type JobPostingCollaboratorRole = 'manager' | 'viewer';

export const JOB_POSTING_COLLABORATOR_ROLE_LABELS: Record<JobPostingCollaboratorRole, string> = {
  manager: '관리',
  viewer: '보기 전용',
};

export interface JobPostingCollaborator {
  id: string;
  jobPostingId: string;
  userId: string;
  addedBy: string;
  /** ISO 8601 (timestamptz) */
  addedAt: string;
  /** 권한 2단 (S3-4). 기존 행·신규 기본값은 모두 `manager`. */
  role: JobPostingCollaboratorRole;
}

/**
 * 협업자 + 사용자 표시 정보 결합 (UI 리스트용)
 */
export interface JobPostingCollaboratorWithUser extends JobPostingCollaborator {
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
}

/**
 * 공유받은 공고 (collaborator 본인 시점) — 출처 워크스페이스 정보 포함
 */
export interface SharedJobPosting {
  jobPostingId: string;
  jobPostingTitle: string;
  workspaceId: string;
  workspaceName: string;
  addedAt: string;
}

/**
 * 협업자 추가 시 검색 결과 항목
 */
export interface CollaboratorSearchCandidate {
  userId: string;
  displayName: string | null;
  photoUrl: string | null;
  /** 자기 자신 / workspace 이미 멤버 / 이미 collaborator / 추가 가능 */
  status: 'self' | 'workspace_member' | 'already_collaborator' | 'addable';
}

export const COLLABORATOR_LIMITS = {
  /** MVP cap 없음 — abuse 모니터링 후 결정 */
  MAX_PER_POSTING: null as number | null,
  /** 닉네임 검색 최소 길이 */
  SEARCH_MIN_CHARS: 2,
} as const;
