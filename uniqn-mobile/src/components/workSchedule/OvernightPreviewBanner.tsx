/**
 * OvernightPreviewBanner — 배치 시간 입력(추가·편집 시트) 공용 익일 프리뷰 배너.
 *
 * 시작/종료('HH:mm')로부터 익일 여부·근무시간 파생은 deriveOvernightPreview(SSOT)에 위임한다.
 * 이 컴포넌트는 로직 없이 표현만 담당한다:
 *  - 시작==종료(isEqual): 오류 안내(저장/추가 차단은 호출측 canSubmit 이 담당).
 *  - 그 외: 익일/당일 라벨 + 총 근무시간 프리뷰.
 *
 * AddSlotSheet(B1)·EditSlotSheet(B2)가 동일 배너를 공유해 발산을 막는다(DRY).
 */
import React from 'react';
import { Text, View } from 'react-native';
import { AlertCircleIcon } from '@/components/icons';
import { deriveOvernightPreview } from '@/shared/time';

export interface OvernightPreviewBannerProps {
  /** 시작 시각('HH:mm') */
  startTime: string;
  /** 종료 시각('HH:mm') */
  endTime: string;
}

export function OvernightPreviewBanner({ startTime, endTime }: OvernightPreviewBannerProps) {
  const preview = deriveOvernightPreview(startTime, endTime);

  if (preview.isEqual) {
    return (
      <View className="mt-2 flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
        <AlertCircleIcon size={16} color="#DC2626" />
        <Text className="ml-2 font-sans text-sm text-error-600 dark:text-error-400">
          시작과 종료 시간이 같아요. 다시 확인해주세요.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-2 flex-row items-center justify-between rounded-lg bg-surface-page p-3 dark:bg-surface">
      <Text className="font-sans text-sm text-content-muted dark:text-secondary-400">
        {preview.isNextDay ? `익일 ${endTime} 종료` : '당일 근무'}
      </Text>
      <Text className="font-display text-base text-primary-600 dark:text-primary-400">
        총 {preview.durationLabel}
      </Text>
    </View>
  );
}
