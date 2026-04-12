/**
 * UNIQN Mobile - Employer Job Posting Detail Layout
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useJobDetail } from '@/hooks/useJobDetail';
import { QRCodeIcon } from '@/components/icons';
import { EventQRModal } from '@/components/employer/qr/EventQRModal';
import { HeaderBackButton } from '@/components/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { getLayoutColor, SECONDARY_PALETTE } from '@/constants/colors';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';

function HeaderQRButton({ tintColor, onPress }: { tintColor: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} className="mr-2 p-2">
      <QRCodeIcon size={22} color={tintColor} />
    </Pressable>
  );
}

function HeaderTitle({
  screenTitle,
  jobTitle,
  isDark,
}: {
  screenTitle: string;
  jobTitle?: string;
  isDark: boolean;
}) {
  return (
    <View className="flex-1 flex-row items-center">
      <Text
        className="text-base font-sans-semibold"
        style={{ color: isDark ? '#FFFFFF' : '#09090B' }}
      >
        {screenTitle}
      </Text>
      {jobTitle && (
        <>
          <Text
            className="mx-2 font-sans"
            style={{ color: isDark ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400] }}
          >
            |
          </Text>
          <Text
            className="flex-1 text-base font-sans"
            style={{ color: isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500] }}
            numberOfLines={1}
          >
            {jobTitle}
          </Text>
        </>
      )}
    </View>
  );
}

export default function JobPostingDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.uid);
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { addToast } = useToastStore();
  const { job, isLoading } = useJobDetail(id || '', { realtime: true });
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

  const jobTitle = useMemo(() => {
    if (isLoading) return '';
    return job?.title || '';
  }, [isLoading, job?.title]);

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

  if (
    job &&
    ((currentUserId && job.ownerId !== currentUserId) || !isEmployerManageablePosting(job))
  ) {
    return null;
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface-dark">
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: getLayoutColor(isDark, 'header'),
          },
          headerTintColor: getLayoutColor(isDark, 'headerTint'),
          headerTitleStyle: {
            fontFamily: 'Outfit_600SemiBold',
            fontWeight: '600',
          },
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
          headerLeft: () => (
            <HeaderBackButton
              tintColor={getLayoutColor(isDark, 'headerTint')}
              fallbackHref="/(app)/(tabs)/employer"
            />
          ),
          headerRight: () =>
            isFixed ? null : (
              <HeaderQRButton
                tintColor={getLayoutColor(isDark, 'headerTint')}
                onPress={handleShowQR}
              />
            ),
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerTitle: () => (
              <HeaderTitle screenTitle="공고 상세" jobTitle={jobTitle} isDark={isDark} />
            ),
          }}
        />
        <Stack.Screen
          name="applicants"
          options={{
            headerTitle: () => (
              <HeaderTitle screenTitle="지원자 관리" jobTitle={jobTitle} isDark={isDark} />
            ),
          }}
        />
        <Stack.Screen
          name="settlements"
          options={{
            headerTitle: () => (
              <HeaderTitle screenTitle="정산 관리" jobTitle={jobTitle} isDark={isDark} />
            ),
          }}
        />
        <Stack.Screen
          name="edit"
          options={{
            headerTitle: () => (
              <HeaderTitle screenTitle="공고 수정" jobTitle={jobTitle} isDark={isDark} />
            ),
          }}
        />
        <Stack.Screen
          name="cancellation-requests"
          options={{
            headerTitle: () => (
              <HeaderTitle screenTitle="취소 요청" jobTitle={jobTitle} isDark={isDark} />
            ),
          }}
        />
      </Stack>

      {!isFixed && (
        <EventQRModal
          visible={showQRModal}
          onClose={handleCloseQR}
          jobPostingId={id || ''}
          jobTitle={job?.title}
        />
      )}
    </View>
  );
}
