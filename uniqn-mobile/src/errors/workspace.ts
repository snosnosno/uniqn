/**
 * UNIQN Mobile - 워크스페이스 RPC 에러 매핑
 *
 * @description PR #2 — invite/accept/reject/revoke RPC 에러 → AppError 변환.
 *              DB 함수가 RAISE EXCEPTION 'CODE_NAME' 으로 던진 에러를 잡아 도메인 에러로 변환.
 * @version 1.0.0
 */

import {
  AuthError,
  BusinessError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  AppError,
} from './AppError';

/**
 * 워크스페이스 도메인 에러 코드 (E6 비즈니스)
 */
export const WORKSPACE_ERROR_CODES = {
  WORKSPACE_NOT_FOUND: 'E6080',
  WORKSPACE_INVITATION_NOT_FOUND: 'E6081',
  WORKSPACE_ALREADY_MEMBER: 'E6082',
  WORKSPACE_ALREADY_INVITED: 'E6083',
  WORKSPACE_INVITATION_EXPIRED: 'E6084',
  WORKSPACE_INVITATION_REJECTED: 'E6085',
  WORKSPACE_INVITATION_REVOKED: 'E6086',
  WORKSPACE_INVITATION_ACCEPTED: 'E6087',
  WORKSPACE_SELF_INVITE: 'E6088',
  WORKSPACE_CANNOT_REMOVE_OWNER: 'E6089',
  WORKSPACE_CAP_REACHED: 'E6090',
  /** RLS INSERT 정책 위반 — cap/role/owner_id 중 어느 것이 fail 했는지 RPC 응답만으로 분간 불가 */
  WORKSPACE_INSERT_DENIED: 'E6091',
  WORKSPACE_HAS_ACTIVE_POSTINGS: 'E6092',
} as const;

const WORKSPACE_ERROR_USER_MESSAGES: Record<string, string> = {
  [WORKSPACE_ERROR_CODES.WORKSPACE_NOT_FOUND]: '워크스페이스를 찾을 수 없습니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_NOT_FOUND]: '초대를 찾을 수 없습니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_MEMBER]: '이미 워크스페이스 멤버입니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_INVITED]:
    '이미 초대 보류 중입니다. 상대방의 응답을 기다려주세요.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_EXPIRED]:
    '만료된 초대예요. 워크스페이스 소유자에게 다시 초대를 요청해주세요.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REJECTED]: '이미 거절한 초대입니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REVOKED]: '회수된 초대입니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_ACCEPTED]: '이미 수락된 초대입니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_SELF_INVITE]: '본인은 초대할 수 없습니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_CANNOT_REMOVE_OWNER]:
    '워크스페이스 소유자는 멤버에서 제외할 수 없습니다.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_CAP_REACHED]:
    '워크스페이스는 사용자당 최대 10개까지 만들 수 있어요. 사용하지 않는 워크스페이스를 정리해주세요.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_INSERT_DENIED]:
    '워크스페이스를 만들 수 없어요. 권한이 부족하거나 최대 개수(10개)에 도달했을 수 있어요. 잠시 후 다시 시도해주세요.',
  [WORKSPACE_ERROR_CODES.WORKSPACE_HAS_ACTIVE_POSTINGS]:
    '진행 중인 공고가 있어 보관할 수 없어요. 먼저 공고를 마감해주세요.',
};

function makeWorkspaceError(code: string): AppError {
  const userMessage = WORKSPACE_ERROR_USER_MESSAGES[code];
  switch (code) {
    case WORKSPACE_ERROR_CODES.WORKSPACE_SELF_INVITE:
      return new ValidationError(code, { userMessage });
    case WORKSPACE_ERROR_CODES.WORKSPACE_CANNOT_REMOVE_OWNER:
      return new ValidationError(code, { userMessage });
    default:
      return new BusinessError(code, { userMessage });
  }
}

/**
 * Postgres / supabase-js 에러 메시지를 AppError 로 매핑.
 * RPC 가 RAISE EXCEPTION 'CODE_NAME' 으로 던진 토큰을 인식.
 *
 * @param error supabase rpc().error 또는 catch 한 unknown
 * @returns 매핑된 AppError, 매핑 실패 시 null (호출자가 일반 BusinessError 처리)
 */
export function mapWorkspaceRpcError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const message = (error as { message?: string }).message;
  if (typeof message !== 'string') return null;

  // RAISE EXCEPTION 'CODE' → "CODE" 또는 "P0001: CODE" 패턴 모두 처리
  const upper = message.toUpperCase();

  // archive_workspace RPC: 진행공고 차단 — 'WORKSPACE_HAS_ACTIVE_POSTINGS:N' (N = 개수)
  const activePostingsMatch = upper.match(/WORKSPACE_HAS_ACTIVE_POSTINGS:?\s*(\d+)/);
  if (activePostingsMatch) {
    const count = activePostingsMatch[1] ?? '';
    return new BusinessError(WORKSPACE_ERROR_CODES.WORKSPACE_HAS_ACTIVE_POSTINGS, {
      userMessage: `진행 중인 공고 ${count}건을 먼저 마감해주세요.`,
    });
  }

  if (upper.includes('AUTH_REQUIRED'))
    return new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      userMessage: '로그인이 필요합니다.',
    });

  if (upper.includes('PERMISSION_DENIED'))
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: '워크스페이스 편집 권한이 회수되었어요. 다시 로그인하면 최신 상태가 적용됩니다.',
    });

  if (upper.includes('VALIDATION_REQUIRED'))
    return new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '필수 입력 항목입니다.',
    });

  // create_workspace RPC 가 cap 도달 시 명시적으로 raise — RLS 우회 경로 (SECURITY DEFINER)
  if (upper.includes('WORKSPACE_CAP_REACHED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_CAP_REACHED);

  if (upper.includes('SELF_INVITE_FORBIDDEN'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_SELF_INVITE);

  if (upper.includes('CANNOT_REMOVE_OWNER'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_CANNOT_REMOVE_OWNER);

  if (upper.includes('ALREADY_MEMBER'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_MEMBER);

  if (upper.includes('ALREADY_INVITED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_INVITED);

  // INVITATION_* 매핑 (순서 중요 — 더 구체적인 패턴 먼저)
  if (upper.includes('INVITATION_EXPIRED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_EXPIRED);

  if (upper.includes('INVITATION_REJECTED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REJECTED);

  if (upper.includes('INVITATION_REVOKED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REVOKED);

  if (upper.includes('INVITATION_ACCEPTED'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_ACCEPTED);

  if (upper.includes('INVITATION_NOT_FOUND'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_NOT_FOUND);

  if (upper.includes('WORKSPACE_NOT_FOUND'))
    return makeWorkspaceError(WORKSPACE_ERROR_CODES.WORKSPACE_NOT_FOUND);

  // RLS 위반 패턴 — INSERT 정책 거절
  // workspaces_insert_employer_with_cap CHECK = (owner_id 일치) AND (role) AND (cap < 10)
  // 셋 중 어느 것이 fail 했는지 RPC 응답으로 분간 불가 — multi-cause 메시지로 통합
  // (사전 cap 체크는 호출자가 workspace_count_for_owner RPC 로 확인 후 분기 가능)
  if (upper.includes('NEW ROW VIOLATES ROW-LEVEL SECURITY POLICY')) {
    return new BusinessError(WORKSPACE_ERROR_CODES.WORKSPACE_INSERT_DENIED, {
      userMessage:
        WORKSPACE_ERROR_USER_MESSAGES[WORKSPACE_ERROR_CODES.WORKSPACE_INSERT_DENIED] ?? '권한 부족',
    });
  }

  return null;
}
