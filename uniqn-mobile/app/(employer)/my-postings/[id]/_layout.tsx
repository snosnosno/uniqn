/**
 * UNIQN Mobile - 공고 상세 레이아웃
 * 모든 공고 상세 하위 화면에 헤더에 제목 통합 표시
 *
 * @description 헤더에 "화면명 | 공고제목" 형태로 표시
 * @version 2.0.0
 */

import { useState, useCallback, useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useJobDetail } from '@/hooks/useJobDetail';
import { QRCodeIcon } from '@/components/icons';
import { EventQRModal } from '@/components/employer/qr/EventQRModal';
import { HeaderBackButton } from '@/components/navigation';

/**
 * 헤더 QR 버튼
 */
function HeaderQRButton({ tintColor, onPress }: { tintColor: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} className="p-2 mr-2">
      <QRCodeIcon size={22} color={tintColor} />
    </Pressable>
  );
}

/**
 * 커스텀 헤더 타이틀 컴포넌트
 */
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
    <View className="flex-row items-center flex-1">
      <Text className="text-base font-semibold" style={{ color: isDark ? '#ffffff' : '#1A1625' }}>
        {screenTitle}
      </Text>
      {jobTitle && (
        <>
          <Text className="mx-2" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
            |
          </Text>
          <Text
            className="flex-1 text-base"
            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { job, isLoading } = useJobDetail(id || '');

  // QR 모달 상태
  const [showQRModal, setShowQRModal] = useState(false);

  const handleShowQR = useCallback(() => {
    setShowQRModal(true);
  }, []);

  const handleCloseQR = useCallback(() => {
    setShowQRModal(false);
  }, []);

  // 공고 제목 (로딩 중이면 빈 문자열)
  const jobTitle = useMemo(() => {
    if (isLoading) return '';
    return job?.title || '';
  }, [isLoading, job?.title]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? '#1A1625' : '#ffffff',
          },
          headerTintColor: isDark ? '#ffffff' : '#1A1625',
          headerTitleStyle: {
            fontWeight: '600',
          },
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: isDark ? '#1A1625' : '#f9fafb',
          },
          headerLeft: () => (
            <HeaderBackButton
              tintColor={isDark ? '#ffffff' : '#1A1625'}
              fallbackHref="/(app)/(tabs)/employer"
            />
          ),
          headerRight: () => (
            <HeaderQRButton tintColor={isDark ? '#ffffff' : '#1A1625'} onPress={handleShowQR} />
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

      {/* 현장 QR 모달 */}
      <EventQRModal
        visible={showQRModal}
        onClose={handleCloseQR}
        jobPostingId={id || ''}
        jobTitle={job?.title}
      />
    </View>
  );
}
