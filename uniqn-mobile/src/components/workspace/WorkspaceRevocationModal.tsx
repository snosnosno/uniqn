/**
 * UNIQN Mobile - WorkspaceRevocationModal
 *
 * @description editor 가 워크스페이스에서 회수당했을 때 표시되는 보안 알림 Modal.
 *              5초 카운트다운 후 자동 signOut + 로그인 화면 이동. 사용자에게 명시적
 *              "보안상 자동 로그아웃" 메시지를 보여주어 무음 권한 박탈을 방지.
 *
 *              AppError 카테고리: E5 (보안 / authorization). impeccable v1 §1
 *              다크모드 lineHeight 가산 적용.
 *              (Phase 1A — workspace collaboration)
 * @version 1.0.0
 */

import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@/services/auth';
import { logger } from '@/utils/logger';

interface WorkspaceRevocationModalProps {
  visible: boolean;
  workspaceName?: string;
  /** 카운트다운 초 (테스트 용도. 기본 5) */
  countdownSeconds?: number;
}

const DEFAULT_COUNTDOWN = 5;

export function WorkspaceRevocationModal({
  visible,
  workspaceName,
  countdownSeconds = DEFAULT_COUNTDOWN,
}: WorkspaceRevocationModalProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(countdownSeconds);

  // visible=false 시 카운트다운 리셋
  useEffect(() => {
    if (!visible) {
      setCountdown(countdownSeconds);
      return;
    }

    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    const timer = setTimeout(async () => {
      try {
        logger.info('워크스페이스 회수로 자동 로그아웃', { workspaceName });
        await signOut();
        router.replace('/(auth)/login');
      } catch (error) {
        logger.error('회수 로그아웃 실패 — fallback 으로 로그인 화면 이동', error as Error);
        // E5: 실패해도 로그인 화면으로 강제 이동 — 회수된 세션 유지 위험
        router.replace('/(auth)/login');
      }
    }, countdownSeconds * 1000);

    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [visible, workspaceName, countdownSeconds, router]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        testID="workspace-revocation-alert"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center bg-black/60 px-6"
      >
        <View className="w-full max-w-sm rounded-md bg-surface-card p-6 dark:bg-surface-elevated">
          <Text className="mb-3 text-xl font-display text-content-primary">
            워크스페이스 접근이 회수됐어요
          </Text>
          <Text className="mb-2 text-base leading-6 text-content-secondary dark:leading-[1.625rem]">
            {workspaceName ? `‘${workspaceName}’ ` : ''}워크스페이스 소유자가 권한을 회수했습니다.
          </Text>
          <Text className="text-base leading-6 text-content-secondary dark:leading-[1.625rem]">
            보안을 위해 {countdown}초 후 자동으로 로그아웃됩니다.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default WorkspaceRevocationModal;
