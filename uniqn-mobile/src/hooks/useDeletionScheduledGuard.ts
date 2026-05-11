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
  /** 호출자가 모달 닫은 후 재조회 차단용 — 같은 user.id 동안 1회 표시 */
  dismiss: () => void;
}

export function useDeletionScheduledGuard(): DeletionScheduledGuardState {
  const { user } = useAuth();
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const userId = user?.uid;
    if (!userId) {
      setDeletion(null);
      return;
    }
    if (dismissed.has(userId)) {
      setDeletion(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    getDeletionStatus(userId)
      .then((result) => {
        if (cancelled) return;
        setDeletion(result?.status === 'pending' ? result : null);
      })
      .catch((error) => {
        // 조회 실패는 silent — 모달 띄우지 않음. logger만 기록.
        logger.warn('탈퇴 상태 조회 실패 (modal skip)', {
          component: 'useDeletionScheduledGuard',
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) setDeletion(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, dismissed]);

  const dismiss = () => {
    const userId = user?.uid;
    if (!userId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    setDeletion(null);
  };

  return { deletion, isLoading, dismiss };
}
