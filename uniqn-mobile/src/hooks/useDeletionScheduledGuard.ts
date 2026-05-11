/**
 * 회원탈퇴 grace period 가드 (P2 #5).
 *
 * 인증 사용자가 `deletion_scheduled_for IS NOT NULL`(status='pending')인 경우
 * 진입 즉시 deletion 객체를 노출해 호출자가 모달을 띄울 수 있게 한다. 명시적
 * 결정 없이 그대로 사용 → 30일 후 자동 영구 삭제되어 사용자가 의식하지 못한
 * 활동 후 갑자기 계정을 잃는 시나리오를 차단.
 */
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getDeletionStatus, type DeletionRequest } from '@/services/auth/accountDeletionService';
import { logger } from '@/utils/logger';

export interface DeletionScheduledGuardState {
  /** 현재 활성 탈퇴 요청. status='pending'인 경우만 반환, 아니면 null */
  deletion: DeletionRequest | null;
  isLoading: boolean;
  /**
   * C7 fix — 조회 실패 상태. fail-open(silent)으로 두면 P0 #5 "명시적 결정 강제"
   * 의도가 transient 네트워크 에러로 무력화됨. 호출자가 error 노출 +
   * retry/로그아웃 강제 UX를 선택할 수 있도록 명시적으로 surface.
   */
  error: Error | null;
  /** C7 fix — 호출자가 retry 가능 */
  retry: () => void;
  /** 호출자가 모달 닫은 후 재조회 차단용 — 같은 user.id 동안 1회 표시 */
  dismiss: () => void;
}

/**
 * C8 — dismiss key: `${userId}::${requestedAt.toISOString()}`
 *
 * userId 단독은 동일 사용자가 새로 탈퇴 예약을 잡을 때 이전 dismiss가 영구
 * 유지되어 새 탈퇴 모달을 가린다. requestedAt(또는 scheduledDeletionAt)을
 * 포함해야 새 deletion 요청마다 모달이 다시 노출된다.
 */
function buildDismissKey(userId: string, requestedAt: Date | string): string {
  const iso = typeof requestedAt === 'string' ? requestedAt : requestedAt.toISOString();
  return `${userId}::${iso}`;
}

export function useDeletionScheduledGuard(): DeletionScheduledGuardState {
  const { user } = useAuth();
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const userId = user?.uid;
    if (!userId) {
      setDeletion(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getDeletionStatus(userId)
      .then((result) => {
        if (cancelled) return;
        if (result?.status !== 'pending') {
          setDeletion(null);
          setError(null);
          return;
        }
        // C8 — 이번 deletion 요청을 이미 dismiss 했는지 확인
        const key = buildDismissKey(userId, result.requestedAt);
        if (dismissed.has(key)) {
          setDeletion(null);
          setError(null);
          return;
        }
        setDeletion(result);
        setError(null);
      })
      .catch((err) => {
        // C7 fix — 조회 실패를 호출자에게 surface. fail-open으로 두면
        // 탈퇴 예약 상태 사용자가 네트워크 에러만으로 모달 우회 가능.
        const normalized = err instanceof Error ? err : new Error(String(err));
        logger.warn('탈퇴 상태 조회 실패', {
          component: 'useDeletionScheduledGuard',
          userId,
          error: normalized.message,
        });
        if (!cancelled) {
          setError(normalized);
          setDeletion(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, dismissed, retryCount]);

  const dismiss = () => {
    const userId = user?.uid;
    if (!userId || !deletion) return;
    // C8 — userId 단독이 아닌 (userId, requestedAt) 조합으로 dismiss 기록
    const key = buildDismissKey(userId, deletion.requestedAt);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setDeletion(null);
    setError(null);
  };

  const retry = () => {
    setRetryCount((c) => c + 1);
  };

  return { deletion, isLoading, error, retry, dismiss };
}
