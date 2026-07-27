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
  /**
   * 전체선택 토글 (화면에 보이는 공유 가능 공고 대상).
   * 선택/해제 어느 쪽이든 같은 콜백으로 전달한다 — 무엇이 "전부"인지는 목록을 쥔 화면만 안다.
   */
  onSelectAll: () => void;
  /** 화면의 공유 가능 공고가 (상한 내에서) 전부 선택된 상태인가. 라벨을 "전체 해제" 로 바꾼다. */
  isAllSelected?: boolean;
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
  isAllSelected = false,
  onShare,
  onCancel,
  isSharing = false,
  bottomOffset = 0,
}: BulkShareActionBarProps) {
  const insets = useSafeAreaInsets();
  const canShare = selectedCount > 0 && !isSharing;
  const selectAllLabel = isAllSelected ? '전체 해제' : '전체 선택';

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
        </View>

        {/*
          전체선택은 원래 카운트 라벨 아래 붙은 12px 회색 텍스트였다. 라벨의 일부처럼 보여
          누를 수 있는 요소로 안 읽혔고 "기능이 없다"는 보고까지 나왔다 — 테두리를 줘서
          버튼으로 승격한다. 카운트 옆 같은 줄에 두어 바 높이(BULK_SHARE_ACTION_BAR_HEIGHT)는
          그대로 유지한다.
        */}
        <Pressable
          onPress={onSelectAll}
          disabled={isSharing}
          hitSlop={8}
          className="min-h-[40px] justify-center rounded-md border border-secondary-300 px-3 active:bg-surface-hover dark:border-surface-overlay dark:active:bg-surface-overlay"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSharing }}
          accessibilityLabel={
            isAllSelected ? '선택한 공고 전체 해제' : '공유 가능한 공고 전체 선택'
          }
        >
          <Text className="text-xs font-sans-medium text-content-secondary">{selectAllLabel}</Text>
        </Pressable>

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
