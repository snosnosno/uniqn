/**
 * UNIQN Mobile - Employer Job Posting Detail Layout
 *
 * 하이브리드 레이아웃:
 * - 데이터(useJobDetail), 소유권 가드, EventQRModal은 레이아웃에서 유지
 * - 헤더는 각 자식 화면에서 StackHeader로 렌더링 (JobDetailContext 경유)
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useJobDetail } from '@/hooks/useJobDetail';
import { EventQRModal } from '@/components/employer/qr/EventQRModal';
import { QRCodeIcon } from '@/components/icons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { getLayoutColor, SECONDARY_PALETTE } from '@/constants/colors';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';
import type { JobPosting } from '@/types';

// ============================================================================
// JobDetailContext
// ============================================================================
// 자식 화면이 StackHeader 렌더링에 필요한 job / isFixed / handleShowQR 을
// 공유하기 위한 경량 컨텍스트. 데이터는 레이아웃에서 useJobDetail 로 한 번만 조회.

interface JobDetailContextValue {
  job: JobPosting | null;
  isFixed: boolean;
  handleShowQR: () => void;
}

const NOOP = () => {
  // No-op fallback for JobDetailContext consumers rendered outside the provider.
};

const JobDetailContext = createContext<JobDetailContextValue>({
  job: null,
  isFixed: false,
  handleShowQR: NOOP,
});

export function useJobDetailContext(): JobDetailContextValue {
  return useContext(JobDetailContext);
}

// ============================================================================
// JobTitleSuffix
// ============================================================================
// StackHeader titleSuffix 로 넘겨 "| {jobTitle}" 스타일로 렌더링.
// 빈 문자열이면 null 반환 (제목 옆에 아무것도 표시 안 함).

/**
 * StackHeader rightAction 으로 넘기는 헤더 QR 버튼.
 * isFixed 인 경우 호출부에서 null 을 넘기는 것을 권장.
 */
export function HeaderQRAction({ onPress }: { onPress: () => void }) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const tintColor = getLayoutColor(isDark, 'headerTint');

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="p-2"
      accessibilityRole="button"
      accessibilityLabel="QR 코드 표시"
    >
      <QRCodeIcon size={22} color={tintColor} />
    </Pressable>
  );
}

export function JobTitleSuffix({ jobTitle }: { jobTitle?: string | null }) {
  const isDark = useThemeStore((s) => s.isDarkMode);

  if (!jobTitle) {
    return null;
  }

  return (
    <View className="flex-row items-center">
      <Text
        className="mx-2 font-sans"
        style={{ color: isDark ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400] }}
      >
        |
      </Text>
      <Text
        className="flex-shrink text-base font-sans"
        style={{ color: isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500] }}
        numberOfLines={1}
      >
        {jobTitle}
      </Text>
    </View>
  );
}

// ============================================================================
// Layout
// ============================================================================

export default function JobPostingDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.uid);
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { addToast } = useToastStore();
  const { job } = useJobDetail(id || '', { realtime: true });
  const [showQRModal, setShowQRModal] = useState(false);

  const isFixed = job?.schedule.kind === 'fixed';

  const handleShowQR = useCallback(() => {
    if (isFixed) {
      addToast({
        type: 'warning',
        message: '고정공고는 1차 범위에서 QR을 지원하지 않습니다.',
      });
      return;
    }

    setShowQRModal(true);
  }, [addToast, isFixed]);

  const handleCloseQR = useCallback(() => {
    setShowQRModal(false);
  }, []);

  useEffect(() => {
    if (!job) {
      return;
    }

    if (currentUserId && job.ownerId !== currentUserId) {
      addToast({
        type: 'warning',
        message: '내가 작성한 공고만 관리할 수 있습니다.',
      });
      router.replace('/(app)/(tabs)/employer');
      return;
    }

    if (isEmployerManageablePosting(job)) {
      return;
    }

    addToast({
      type: 'warning',
      message: '현재 관리 화면에서 지원하지 않는 공고입니다.',
    });
    router.replace('/(app)/(tabs)/employer');
  }, [addToast, currentUserId, job, router]);

  const contextValue = useMemo<JobDetailContextValue>(
    () => ({
      job: job ?? null,
      isFixed: !!isFixed,
      handleShowQR,
    }),
    [job, isFixed, handleShowQR]
  );

  if (
    job &&
    ((currentUserId && job.ownerId !== currentUserId) || !isEmployerManageablePosting(job))
  ) {
    return null;
  }

  return (
    <JobDetailContext.Provider value={contextValue}>
      <View className="flex-1 bg-surface-page dark:bg-surface">
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: getLayoutColor(isDark, 'content'),
            },
          }}
        />

        {!isFixed && (
          <EventQRModal
            visible={showQRModal}
            onClose={handleCloseQR}
            jobPostingId={id || ''}
            jobTitle={job?.title}
          />
        )}
      </View>
    </JobDetailContext.Provider>
  );
}
