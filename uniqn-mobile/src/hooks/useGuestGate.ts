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
import { isGuestAuthState } from '@/shared/navigation/guestAccess';
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

/**
 * 게스트가 누를 수 없는 탭 — 이동을 막고 로그인(웹은 앱 설치)을 안내한다.
 * 로그인 뒤에는 누르려던 탭으로 돌아간다. 구인구직 탭은 게스트에게 열려 있어 목록에 없다.
 */
export const GUEST_LOCKED_TABS = {
  schedule: { source: 'schedule-tab', redirect: '/(app)/(tabs)/schedule' },
  board: { source: 'board-tab', redirect: '/(app)/(tabs)/board' },
  employer: { source: 'employer-tab', redirect: '/(app)/(tabs)/employer' },
  profile: { source: 'profile-tab', redirect: '/(app)/(tabs)/profile' },
} as const satisfies Record<string, { source: InstallPromptSource; redirect: string }>;

export type GuestLockedTab = keyof typeof GUEST_LOCKED_TABS;

/** 탭바 `tabPress` 리스너 — 게스트면 이동을 막고 안내, 로그인 사용자면 아무것도 하지 않는다. */
export function createGuestTabPressHandler(
  name: GuestLockedTab,
  isGuest: boolean,
  promptGuest: (source: InstallPromptSource, redirect?: string | null) => void
) {
  return (event: { preventDefault: () => void }) => {
    if (!isGuest) return;
    event.preventDefault();
    const { source, redirect } = GUEST_LOCKED_TABS[name];
    promptGuest(source, redirect);
  };
}

export function useIsGuest(): boolean {
  return useAuthStore(isGuestAuthState);
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
          // 모달을 먼저 닫고 이동한다 — 떠 있는 RN Modal 위로 화면을 올리지 않는다(useInstallPrompt 와 같은 순서).
          onPress: () => {
            modal.close();
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
