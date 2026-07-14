import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import type { OrderRowState } from './orderRowMeta';

export function OrderRow({
  state,
  error,
  onPress,
  testID,
}: {
  state: OrderRowState;
  error?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 min-h-[44px] border-b border-secondary-100 dark:border-surface-overlay last:border-b-0 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${state.label} ${state.unset ? '미설정' : state.value}${
        error ? `, 오류: ${error}` : ''
      }`}
      testID={testID}
    >
      <Text className="w-16 text-xs text-content-secondary font-sans">{state.label}</Text>
      {state.unset ? (
        <View className="px-2 py-0.5 rounded-full bg-warning-100">
          <Text className="text-[11px] font-sans-medium text-warning-700 dark:text-warning-300">
            미설정
          </Text>
        </View>
      ) : (
        <Text
          className={`flex-1 text-sm font-sans-medium ${
            state.value === '없음' ? 'text-content-muted' : 'text-content-primary'
          }`}
          numberOfLines={1}
        >
          {state.value}
        </Text>
      )}
      {error ? (
        <Text className="text-[11px] text-error-500 dark:text-error-400 font-sans mr-1">
          {error}
        </Text>
      ) : null}
      {/* 아이콘은 color prop만 받음(className cssInterop 미등록) — createIcon 기본색이 테마 적응 secondary(muted) */}
      <ChevronRightIcon size={16} />
    </Pressable>
  );
}
