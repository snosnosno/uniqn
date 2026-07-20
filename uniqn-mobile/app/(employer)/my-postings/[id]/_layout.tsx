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
import { isFixedJobPosting } from '@/utils/normalizers';
import type { JobPosting } from '@/types';

// ============================================================================
// JobDetailContext
// ============================================================================
// 자식 화면이 StackHeader 렌더링에 필요한 job / isFixed / isLoading / handleShowQR 을
// 공유하기 위한 경량 컨텍스트. 데이터는 레이아웃에서 useJobDetail 로 한 번만 조회.
//
// isFixed 는 QR 진입점 차단용이다. 고정 QR 전환 때 "사장이 고를 것이 0개가 됐으니 막을
// 근거가 없다"며 잠시 제거했으나, 막혀 있던 진짜 이유는 선택 복잡도가 아니라 **work_log
// 행 수명**이었다 — confirm_application 이 고정 공고에 dates:['FIXED_SCHEDULE'] 한 원소만
// flat INSERT 하므로 스태프·공고당 행이 1개이고, 그 행을 scheduled 로 되돌리는 크론·트리거·
// 클라 코드가 어디에도 없다. 즉 D일에 출근→퇴근하면 행이 checked_out 으로 고정되어 D+1
// 부터는 모든 스캔이 "오늘 근무는 이미 퇴근 처리됐습니다"로 영구 실패한다.
// 행 수명 재설계는 별도 PR 이며, 그때까지 고정 공고에는 QR 진입점을 노출하지 않는다.

interface JobDetailContextValue {
  job: JobPosting | null;
  /** 고정 스케줄 공고 여부 — true 면 QR 진입점을 렌더링하지 않는다. */
  isFixed: boolean;
  isLoading: boolean;
  handleShowQR: () => void;
}

const NOOP = () => {
  // No-op fallback for JobDetailContext consumers rendered outside the provider.
};

const JobDetailContext = createContext<JobDetailContextValue>({
  job: null,
  isFixed: false,
  isLoading: false,
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
 *
 * @remarks 고정(`isFixed`) 공고에서는 호출부가 이 버튼을 **아예 렌더링하지 않는다**.
 *   누를 수는 있는데 동작이 실패하는 것보다 버튼이 없는 편이 정직하다.
 *   소비처는 5곳(index·applicants·settlements·edit·cancellation-requests) — 한 곳이라도
 *   빠지면 탭을 옮길 때마다 버튼이 나타났다 사라진다.
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
  const { job, isLoading } = useJobDetail(id || '', { realtime: true });

  const isFixed = job ? isFixedJobPosting(job) : false;

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
      isFixed,
      isLoading,
      handleShowQR,
    }),
    [job, isFixed, isLoading, handleShowQR]
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
