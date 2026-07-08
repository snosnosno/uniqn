import { useCallback } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { InstallPromptContent } from '@/components/modals/InstallPromptContent';
import { resolveInstallStoreUrl } from '@/constants';
import { getLoginRoute } from '@/shared/navigation/authRedirect';
import { useModal } from '@/stores/modalStore';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';

export type InstallPromptSource =
  | 'job-card'
  | 'job-detail-cta'
  | 'schedule-tab'
  | 'employer-tab'
  | 'profile-tab';

interface OpenInstallPromptOptions {
  loginRedirect?: string | null;
}

interface InstallPromptCopy {
  title: string;
  description: string;
}

const DEFAULT_LOGIN_REDIRECTS: Partial<Record<InstallPromptSource, string>> = {
  'schedule-tab': '/(app)/(tabs)/schedule',
  'employer-tab': '/(app)/(tabs)/employer',
  'profile-tab': '/(app)/(tabs)/profile',
};

function getInstallPromptCopy(source: InstallPromptSource): InstallPromptCopy {
  switch (source) {
    case 'schedule-tab':
      return {
        title: '앱에서 스케줄을 확인할 수 있어요',
        description: '내 스케줄 확인과 근무 관리는 UNIQN 앱에서 이용할 수 있습니다.',
      };
    case 'employer-tab':
      return {
        title: '앱에서 내 공고를 관리할 수 있어요',
        description: '내 공고 확인과 지원자 관리는 UNIQN 앱에서 이용할 수 있습니다.',
      };
    case 'profile-tab':
      return {
        title: '앱에서 프로필을 확인할 수 있어요',
        description: '프로필 확인과 계정 설정은 UNIQN 앱에서 이용할 수 있습니다.',
      };
    case 'job-card':
    case 'job-detail-cta':
    default:
      return {
        title: '앱에서 지원할 수 있어요',
        description: '공고 지원과 일정 확인은 UNIQN 앱에서 이용할 수 있습니다.',
      };
  }
}

function resolveLoginRedirect(
  source: InstallPromptSource,
  options?: OpenInstallPromptOptions
): string | null {
  return options?.loginRedirect ?? DEFAULT_LOGIN_REDIRECTS[source] ?? null;
}

export function useInstallPrompt() {
  const modal = useModal();
  const toast = useToast();

  const openStore = useCallback(
    async (source: InstallPromptSource) => {
      const storeUrl = resolveInstallStoreUrl();

      logger.info('Install CTA clicked', {
        component: 'useInstallPrompt',
        source,
        storeUrl,
      });

      try {
        await Linking.openURL(storeUrl);
        modal.close();
      } catch (error) {
        logger.error('Failed to open store url from install prompt', error as Error, {
          component: 'useInstallPrompt',
          source,
          storeUrl,
        });
        toast.error('스토어를 열 수 없어요. 잠시 후 다시 시도해주세요.');
      }
    },
    [modal, toast]
  );

  const openInstallPrompt = useCallback(
    (source: InstallPromptSource, options?: OpenInstallPromptOptions) => {
      const copy = getInstallPromptCopy(source);
      const loginRedirect = resolveLoginRedirect(source, options);

      logger.info('Opened install prompt for public surface', {
        component: 'useInstallPrompt',
        source,
        loginRedirect,
      });

      modal.open({
        type: 'custom',
        title: copy.title,
        content: (
          <InstallPromptContent
            description={copy.description}
            onLogin={() => {
              const loginRoute = getLoginRoute(loginRedirect);

              logger.info('Install prompt login CTA clicked', {
                component: 'useInstallPrompt',
                source,
                loginRedirect,
                loginRoute,
              });

              modal.close();
              router.push(loginRoute);
            }}
          />
        ),
        confirmButton: {
          label: '앱 설치',
          variant: 'primary',
          onPress: () => {
            void openStore(source);
          },
        },
        cancelButton: {
          label: '나중에',
          variant: 'ghost',
        },
        dismissible: true,
      });
    },
    [modal, openStore]
  );

  return {
    openInstallPrompt,
  };
}
