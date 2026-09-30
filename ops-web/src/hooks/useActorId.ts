import { useAuth } from '@/auth/authContext';
import { AuthError, ERROR_CODES } from '@/core/errors/AppError';

/** RPC 의 `p_actor_id` = 현재 사용자 id. 콘솔(RequireAuth 안)에서만 쓴다. */
export function useActorId(): string {
  const auth = useAuth();
  if (auth.status !== 'signedIn') {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED);
  }
  return auth.session.user.id;
}
