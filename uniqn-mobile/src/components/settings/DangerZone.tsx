/**
 * UNIQN Mobile - 위험 영역 컴포넌트
 *
 * @description 계정 삭제 등 위험한 작업을 위한 UI
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui';
import { TrashIcon, ExclamationTriangleIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface DangerZoneProps {
  /** 계정 삭제 버튼 클릭 핸들러 */
  onDeleteAccount: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  return (
    <Card className="border border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20">
      {/* 헤더 */}
      <View className="mb-3 flex-row items-center">
        <ExclamationTriangleIcon size={18} color="#DC2626" />
        <Text className="ml-2 text-sm font-semibold text-error-700 dark:text-error-300">
          위험 영역
        </Text>
      </View>

      {/* 설명 */}
      <Text className="mb-4 text-xs leading-5 text-error-600 dark:text-error-400">
        아래 작업은 되돌릴 수 없습니다. 신중하게 진행해주세요.
      </Text>

      {/* 계정 삭제 버튼 */}
      <Pressable
        onPress={onDeleteAccount}
        className="flex-row items-center justify-between rounded-lg border border-error-300 bg-white px-4 py-3 active:bg-error-50 dark:border-error-700 dark:bg-surface dark:active:bg-error-900/30"
        accessibilityLabel="계정 삭제"
        accessibilityRole="button"
      >
        <View className="flex-row items-center">
          <TrashIcon size={20} color="#DC2626" />
          <View className="ml-3">
            <Text className="text-sm font-medium text-error-700 dark:text-error-300">
              계정 삭제
            </Text>
            <Text className="text-xs text-error-500 dark:text-error-400">
              30일 후 영구 삭제됩니다
            </Text>
          </View>
        </View>
        <Text className="text-error-400">→</Text>
      </Pressable>
    </Card>
  );
}
