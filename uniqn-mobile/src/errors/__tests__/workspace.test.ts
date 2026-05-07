/**
 * PR #2 — workspace RPC 에러 매핑 테스트
 */

import { mapWorkspaceRpcError, WORKSPACE_ERROR_CODES } from '@/errors/workspace';
import { isAuthError, isPermissionError, isBusinessError, isValidationError } from '@/errors';

describe('mapWorkspaceRpcError (PR #2)', () => {
  it('AUTH_REQUIRED → AuthError', () => {
    const err = mapWorkspaceRpcError({ message: 'AUTH_REQUIRED' });
    expect(err).not.toBeNull();
    expect(isAuthError(err!)).toBe(true);
  });

  it('PERMISSION_DENIED → PermissionError + 권한 회수 메시지', () => {
    const err = mapWorkspaceRpcError({ message: 'PERMISSION_DENIED' });
    expect(err).not.toBeNull();
    expect(isPermissionError(err!)).toBe(true);
    expect(err!.userMessage).toContain('권한이 회수');
  });

  it('SELF_INVITE_FORBIDDEN → ValidationError', () => {
    const err = mapWorkspaceRpcError({ message: 'SELF_INVITE_FORBIDDEN' });
    expect(err).not.toBeNull();
    expect(isValidationError(err!)).toBe(true);
    expect(err!.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_SELF_INVITE);
  });

  it('CANNOT_REMOVE_OWNER → ValidationError', () => {
    const err = mapWorkspaceRpcError({ message: 'CANNOT_REMOVE_OWNER' });
    expect(err).not.toBeNull();
    expect(isValidationError(err!)).toBe(true);
  });

  it('ALREADY_MEMBER → BusinessError', () => {
    const err = mapWorkspaceRpcError({ message: 'ALREADY_MEMBER' });
    expect(err).not.toBeNull();
    expect(isBusinessError(err!)).toBe(true);
    expect(err!.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_MEMBER);
  });

  it('ALREADY_INVITED → BusinessError', () => {
    const err = mapWorkspaceRpcError({ message: 'ALREADY_INVITED' });
    expect(err).not.toBeNull();
    expect(err!.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_ALREADY_INVITED);
  });

  it('INVITATION_EXPIRED → BusinessError + 만료 메시지', () => {
    const err = mapWorkspaceRpcError({ message: 'INVITATION_EXPIRED' });
    expect(err).not.toBeNull();
    expect(err!.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_EXPIRED);
    expect(err!.userMessage).toContain('만료된 초대');
  });

  it('INVITATION_REJECTED / REVOKED / ACCEPTED 각각 별도 코드', () => {
    expect(mapWorkspaceRpcError({ message: 'INVITATION_REJECTED' })?.code).toBe(
      WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REJECTED
    );
    expect(mapWorkspaceRpcError({ message: 'INVITATION_REVOKED' })?.code).toBe(
      WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_REVOKED
    );
    expect(mapWorkspaceRpcError({ message: 'INVITATION_ACCEPTED' })?.code).toBe(
      WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_ACCEPTED
    );
  });

  it('INVITATION_NOT_FOUND / WORKSPACE_NOT_FOUND', () => {
    expect(mapWorkspaceRpcError({ message: 'INVITATION_NOT_FOUND' })?.code).toBe(
      WORKSPACE_ERROR_CODES.WORKSPACE_INVITATION_NOT_FOUND
    );
    expect(mapWorkspaceRpcError({ message: 'WORKSPACE_NOT_FOUND' })?.code).toBe(
      WORKSPACE_ERROR_CODES.WORKSPACE_NOT_FOUND
    );
  });

  it('RLS cap 도달 → CAP_REACHED', () => {
    const err = mapWorkspaceRpcError({
      message: 'new row violates row-level security policy',
    });
    expect(err).not.toBeNull();
    expect(err!.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_CAP_REACHED);
    expect(err!.userMessage).toContain('10개');
  });

  it('알 수 없는 에러 → null (호출자가 일반 처리)', () => {
    expect(mapWorkspaceRpcError({ message: 'SOME_RANDOM_ERROR' })).toBeNull();
    expect(mapWorkspaceRpcError(null)).toBeNull();
    expect(mapWorkspaceRpcError({})).toBeNull();
  });
});
