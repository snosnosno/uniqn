/**
 * UNIQN Mobile - Employer Job Posting Detail Layout
 *
 * 하이브리드 레이아웃:
 * - 데이터(useJobDetail)와 포스팅 capability 가드는 레이아웃에서 유지
 * - QR 은 모달이 아니라 전용 화면(`./qr`)이다. 진입점이 여러 개여도 도착지는 하나.
 * - 권한 게이트(owner/workspace/JPC 협업자)는 RLS 가 단일 진실 — client-side
 *   isManageableByUser 가드는 JPC 협업자를 잘못 차단하므로 제거됨 (2026-05-19).
 * - 헤더는 각 자식 화면에서 StackHeader로 렌더링 (JobDetailContext 경유)
 */

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useJobDetail } from '@/hooks/useJobDetail';
import { QRCodeIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { getLayoutColor, SECONDARY_PALETTE } from '@/constants/colors';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';
import type { JobPosting } from '@/types';

// ============================================================================
// JobDetailContext
// ============================================================================
// 자식 화면이 StackHeader 렌더링에 필요한 job / handleShowQR 을 공유하기 위한
// 경량 컨텍스트. 데이터는 레이아웃에서 useJobDetail 로 한 번만 조회.
//
// isFixed 는 QR 차단 용도로만 쓰였으므로 제거했다. 고정 QR 전환으로 사장이 고를 것이
// 0개가 되어(날짜·시간슬롯·모드·갱신 소멸) 고정공고도 동일한 QR 을 쓴다.

interface JobDetailContextValue {
  job: JobPosting | null;
  handleShowQR: () => void;
}

const NOOP = () => {
  // No-op fallback for JobDetailContext consumers rendered outside the provider.
};

const JobDetailContext = createContext<JobDetailContextValue>({
  job: null,
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
 * 모든 공고(고정 포함)에서 동일하게 노출한다.
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
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { addToast } = useToastStore();
  const { job } = useJobDetail(id || '', { realtime: true });

  const handleShowQR = useCallback(() => {
    router.push(`/(employer)/my-postings/${id ?? ''}/qr`);
  }, [router, id]);

  useEffect(() => {
    if (!job) {
      return;
    }

    // 권한 게이트는 RLS 단일 진실. 기존 isManageableByUser client guard 는 JPC
    // 협업자를 잘못 차단했음 (2026-05-19). RLS 가 차단하면 useJobDetail 이 null
    // 반환 → !job 분기로 자연스럽게 빈 화면 처리. 여기서는 capability(스키마/타입)
    // 가드만 유지.
    if (isEmployerManageablePosting(job)) {
      return;
    }

    addToast({
      type: 'warning',
      message: '현재 관리 화면에서 지원하지 않는 공고입니다.',
    });
    router.replace('/(app)/(tabs)/employer');
  }, [addToast, job, router]);

  const contextValue = useMemo<JobDetailContextValue>(
    () => ({
      job: job ?? null,
      handleShowQR,
    }),
    [job, handleShowQR]
  );

  if (job && !isEmployerManageablePosting(job)) {
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
      </View>
    </JobDetailContext.Provider>
  );
}
