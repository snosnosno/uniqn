import React from 'react';
import { Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonJobCard } from '@/components/ui/Skeleton';

type PostingSurfaceStateMode = 'loading' | 'empty' | 'error' | 'partial';

interface PostingSurfaceStateProps {
  mode: PostingSurfaceStateMode;
  /**
   * 스켈레톤 형상을 고른다.
   *  - `list`   구직자 목록 (카드 3장)
   *  - `detail` 구직자 상세 (히어로 + 급여 + 본문 섹션)
   *  - `manage` 구인자 관리 화면 (통계 블록 + 액션 행)
   *
   * `manage` 를 따로 둔 이유: 관리 화면에 `detail` 형상을 쓰면 히어로·급여 자리가 크게
   * 비어 있다가 실제로는 통계와 액션 목록이 나타난다 — 로딩 중에 본 형태와 도착한 화면이
   * 달라서 스켈레톤이 기대를 잘못 만든다.
   */
  scope: 'list' | 'detail' | 'manage';
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode | string;
}

function PostingDetailSkeleton() {
  return (
    <View
      className="flex-1 p-4"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="로딩 중"
    >
      {/* 히어로 타이틀 + 서브라인 */}
      <Skeleton width="75%" height={24} accessible={false} className="mb-2" />
      <Skeleton width="40%" height={16} accessible={false} className="mb-5" />
      {/* 급여 라인 */}
      <Skeleton width="55%" height={20} accessible={false} className="mb-6" />
      {/* 섹션 행 4개 (라벨 + 본문 2줄) */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="mb-5">
          <Skeleton width="30%" height={14} accessible={false} className="mb-2" />
          <Skeleton width="100%" height={14} accessible={false} className="mb-2" />
          <Skeleton width="70%" height={14} accessible={false} />
        </View>
      ))}
    </View>
  );
}

/**
 * 구인자 관리 화면용 스켈레톤 — 통계 한 줄 + 액션 행 넷.
 *
 * 형상이 도착할 화면(공고 정보 카드 → 통계 3숫자 → 관리 행 목록)을 따라간다.
 */
function PostingManageSkeleton() {
  return (
    <View
      className="flex-1 p-4"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="로딩 중"
    >
      {/* 공고 제목 + 상태 뱃지 자리 */}
      <Skeleton width="60%" height={22} accessible={false} className="mb-3" />
      {/* 통계 3숫자 블록 */}
      <View className="mb-6 flex-row justify-around rounded-lg bg-surface-page px-3 py-4 dark:bg-surface">
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-1 items-center">
            <Skeleton width={32} height={22} accessible={false} className="mb-1" />
            <Skeleton width={40} height={12} accessible={false} />
          </View>
        ))}
      </View>
      {/* 관리 행 목록 */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="mb-3 flex-row items-center">
          <Skeleton width={36} height={36} accessible={false} className="mr-3 rounded-sm" />
          <View className="flex-1">
            <Skeleton width="45%" height={16} accessible={false} className="mb-1.5" />
            <Skeleton width="70%" height={12} accessible={false} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function PostingSurfaceState({
  mode,
  scope,
  title,
  message,
  error,
  onRetry,
  actionLabel,
  onAction,
  icon,
}: PostingSurfaceStateProps) {
  if (mode === 'loading') {
    if (scope === 'list') {
      return (
        <View className="flex-1 p-4">
          {[1, 2, 3].map((item) => (
            <SkeletonJobCard key={item} />
          ))}
        </View>
      );
    }

    if (scope === 'manage') {
      return <PostingManageSkeleton />;
    }

    return <PostingDetailSkeleton />;
  }

  if (mode === 'error') {
    return <ErrorState error={error} title={title} message={message} onRetry={onRetry} />;
  }

  if (mode === 'partial') {
    return (
      <View className="mx-4 mb-3 rounded-md bg-warning-50 px-4 py-3 dark:bg-warning-100">
        <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-500">
          {title || '일부 정보만 불러왔습니다'}
        </Text>
        {message ? (
          <Text className="mt-1 text-xs text-warning-600 dark:text-warning-500 font-sans">
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <EmptyState
      title={title}
      description={message}
      icon={icon}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
