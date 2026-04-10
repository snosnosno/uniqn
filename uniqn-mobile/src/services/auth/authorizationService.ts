import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PermissionError, ERROR_CODES } from '@/errors';
import { isUserRole, type UserRole } from '@/types/role';
import { requireCurrentUser } from './authCoreService';

const UNAUTHORIZED_MESSAGE = '권한이 없습니다';

function throwUnauthorized(userMessage: string = UNAUTHORIZED_MESSAGE): never {
  throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
    userMessage,
  });
}

export async function requireMatchingCurrentUser(expectedUserId: string): Promise<SupabaseUser> {
  const currentUser = await requireCurrentUser();
  if (currentUser.id !== expectedUserId) {
    throwUnauthorized();
  }
  return currentUser;
}

export async function requireCurrentUserRole(expectedRole: UserRole): Promise<SupabaseUser> {
  const currentUser = await requireCurrentUser();
  const currentRole = currentUser.app_metadata?.role as string | undefined;

  if (!currentRole || !isUserRole(currentRole) || currentRole !== expectedRole) {
    throwUnauthorized(`${expectedRole} 권한이 필요합니다`);
  }

  return currentUser;
}

export async function requireAdminUser(expectedUserId?: string): Promise<SupabaseUser> {
  const currentUser = expectedUserId
    ? await requireMatchingCurrentUser(expectedUserId)
    : await requireCurrentUser();

  const currentRole = currentUser.app_metadata?.role as string | undefined;

  if (currentRole !== 'admin') {
    throwUnauthorized('관리자 권한이 필요합니다');
  }

  return currentUser;
}
