/**
 * 회원탈퇴 grace period 재로그인 모달 (P2 #5).
 *
 * `useDeletionScheduledGuard` hook이 status='pending' deletion을 감지하면
 * 진입 시점에 본 모달을 띄워 명시적 결정을 강제한다.
 * - "탈퇴 철회하고 계속 사용" → cancelAccountDeletion RPC
 * - "로그아웃" → signOut (탈퇴 유지)
 * close button / backdrop 클릭으로 dismiss 불가 — 명시적 버튼만 허용.
 */
import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { cancelAccountDeletion, signOut } from '@/services/auth';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';
import { useToast } from '@/stores/toastStore';

export interface DeletionScheduledModalProps {
  visible: boolean;
  /**
   * 활성 deletion 객체. null이면 lookup error mode — error + onRetry 필수.
   * (C7 fix: 조회 실패도 fail-closed로 처리해 탈퇴 예약 상태 우회 차단)
   */
  scheduledFor: Date | null;
  onKept: () => void;
  /** lookup error mode — 표시되면 retry 버튼이 활성됨 */
  lookupError?: Error | null;
  onRetry?: () => void;
}

function daysUntil(scheduledFor: Date): number {
  const ms = scheduledFor.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function DeletionScheduledModal({
  visible,
  scheduledFor,
  onKept,
  lookupError = null,
  onRetry,
}: DeletionScheduledModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // C7 fix — lookup error mode. scheduledFor null이고 error만 있으면 retry/logout 모드.
  const isErrorMode = scheduledFor === null && lookupError !== null;

  const daysLeft = scheduledFor ? daysUntil(scheduledFor) : 0;
  const dateLabel = scheduledFor
    ? scheduledFor.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const handleKeepAccount = useCallback(async () => {
    if (!user?.uid || isProcessing) return;
    setIsProcessing(true);
    try {
      await cancelAccountDeletion(user.uid);
      toast.success('회원탈퇴를 철회했어요. 계속 이용해주세요.');
      onKept();
    } catch (error) {
      const message = extractUserMessage(error);
      logger.error('탈퇴 철회 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'DeletionScheduledModal',
        userId: user.uid,
      });
      toast.error(message ?? '탈퇴 철회에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  }, [user?.uid, isProcessing, toast, onKept]);

  const handleLogout = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await signOut();
    } catch (error) {
      logger.warn('탈퇴 grace 모달 로그아웃 실패', {
        component: 'DeletionScheduledModal',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  return (
    <Modal
      visible={visible}
      onClose={() => {
        // 명시적 결정 강제 — 닫기 동작 비활성화. onClose는 prop 필수라 noop.
      }}
      title={isErrorMode ? '탈퇴 상태 확인 실패' : '탈퇴 예약 상태'}
      size="md"
      showCloseButton={false}
      closeOnBackdrop={false}
    >
      <View className="gap-4 p-2">
        {isErrorMode ? (
          <>
            <Text className="text-base leading-6 dark:leading-[1.625rem] text-content-primary dark:text-off-white font-sans-medium">
              회원탈퇴 예약 여부를 확인할 수 없어요
            </Text>
            <Text className="text-sm leading-5 dark:leading-[1.4rem] text-content-muted dark:text-secondary-300 font-sans">
              네트워크 또는 서버 일시적 오류로 보입니다. 안전을 위해 진행 전 다시 시도하거나
              로그아웃해주세요.
            </Text>
            <View className="gap-3 mt-2">
              <Button onPress={onRetry} disabled={isProcessing || !onRetry} fullWidth>
                다시 시도
              </Button>
              <Button onPress={handleLogout} variant="ghost" disabled={isProcessing} fullWidth>
                로그아웃
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text className="text-base leading-6 dark:leading-[1.625rem] text-content-primary dark:text-off-white font-sans-medium">
              회원탈퇴가 예약되어 있어요
            </Text>
            <Text className="text-sm leading-5 dark:leading-[1.4rem] text-content-muted dark:text-secondary-300 font-sans">
              {daysLeft > 0
                ? `${daysLeft}일 후(${dateLabel})에 계정과 모든 데이터가 영구 삭제됩니다. 계속 이용하시려면 탈퇴를 철회해주세요.`
                : `예정일(${dateLabel})이 지났습니다. 계속 이용하시려면 즉시 탈퇴를 철회해주세요.`}
            </Text>
            <View className="gap-3 mt-2">
              <Button onPress={handleKeepAccount} disabled={isProcessing} fullWidth>
                탈퇴 철회하고 계속 사용
              </Button>
              <Button onPress={handleLogout} variant="ghost" disabled={isProcessing} fullWidth>
                로그아웃
              </Button>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
