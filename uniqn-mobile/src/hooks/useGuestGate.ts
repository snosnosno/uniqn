/**
 * 게스트(비로그인) 행동 게이트.
 *
 * 게스트는 공고 목록만 볼 수 있다(@/shared/navigation/guestAccess). 그 밖의 행동 —
 * 공고 상세, 다른 탭 — 을 누르면 여기서 안내를 띄운다.
 *   - 앱: 로그인 안내. 로그인 뒤 누르려던 곳(`redirect`)으로 돌아간다.
 *   - 웹: 앱 설치 안내(기존 설치 프롬프트 — 로그인 버튼도 함께 있다).
 */

import { useCallback } from 'react';
import { router } from 'expo-router';
import { useInstallPrompt, type InstallPromptSource } from '@/hooks/useInstallPrompt';
import { getLoginRoute } from '@/shared/navigation/authRedirect';
import { useAuthStore } from '@/stores/authStore';
import { useModal } from '@/stores/modalStore';
import { isWeb } from '@/utils/platform';
import { logger } from '@/utils/logger';

const LOGIN_PROMPT_MESSAGES: Record<InstallPromptSource, string> = {
  'job-card': '로그인하면 공고 상세를 보고 바로 지원할 수 있어요.',
  'job-detail-cta': '로그인하면 공고 상세를 보고 바로 지원할 수 있어요.',
  'schedule-tab': '로그인하면 확정된 근무와 출근 일정을 볼 수 있어요.',
  'board-tab': '로그인하면 공지와 채팅을 볼 수 있어요.',
  'employer-tab': '로그인하면 공고를 올리고 지원자를 관리할 수 있어요.',
  'profile-tab': '로그인하면 프로필과 평점을 관리할 수 있어요.',
};

export function useIsGuest(): boolean {
  return useAuthStore((state) => state.status === 'unauthenticated');
}

export function useGuestGate() {
  const modal = useModal();
  const { openInstallPrompt } = useInstallPrompt();

  const promptGuest = useCallback(
    (source: InstallPromptSource, redirect?: string | null) => {
      if (isWeb) {
        openInstallPrompt(source, { loginRedirect: redirect ?? null });
        return;
      }

      logger.info('Opened login prompt for guest', { component: 'useGuestGate', source });

      modal.open({
        type: 'confirm',
        title: '로그인이 필요해요',
        message: LOGIN_PROMPT_MESSAGES[source],
        confirmButton: {
          label: '로그인',
          variant: 'primary',
          onPress: () => {
            router.push(getLoginRoute(redirect ?? null));
          },
        },
        cancelButton: { label: '나중에', variant: 'ghost' },
        dismissible: true,
      });
    },
    [modal, openInstallPrompt]
  );

  return { promptGuest };
}
