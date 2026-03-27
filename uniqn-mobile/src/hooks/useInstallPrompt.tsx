import { useCallback } from 'react';
import { InstallPromptContent } from '@/components/modals/InstallPromptContent';
import { getStoreUrl } from '@/constants';
import { useModal } from '@/stores/modalStore';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';

export type InstallPromptSource =
  | 'job-card'
  | 'job-detail-cta'
  | 'schedule-tab'
  | 'employer-tab'
  | 'profile-tab';

interface InstallPromptCopy {
  title: string;
  description: string;
}

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

export function useInstallPrompt() {
  const modal = useModal();
  const toast = useToast();

  const openInstallPrompt = useCallback(
    (source: InstallPromptSource) => {
      const copy = getInstallPromptCopy(source);

      logger.info('Opened install prompt for public surface', {
        component: 'useInstallPrompt',
        source,
      });

      modal.open({
        type: 'custom',
        title: copy.title,
        content: <InstallPromptContent description={copy.description} />,
        confirmButton: {
          label: '앱 설치',
          variant: 'primary',
          onPress: () => {
            const storeUrl = getStoreUrl();

            logger.info('Install CTA clicked before store links are connected', {
              component: 'useInstallPrompt',
              source,
              storeUrl,
            });

            toast.info('앱 설치 링크는 준비 중입니다.');
          },
        },
        cancelButton: {
          label: '나중에',
          variant: 'ghost',
        },
        dismissible: true,
      });
    },
    [modal, toast]
  );

  return {
    openInstallPrompt,
  };
}

export default useInstallPrompt;
