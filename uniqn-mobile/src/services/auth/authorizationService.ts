import type { User as FirebaseUser } from 'firebase/auth';
import { PermissionError, ERROR_CODES } from '@/errors';
import { isUserRole, type UserRole } from '@/types/role';
import { requireCurrentUser } from './authCoreService';

const UNAUTHORIZED_MESSAGE = '권한이 없습니다';

function throwUnauthorized(userMessage: string = UNAUTHORIZED_MESSAGE): never {
  throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
    userMessage,
  });
}

function getRoleClaim(claims: Record<string, unknown>): UserRole | null {
  const role = claims.role;
  return isUserRole(role) ? role : null;
}

export function requireMatchingCurrentUser(expectedUserId: string): FirebaseUser {
  const currentUser = requireCurrentUser();
  if (currentUser.uid !== expectedUserId) {
    throwUnauthorized();
  }
  return currentUser;
}

export async function requireCurrentUserRole(expectedRole: UserRole): Promise<FirebaseUser> {
  const currentUser = requireCurrentUser();
  const tokenResult = await currentUser.getIdTokenResult();
  const currentRole = getRoleClaim(tokenResult.claims as Record<string, unknown>);

  if (currentRole !== expectedRole) {
    throwUnauthorized(`${expectedRole} 권한이 필요합니다`);
  }

  return currentUser;
}

export async function requireAdminUser(expectedUserId?: string): Promise<FirebaseUser> {
  const currentUser = expectedUserId
    ? requireMatchingCurrentUser(expectedUserId)
    : requireCurrentUser();
  const tokenResult = await currentUser.getIdTokenResult();
  const currentRole = getRoleClaim(tokenResult.claims as Record<string, unknown>);

  if (currentRole !== 'admin') {
    throwUnauthorized('관리자 권한이 필요합니다');
  }

  return currentUser;
}
