/**
 * ScreenSkeleton — 화면 타입별 Skeleton 프리셋
 *
 * 룰 근거: impeccable-design.md §16 Skeleton > Spinner
 *
 * 사용: 리스트·상세·카드 그리드 화면의 초기 로딩 상태.
 * 스피너는 2초 이내 예상 액션(버튼 submit)에만.
 *
 * @note 프로젝트의 기존 `SkeletonText`는 멀티라인 단락용(`lines`/`lineHeight` props)
 *       이므로, 단일 텍스트 라인 플레이스홀더는 `Skeleton` 프리미티브로 직접 합성한다.
 *       border 토큰은 프로젝트 컨벤션(`border-divider`)을 따른다.
 */

import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from './Skeleton';

export type ScreenSkeletonType =
  | 'jobsList'
  | 'applicantList'
  | 'scheduleList'
  | 'settlementList'
  | 'notificationList';

interface ScreenSkeletonProps {
  type: ScreenSkeletonType;
  count?: number;
}

export function ScreenSkeleton({ type, count = 5 }: ScreenSkeletonProps) {
  return (
    <View className="flex-1" accessibilityRole="progressbar" accessibilityLabel="로딩 중">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} type={type} />
      ))}
    </View>
  );
}

function SkeletonRow({ type }: { type: ScreenSkeletonType }) {
  if (type === 'jobsList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row gap-2 mb-2">
          <Skeleton width={40} height={16} borderRadius={3} accessible={false} />
          <Skeleton width={30} height={16} borderRadius={3} accessible={false} />
        </View>
        <Skeleton width="70%" height={15} borderRadius={3} accessible={false} />
        <View className="mt-1">
          <Skeleton width="50%" height={11} borderRadius={3} accessible={false} />
        </View>
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1">
            <Skeleton width="80%" height={12} borderRadius={3} accessible={false} />
            <View className="mt-1">
              <Skeleton width={60} height={16} borderRadius={3} accessible={false} />
            </View>
          </View>
          <View className="flex-1 items-end">
            <Skeleton width="60%" height={15} borderRadius={3} accessible={false} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'applicantList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row items-center justify-between mb-2">
          <Skeleton width="40%" height={13} borderRadius={3} accessible={false} />
          <Skeleton width={40} height={18} borderRadius={3} accessible={false} />
        </View>
        <Skeleton width="60%" height={11} borderRadius={3} accessible={false} />
        <View className="mt-2">
          <Skeleton width="100%" height={26} borderRadius={4} accessible={false} />
        </View>
      </View>
    );
  }

  if (type === 'scheduleList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row gap-3">
          <Skeleton width={50} height={60} borderRadius={6} accessible={false} />
          <View className="flex-1 gap-2">
            <Skeleton width="70%" height={14} borderRadius={3} accessible={false} />
            <Skeleton width="50%" height={11} borderRadius={3} accessible={false} />
            <Skeleton width="30%" height={12} borderRadius={3} accessible={false} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'settlementList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row items-center justify-between mb-2">
          <Skeleton width="50%" height={12} borderRadius={3} accessible={false} />
          <Skeleton width="30%" height={16} borderRadius={3} accessible={false} />
        </View>
        <Skeleton width="40%" height={10} borderRadius={3} accessible={false} />
      </View>
    );
  }

  // notificationList
  return (
    <View className="flex-row gap-2 px-3 py-2 border-b border-divider dark:border-surface-overlay">
      <SkeletonCircle size={6} accessible={false} />
      <View className="flex-1 gap-1">
        <Skeleton width="70%" height={12} borderRadius={3} accessible={false} />
        <Skeleton width="90%" height={11} borderRadius={3} accessible={false} />
        <Skeleton width="20%" height={9} borderRadius={3} accessible={false} />
      </View>
    </View>
  );
}
