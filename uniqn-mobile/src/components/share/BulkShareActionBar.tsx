/**
 * 묶음 공유 하단 액션 바
 *
 * @description 선택 모드에서 화면 하단에 고정되어 선택 수·전체선택·공유·취소를 제공한다.
 *   구인자 목록과 관리자 목록이 같은 바를 쓴다 — 두 화면의 선택 UX 가 갈라지지 않게 한다.
 */

import React, { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShareIcon } from '@/components/icons';
import { NumericText } from '@/components/ui';
import { TEXT_COLORS } from '@/constants/colors';

export const BULK_SHARE_ACTION_BAR_HEIGHT = 64;

export interface BulkShareActionBarProps {
  selectedCount: number;
  maxCount: number;
  /** 전체선택 (화면에 보이는 공유 가능 공고 대상) */
  onSelectAll: () => void;
  onShare: () => void;
  onCancel: () => void;
  isSharing?: boolean;
  /** 탭바가 있는 화면에서 바를 탭바 위로 띄우기 위한 추가 하단 여백 */
  bottomOffset?: number;
}

export const BulkShareActionBar = memo(function BulkShareActionBar({
  selectedCount,
  maxCount,
  onSelectAll,
  onShare,
  onCancel,
  isSharing = false,
  bottomOffset = 0,
}: BulkShareActionBarProps) {
  const insets = useSafeAreaInsets();
  const canShare = selectedCount > 0 && !isSharing;

  return (
    <View
      className="absolute inset-x-0 bottom-0 border-t border-secondary-100 bg-surface-card dark:border-surface-overlay dark:bg-surface-elevated"
      style={{ paddingBottom: insets.bottom + bottomOffset }}
      accessibilityRole="toolbar"
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={onCancel}
          disabled={isSharing}
          hitSlop={8}
          className="min-h-[44px] justify-center px-2 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="선택 모드 종료"
        >
          <Text className="text-sm font-sans-medium text-content-secondary">취소</Text>
        </Pressable>

        <View className="flex-1">
          <NumericText className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
            {selectedCount}/{maxCount} 선택
          </NumericText>
          <Pressable
            onPress={onSelectAll}
            disabled={isSharing}
            hitSlop={8}
            className="active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="공유 가능한 공고 전체 선택"
          >
            <Text className="mt-0.5 text-xs font-sans-medium text-content-secondary">
              전체 선택
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onShare}
          disabled={!canShare}
          className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-md px-5 ${
            canShare
              ? 'bg-primary-600 active:bg-primary-700 dark:bg-primary-500 dark:active:bg-primary-400'
              : 'bg-secondary-200 dark:bg-surface-overlay'
          }`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canShare, busy: isSharing }}
          accessibilityLabel={
            selectedCount > 0 ? `선택한 ${selectedCount}건 공유하기` : '공유할 공고를 선택하세요'
          }
        >
          {isSharing ? (
            <ActivityIndicator size="small" color={TEXT_COLORS.onGold} />
          ) : (
            <ShareIcon size={16} color={canShare ? TEXT_COLORS.onGold : undefined} />
          )}
          <Text
            className={`text-sm font-sans-semibold ${
              canShare ? 'text-content-onGold' : 'text-content-muted dark:text-secondary-400'
            }`}
          >
            {selectedCount > 0 ? `${selectedCount}건 공유` : '공유'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
